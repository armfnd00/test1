from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import DoctorProfile, Follow

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    followers_count = serializers.SerializerMethodField()
    following_count = serializers.SerializerMethodField()
    posts_count = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'phone', 'user_type', 'avatar', 
                  'bio', 'created_at', 'followers_count', 'following_count', 
                  'posts_count', 'is_following']
        read_only_fields = ['id', 'created_at']
    
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
                following=obj
            ).exists()
        return False


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = ['username', 'email', 'phone', 'password', 'password_confirm', 
                  'user_type', 'avatar', 'bio']
    
    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError("رمز عبور و تکرار آن مطابقت ندارند")
        return data
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()
        return user


class DoctorProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    reviews_count = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()
    
    class Meta:
        model = DoctorProfile
        fields = ['id', 'user', 'specialty', 'license_number', 'experience_years',
                  'city', 'address', 'latitude', 'longitude', 'clinic_name',
                  'consultation_fee', 'algorithm_score', 'is_verified',
                  'reviews_count', 'average_rating']
        read_only_fields = ['algorithm_score', 'is_verified']
    
    def get_reviews_count(self, obj):
        return obj.user.received_reviews.count()
    
    def get_average_rating(self, obj):
        from django.db.models import Avg
        result = obj.user.received_reviews.aggregate(Avg('rating'))
        return round(result['rating__avg'] or 0, 1)


class FollowSerializer(serializers.ModelSerializer):
    follower = UserSerializer(read_only=True)
    following = UserSerializer(read_only=True)
    
    class Meta:
        model = Follow
        fields = ['id', 'follower', 'following', 'created_at']
        read_only_fields = ['id', 'created_at']
