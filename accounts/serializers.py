from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db.models import Avg
from django.db import transaction
from .models import DoctorProfile, ClinicProfile, Follow, Wallet, WalletTransaction

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    followers_count = serializers.SerializerMethodField()
    following_count = serializers.SerializerMethodField()
    posts_count = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'phone', 'user_type', 'avatar',
            'bio', 'first_name', 'last_name', 'full_name', 'created_at',
            'followers_count', 'following_count', 'posts_count', 'is_following',
        ]
        read_only_fields = ['id', 'created_at', 'user_type']

    def get_full_name(self, obj):
        name = obj.get_full_name().strip()
        return name or obj.username

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        viewer = getattr(request, 'user', None)
        can_view_private = bool(
            viewer and viewer.is_authenticated and (viewer.is_staff or viewer.pk == instance.pk)
        )
        if not can_view_private:
            data.pop('email', None)
            data.pop('phone', None)
        return data

    def get_followers_count(self, obj):
        return obj.followers.count()

    def get_following_count(self, obj):
        return obj.following.count()

    def get_posts_count(self, obj):
        return obj.posts.count()

    def get_is_following(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return Follow.objects.filter(
                follower=request.user,
                following=obj,
            ).exists()
        return False


class UserUpdateSerializer(serializers.ModelSerializer):
    MAX_AVATAR_SIZE = 10 * 1024 * 1024

    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'email', 'phone', 'avatar', 'bio',
        ]

    def validate_avatar(self, value):
        if value and value.size > self.MAX_AVATAR_SIZE:
            raise serializers.ValidationError('حجم عکس پروفایل حداکثر باید ۱۰ مگابایت باشد.')
        return value

    def validate_email(self, value):
        if value:
            qs = User.objects.filter(email__iexact=value).exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError('این ایمیل قبلاً ثبت شده است.')
        return value

    def validate_phone(self, value):
        qs = User.objects.filter(phone=value).exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('این شماره موبایل قبلاً ثبت شده است.')
        return value


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)
    specialty = serializers.ChoiceField(
        choices=DoctorProfile.SPECIALTY_CHOICES,
        required=False,
        allow_blank=True,
    )
    license_number = serializers.CharField(required=False, allow_blank=True, max_length=50)
    city = serializers.CharField(required=False, allow_blank=True, max_length=100)
    address = serializers.CharField(required=False, allow_blank=True)
    latitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, required=False, allow_null=True,
    )
    longitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, required=False, allow_null=True,
    )
    clinic_name = serializers.CharField(required=False, allow_blank=True, max_length=200)
    official_name = serializers.CharField(required=False, allow_blank=True, max_length=200)
    registration_number = serializers.CharField(required=False, allow_blank=True, max_length=50)
    website = serializers.URLField(required=False, allow_blank=True)
    services = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'username', 'email', 'phone', 'password', 'password_confirm',
            'user_type', 'avatar', 'bio',
            'specialty', 'license_number', 'city', 'address', 'latitude', 'longitude',
            'clinic_name', 'official_name', 'registration_number', 'website', 'services',
        ]

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({
                'password_confirm': 'رمز عبور و تکرار آن مطابقت ندارند.',
            })
        validate_password(data['password'])

        if User.objects.filter(username__iexact=data['username']).exists():
            raise serializers.ValidationError({
                'username': 'این نام کاربری قبلاً استفاده شده است.',
            })
        if data.get('email') and User.objects.filter(email__iexact=data['email']).exists():
            raise serializers.ValidationError({
                'email': 'این ایمیل قبلاً ثبت شده است.',
            })
        if User.objects.filter(phone=data['phone']).exists():
            raise serializers.ValidationError({
                'phone': 'این شماره موبایل قبلاً ثبت شده است.',
            })

        if data.get('user_type') == 'doctor':
            required = ['specialty', 'license_number', 'city', 'address', 'clinic_name']
            errors = {}
            for field in required:
                if not str(data.get(field, '')).strip():
                    errors[field] = 'برای ثبت‌نام پزشک این فیلد الزامی است.'
            if errors:
                raise serializers.ValidationError(errors)
            if DoctorProfile.objects.filter(license_number=data['license_number']).exists():
                raise serializers.ValidationError({
                    'license_number': 'شماره نظام پزشکی قبلاً ثبت شده است.',
                })

        if data.get('user_type') == 'clinic':
            required = ['official_name', 'registration_number', 'city', 'address']
            errors = {}
            for field in required:
                if not str(data.get(field, '')).strip():
                    errors[field] = 'برای ثبت‌نام کلینیک این فیلد الزامی است.'
            if errors:
                raise serializers.ValidationError(errors)
            reg = data.get('registration_number')
            if reg and ClinicProfile.objects.filter(registration_number=reg).exists():
                raise serializers.ValidationError({
                    'registration_number': 'شناسه/مجوز فعالیت قبلاً ثبت شده است.',
                })

        return data

    def create(self, validated_data):
        doctor_fields = {}
        for key in ('specialty', 'license_number', 'city', 'address', 'clinic_name'):
            doctor_fields[key] = validated_data.pop(key, None) or ''
        for key in ('latitude', 'longitude'):
            doctor_fields[key] = validated_data.pop(key, None)

        clinic_fields = {}
        for key in ('official_name', 'registration_number', 'city', 'address', 'website', 'services'):
            clinic_fields[key] = validated_data.pop(key, None) or ''
        for key in ('latitude', 'longitude'):
            clinic_fields[key] = validated_data.pop(key, None)

        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        user_type = validated_data.get('user_type', 'patient')

        with transaction.atomic():
            user = User(**validated_data)
            user.set_password(password)
            user.save()

            if user_type == 'doctor':
                DoctorProfile.objects.create(user=user, **doctor_fields)
            elif user_type == 'clinic':
                ClinicProfile.objects.create(user=user, **clinic_fields)

        return user


