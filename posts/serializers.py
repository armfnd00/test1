from rest_framework import serializers
from .models import Post, Like, Comment, SavedPost, Story, Review
from accounts.serializers import UserSerializer


class CommentSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    replies_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Comment
        fields = [
            'id', 'user', 'post', 'text', 'parent',
            'replies_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['user', 'created_at', 'updated_at']
    
    def get_replies_count(self, obj):
        return obj.replies.count()


class PostListSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    likes_count = serializers.IntegerField(source='likes.count', read_only=True)
    comments_count = serializers.IntegerField(source='comments.count', read_only=True)
    is_liked = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()
    media_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Post
        fields = [
            'id', 'author', 'media_type', 'image', 'video', 'thumbnail',
            'media_url', 'caption', 'location', 'privacy',
            'comments_enabled', 'likes_count', 'comments_count',
            'is_liked', 'is_saved', 'created_at'
        ]
    
    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.is_liked_by(request.user)
        return False
    
    def get_is_saved(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.is_saved_by(request.user)
        return False
    
    def get_media_url(self, obj):
        request = self.context.get('request')
        media_url = obj.media_url
        if media_url and request:
            return request.build_absolute_uri(media_url)
        return media_url


class PostSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    likes_count = serializers.IntegerField(source='likes.count', read_only=True)
    comments_count = serializers.IntegerField(source='comments.count', read_only=True)
    is_liked = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()
    comments = CommentSerializer(many=True, read_only=True)
    media_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Post
        fields = [
            'id', 'author', 'media_type', 'image', 'video', 'thumbnail',
            'media_url', 'caption', 'location', 'privacy',
            'comments_enabled', 'likes_count', 'comments_count',
            'is_liked', 'is_saved', 'comments', 'created_at', 'updated_at'
        ]
        read_only_fields = ['author', 'created_at', 'updated_at']
    
    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.is_liked_by(request.user)
        return False
    
    def get_is_saved(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.is_saved_by(request.user)
        return False
    
    def get_media_url(self, obj):
        request = self.context.get('request')
        media_url = obj.media_url
        if media_url and request:
            return request.build_absolute_uri(media_url)
        return media_url


class StorySerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    media_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Story
        fields = [
            'id', 'user', 'media_type', 'image', 'video',
            'media_url', 'caption', 'created_at', 'expires_at', 'is_expired'
        ]
        read_only_fields = ['user', 'created_at', 'expires_at']
    
    def get_media_url(self, obj):
        request = self.context.get('request')
        media_url = obj.media_url
        if media_url and request:
            return request.build_absolute_uri(media_url)
        return media_url


class ReviewSerializer(serializers.ModelSerializer):
    patient = UserSerializer(read_only=True)
    doctor_username = serializers.CharField(write_only=True)
    
    class Meta:
        model = Review
        fields = [
            'id', 'patient', 'doctor', 'doctor_username',
            'rating', 'comment', 'created_at'
        ]
        read_only_fields = ['patient', 'doctor', 'created_at']
    
    def create(self, validated_data):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        doctor_username = validated_data.pop('doctor_username')
        try:
            doctor = User.objects.get(username=doctor_username, user_type='doctor')
        except User.DoesNotExist:
            raise serializers.ValidationError({'doctor_username': 'پزشک یافت نشد'})
        
        validated_data['doctor'] = doctor
        validated_data['patient'] = self.context['request'].user
        
        return super().create(validated_data)
