from rest_framework import viewsets, status, permissions, filters
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.conf import settings
from django.shortcuts import get_object_or_404, render
from django.db.models import Q

from .models import DoctorProfile, ClinicProfile, Follow, Wallet
from .serializers import (
    UserSerializer,
    UserUpdateSerializer,
    RegisterSerializer,
    LoginSerializer,
    DoctorProfileSerializer,
    DoctorProfileUpdateSerializer,
    ClinicProfileSerializer,
    ClinicProfileUpdateSerializer,
    FollowSerializer,
    WalletSerializer,
    ChangePasswordSerializer,
)
from .wallet_services import get_or_create_wallet, deposit
from .throttles import AuthAnonThrottle, AuthUserThrottle

User = get_user_model()


def _resolve_user(identifier):
    user = User.objects.filter(username__iexact=identifier).first()
    if user:
        return user
    user = User.objects.filter(email__iexact=identifier).first()
    if user:
        return user
    return User.objects.filter(phone=identifier).first()


class AuthViewSet(viewsets.GenericViewSet):
    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=['post'], throttle_classes=[AuthAnonThrottle])
    def register(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            token, _ = Token.objects.get_or_create(user=user)
            return Response({
                'token': token.key,
                'user': UserSerializer(user, context={'request': request}).data,
                'message': 'ثبت‌نام با موفقیت انجام شد',
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], throttle_classes=[AuthAnonThrottle])
    def login(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identifier = serializer.validated_data['username']
        password = serializer.validated_data['password']
        user = _resolve_user(identifier)

        if not user or not user.check_password(password):
            return Response(
                {'error': 'نام کاربری، ایمیل، موبایل یا رمز عبور اشتباه است'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.is_active:
            return Response(
                {'error': 'حساب کاربری غیرفعال است'},
                status=status.HTTP_403_FORBIDDEN,
            )

        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user': UserSerializer(user, context={'request': request}).data,
            'message': 'ورود موفقیت‌آمیز بود',
        })

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def logout(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response({'message': 'خروج موفقیت‌آمیز بود'})

    @action(detail=False, methods=['post'])
    def password_reset_request(self, request):
        email = request.data.get('email', '').strip()
        if not email:
            return Response(
                {'error': 'ایمیل الزامی است'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = User.objects.filter(email__iexact=email).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_link = request.build_absolute_uri(
                f'/password-reset/confirm/?uid={uid}&token={token}'
            )
            send_mail(
                subject='بازیابی رمز عبور BeautyNet',
                message=f'برای تنظیم رمز جدید از لینک زیر استفاده کنید:\n{reset_link}',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=True,
            )
        return Response({
            'message': 'اگر ایمیل در سیستم باشد، لینک بازیابی ارسال می‌شود.',
        })

    @action(detail=False, methods=['post'])
    def password_reset_confirm(self, request):
        uidb64 = request.data.get('uid')
        token = request.data.get('token')
        password = request.data.get('password')
        password_confirm = request.data.get('password_confirm')

        if not all([uidb64, token, password, password_confirm]):
            return Response(
                {'error': 'اطلاعات ناقص است'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if password != password_confirm:
            return Response(
                {'password_confirm': 'رمز عبور و تکرار آن مطابقت ندارند'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response(
                {'error': 'لینک نامعتبر است'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not default_token_generator.check_token(user, token):
            return Response(
                {'error': 'لینک منقضی یا نامعتبر است'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        validate_password(password, user=user)
        user.set_password(password)
        user.save()
        Token.objects.filter(user=user).delete()
        return Response({'message': 'رمز عبور با موفقیت تغییر کرد'})

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def change_password(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(serializer.validated_data['old_password']):
            return Response(
                {'old_password': 'رمز عبور فعلی اشتباه است'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        Token.objects.filter(user=user).delete()
        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'message': 'رمز عبور با موفقیت تغییر شد',
            'token': token.key,
        })


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.all().order_by('-created_at')
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['username', 'first_name', 'last_name', 'bio', 'phone']
    ordering_fields = ['created_at', 'username']
    lookup_field = 'username'
    lookup_value_regex = r'[\w.@+-]+'

    def get_queryset(self):
        queryset = super().get_queryset()
        user_type = self.request.query_params.get('user_type')
        if user_type:
            queryset = queryset.filter(user_type=user_type)
        return queryset

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def search(self, request):
        q = request.query_params.get('q', '').strip()
        if not q:
            return Response([])
        users = self.get_queryset().filter(
            Q(username__icontains=q)
            | Q(first_name__icontains=q)
            | Q(last_name__icontains=q)
        )[:20]
        serializer = self.get_serializer(users, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['put', 'patch'], permission_classes=[permissions.IsAuthenticated],
            parser_classes=[MultiPartParser, FormParser, JSONParser])
    def update_profile(self, request):
        serializer = UserUpdateSerializer(
            request.user,
            data=request.data,
            partial=True,
            context={'request': request},
        )
        if serializer.is_valid():
            serializer.save()
            return Response(
                UserSerializer(request.user, context={'request': request}).data
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def follow(self, request, username=None):
        user_to_follow = self.get_object()
        if user_to_follow == request.user:
            return Response(
                {'error': 'نمی‌توانید خودتان را فالو کنید'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        follow, created = Follow.objects.get_or_create(
            follower=request.user,
            following=user_to_follow,
        )
        if not created:
            return Response(
                {'message': 'شما قبلاً این کاربر را فالو کرده‌اید'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user_to_follow.user_type == 'doctor':
            try:
                user_to_follow.doctor_profile.update_algorithm_score()
            except DoctorProfile.DoesNotExist:
                pass
        try:
            from notifications.services import notify_follow
            notify_follow(request.user, user_to_follow)
        except Exception:
            pass
        return Response(
            {'message': 'فالو با موفقیت انجام شد'},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def unfollow(self, request, username=None):
        user_to_unfollow = self.get_object()
        deleted_count, _ = Follow.objects.filter(
            follower=request.user,
            following=user_to_unfollow,
        ).delete()
        if deleted_count == 0:
            return Response(
                {'error': 'شما این کاربر را فالو نکرده‌اید'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user_to_unfollow.user_type == 'doctor':
            try:
                user_to_unfollow.doctor_profile.update_algorithm_score()
            except DoctorProfile.DoesNotExist:
                pass
        return Response({'message': 'آنفالو با موفقیت انجام شد'})

    @action(detail=True, methods=['get'])
    def followers(self, request, username=None):
        user = self.get_object()
        followers = Follow.objects.filter(following=user).select_related('follower')
        serializer = FollowSerializer(followers, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def following(self, request, username=None):
        user = self.get_object()
        following = Follow.objects.filter(follower=user).select_related('following')
        serializer = FollowSerializer(following, many=True, context={'request': request})
        return Response(serializer.data)


class DoctorProfileViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DoctorProfile.objects.select_related('user').all()
    serializer_class = DoctorProfileSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    lookup_field = 'user__username'
    lookup_value_regex = r'[\w.@+-]+'

    def get_queryset(self):
        queryset = super().get_queryset()
        specialty = self.request.query_params.get('specialty')
        city = self.request.query_params.get('city')
        search = self.request.query_params.get('search')
        verified_only = self.request.query_params.get('verified_only')
        if specialty:
            queryset = queryset.filter(specialty=specialty)
        if city:
            queryset = queryset.filter(city__icontains=city)
        if search:
            try:
                from explore.services import parse_smart_query
                parsed = parse_smart_query(search)
                if parsed.get('specialty'):
                    queryset = queryset.filter(specialty=parsed['specialty'])
                if parsed.get('city'):
                    queryset = queryset.filter(city__icontains=parsed['city'])
                search = parsed.get('text') or ''
            except Exception:
                pass
        if search:
            queryset = queryset.filter(
                Q(user__username__icontains=search)
                | Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
                | Q(clinic_name__icontains=search)
                | Q(city__icontains=search)
            )
        if verified_only == 'true':
            queryset = queryset.filter(is_verified=True)
        return queryset.order_by('-algorithm_score')

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def my_profile(self, request):
        if request.user.user_type != 'doctor':
            return Response(
                {'error': 'شما پزشک نیستید'},
                status=status.HTTP_403_FORBIDDEN,
            )
        profile = get_object_or_404(DoctorProfile, user=request.user)
        serializer = self.get_serializer(profile)
        return Response(serializer.data)

    @action(detail=False, methods=['put', 'patch'], permission_classes=[permissions.IsAuthenticated])
    def update_my_profile(self, request):
        if request.user.user_type != 'doctor':
            return Response(
                {'error': 'شما پزشک نیستید'},
                status=status.HTTP_403_FORBIDDEN,
            )
        profile = get_object_or_404(DoctorProfile, user=request.user)
        serializer = DoctorProfileUpdateSerializer(
            profile,
            data=request.data,
            partial=True,
        )
        if serializer.is_valid():
            serializer.save()
            profile.update_algorithm_score()
            return Response(
                DoctorProfileSerializer(profile, context={'request': request}).data
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def set_layout(self, request):
        if request.user.user_type != 'doctor':
            return Response(
                {'error': 'شما پزشک نیستید'},
                status=status.HTTP_403_FORBIDDEN,
            )
        layout = request.data.get('profile_layout')
        valid_layouts = {value for value, _ in DoctorProfile.PROFILE_LAYOUT_CHOICES}
        if layout not in valid_layouts:
            return Response(
                {'profile_layout': 'حالت نمایش پروفایل نامعتبر است.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        profile = get_object_or_404(DoctorProfile, user=request.user)
        profile.profile_layout = layout
        profile.save(update_fields=['profile_layout'])
        return Response(DoctorProfileSerializer(profile, context={'request': request}).data)


class ClinicProfileViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ClinicProfile.objects.select_related('user').all()
    serializer_class = ClinicProfileSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    lookup_field = 'user__username'
    lookup_value_regex = r'[\w.@+-]+'

    def get_queryset(self):
        queryset = super().get_queryset()
        city = self.request.query_params.get('city')
        search = self.request.query_params.get('search')
        if city:
            queryset = queryset.filter(city__icontains=city)
        if search:
            try:
                from explore.services import parse_smart_query
                parsed = parse_smart_query(search)
                if parsed.get('city'):
                    queryset = queryset.filter(city__icontains=parsed['city'])
                search = parsed.get('text') or ''
            except Exception:
                pass
        if search:
            queryset = queryset.filter(
                Q(official_name__icontains=search)
                | Q(city__icontains=search)
                | Q(user__username__icontains=search)
                | Q(services__icontains=search)
            )
        return queryset.order_by('-algorithm_score')

    @action(detail=True, methods=['get'])
    def doctors(self, request, user__username=None):
        clinic = self.get_object()
        doctors = DoctorProfile.objects.filter(
            linked_clinic=clinic,
        ).select_related('user')
        return Response(
            DoctorProfileSerializer(
                doctors, many=True, context={'request': request},
            ).data,
        )

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def join(self, request, user__username=None):
        if request.user.user_type != 'doctor':
            return Response(
                {'error': 'فقط پزشکان می‌توانند عضو کلینیک شوند'},
                status=status.HTTP_403_FORBIDDEN,
            )
        clinic = self.get_object()
        doctor = get_object_or_404(DoctorProfile, user=request.user)
        doctor.linked_clinic = clinic
        doctor.clinic_name = clinic.official_name
        doctor.city = doctor.city or clinic.city
        doctor.save(update_fields=['linked_clinic', 'clinic_name', 'city'])
        doctor.update_algorithm_score()
        clinic.update_algorithm_score()
        return Response({
            'message': 'عضویت پزشک در کلینیک ثبت شد',
            'doctor': DoctorProfileSerializer(doctor, context={'request': request}).data,
            'clinic': ClinicProfileSerializer(clinic, context={'request': request}).data,
        })

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def leave(self, request, user__username=None):
        if request.user.user_type != 'doctor':
            return Response(
                {'error': 'فقط پزشکان می‌توانند از کلینیک خارج شوند'},
                status=status.HTTP_403_FORBIDDEN,
            )
        clinic = self.get_object()
        doctor = get_object_or_404(DoctorProfile, user=request.user)
        if doctor.linked_clinic_id != clinic.id:
            return Response(
                {'error': 'شما عضو این کلینیک نیستید'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        doctor.linked_clinic = None
        doctor.save(update_fields=['linked_clinic'])
        doctor.update_algorithm_score()
        clinic.update_algorithm_score()
        return Response({'message': 'عضویت شما از این کلینیک حذف شد'})

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def remove_doctor(self, request, user__username=None):
        clinic = self.get_object()
        if clinic.user_id != request.user.id:
            return Response(
                {'error': 'فقط مالک کلینیک می‌تواند پزشک را حذف کند'},
                status=status.HTTP_403_FORBIDDEN,
            )
        doctor_username = (request.data.get('doctor_username') or '').strip()
        if not doctor_username:
            return Response(
                {'doctor_username': 'نام کاربری پزشک الزامی است'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        doctor = get_object_or_404(
            DoctorProfile,
            user__username__iexact=doctor_username,
            linked_clinic=clinic,
        )
        doctor.linked_clinic = None
        doctor.save(update_fields=['linked_clinic'])
        doctor.update_algorithm_score()
        clinic.update_algorithm_score()
        return Response({'message': 'پزشک از کلینیک حذف شد'})

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def my_profile(self, request):
        if request.user.user_type != 'clinic':
            return Response({'error': 'شما کلینیک نیستید'}, status=status.HTTP_403_FORBIDDEN)
        profile = get_object_or_404(ClinicProfile, user=request.user)
        return Response(self.get_serializer(profile).data)

    @action(detail=False, methods=['put', 'patch'], permission_classes=[permissions.IsAuthenticated])
    def update_my_profile(self, request):
        if request.user.user_type != 'clinic':
            return Response({'error': 'شما کلینیک نیستید'}, status=status.HTTP_403_FORBIDDEN)
        profile = get_object_or_404(ClinicProfile, user=request.user)
        serializer = ClinicProfileUpdateSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            profile.update_algorithm_score()
            return Response(
                ClinicProfileSerializer(profile, context={'request': request}).data,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class WalletViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def me(self, request):
        wallet = get_or_create_wallet(request.user)
        return Response(WalletSerializer(wallet).data)

    @action(detail=False, methods=['post'])
    def deposit(self, request):
        if not settings.DEBUG and not getattr(settings, 'ALLOW_DIRECT_WALLET_DEPOSIT', False):
            return Response(
                {'error': 'شارژ مستقیم کیف پول در production غیرفعال است. از درگاه پرداخت استفاده کنید.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        amount = int(request.data.get('amount', 0))
        if amount < 10000:
            return Response(
                {'error': 'حداقل مبلغ شارژ ۱۰٬۰۰۰ تومان است'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if amount > 50_000_000:
            return Response(
                {'error': 'حداکثر مبلغ شارژ ۵۰٬۰۰۰٬۰۰۰ تومان است'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        wallet = get_or_create_wallet(request.user)
        try:
            wallet = deposit(wallet, amount, description='شارژ کیف پول')
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            'message': 'کیف پول شارژ شد',
            'wallet': WalletSerializer(wallet).data,
        })


def login_page(request):
    return render(request, 'auth/login.html')


def register_page(request):
    return render(request, 'auth/register.html')