def patient_can_see_doctor_location(request, profile):
    if not request or not request.user.is_authenticated:
        return False
    if request.user == profile.user:
        return True
    if request.user.user_type != 'patient':
        return False
    from appointments.models import Appointment
    return Appointment.objects.filter(
        patient=request.user,
        doctor=profile.user,
        status__in=('pending', 'confirmed', 'completed'),
    ).exists()


class ClinicBriefSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    avatar = serializers.ImageField(source='user.avatar', read_only=True)

    class Meta:
        model = ClinicProfile
        fields = [
            'id', 'username', 'official_name', 'city',
            'is_verified', 'avatar',
        ]


class DoctorProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    reviews_count = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()
    specialty_display = serializers.CharField(source='get_specialty_display', read_only=True)
    linked_clinic = ClinicBriefSerializer(read_only=True)
    can_see_location = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()

    class Meta:
        model = DoctorProfile
        fields = [
            'id', 'user', 'specialty', 'specialty_display', 'license_number',
            'experience_years', 'city', 'clinic_name', 'linked_clinic',
            'consultation_fee', 'profile_layout', 'algorithm_score', 'is_verified',
            'reviews_count', 'average_rating',
            'can_see_location', 'location',
        ]
        read_only_fields = ['algorithm_score', 'is_verified', 'linked_clinic']

    def get_reviews_count(self, obj):
        return obj.user.received_reviews.count()

    def get_average_rating(self, obj):
        result = obj.user.received_reviews.aggregate(Avg('rating'))
        return round(result['rating__avg'] or 0, 1)

    def get_can_see_location(self, obj):
        request = self.context.get('request')
        return patient_can_see_doctor_location(request, obj)

    def get_location(self, obj):
        if not self.get_can_see_location(obj):
            return None
        lat = obj.latitude
        lng = obj.longitude
        return {
            'address': obj.address,
            'city': obj.city,
            'clinic_name': obj.clinic_name,
            'latitude': float(lat) if lat is not None else None,
            'longitude': float(lng) if lng is not None else None,
        }


class DoctorProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DoctorProfile
        fields = [
            'specialty', 'license_number', 'experience_years', 'city', 'address',
            'latitude', 'longitude', 'clinic_name', 'consultation_fee',
            'profile_layout',
        ]

    def validate_license_number(self, value):
        if not value:
            return value
        qs = DoctorProfile.objects.filter(license_number=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('شماره نظام پزشکی قبلاً ثبت شده است.')
        return value


class FollowSerializer(serializers.ModelSerializer):
    follower = UserSerializer(read_only=True)
    following = UserSerializer(read_only=True)

    class Meta:
        model = Follow
        fields = ['id', 'follower', 'following', 'created_at']
        read_only_fields = ['id', 'created_at']


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class ClinicProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    doctors_count = serializers.SerializerMethodField()
    is_joined_by_me = serializers.SerializerMethodField()
    can_manage = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()

    class Meta:
        model = ClinicProfile
        fields = [
            'id', 'user', 'official_name', 'registration_number',
            'city', 'address', 'phone_landline', 'website', 'services',
            'is_verified', 'algorithm_score', 'doctors_count',
            'is_joined_by_me', 'can_manage', 'location',
        ]
        read_only_fields = ['algorithm_score', 'is_verified']

    def get_doctors_count(self, obj):
        return obj.affiliated_doctors.count()

    def get_is_joined_by_me(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated or user.user_type != 'doctor':
            return False
        try:
            return user.doctor_profile.linked_clinic_id == obj.id
        except DoctorProfile.DoesNotExist:
            return False

    def get_can_manage(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        return bool(user and user.is_authenticated and obj.user_id == user.id)

    def get_location(self, obj):
        lat, lng = obj.latitude, obj.longitude
        return {
            'address': obj.address,
            'city': obj.city,
            'clinic_name': obj.official_name,
            'latitude': float(lat) if lat is not None else None,
            'longitude': float(lng) if lng is not None else None,
        }


class ClinicProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClinicProfile
        fields = [
            'official_name', 'registration_number', 'city', 'address',
            'latitude', 'longitude', 'phone_landline', 'website', 'services',
        ]


    def validate_registration_number(self, value):
        qs = ClinicProfile.objects.filter(registration_number=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('شناسه/مجوز فعالیت قبلاً ثبت شده است.')
        return value


class WalletTransactionSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source='get_transaction_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = WalletTransaction
        fields = [
            'id', 'amount', 'transaction_type', 'type_display',
            'status', 'status_display', 'description', 'reference_id',
            'balance_after', 'created_at',
        ]


class WalletSerializer(serializers.ModelSerializer):
    transactions = serializers.SerializerMethodField()

    class Meta:
        model = Wallet
        fields = ['balance', 'updated_at', 'transactions']

    def get_transactions(self, obj):
        qs = obj.transactions.all()[:20]
        return WalletTransactionSerializer(qs, many=True).data


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
    new_password_confirm = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({
                'new_password_confirm': 'رمز عبور و تکرار آن مطابقت ندارند',
            })
        validate_password(attrs['new_password'], user=self.context['request'].user)
        return attrs
