from rest_framework import serializers
from .models import Post, PostMedia, Like, Comment, SavedPost, Story, Review
from accounts.serializers import UserSerializer


class PostMediaSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    label_display = serializers.CharField(source='get_label_display', read_only=True)

    class Meta:
        model = PostMedia
        fields = ['id', 'url', 'order', 'label', 'label_display']

    def get_url(self, obj):
        request = self.context.get('request')
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return obj.image.url if obj.image else None


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
        extra_kwargs = {
            'post': {'required': False},
            'parent': {'required': False, 'allow_null': True},
        }
    
    def get_replies_count(self, obj):
        return obj.replies.count()


class PostListSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    likes_count = serializers.SerializerMethodField()
    comments_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()
    media_url = serializers.SerializerMethodField()
    media_items = PostMediaSerializer(many=True, read_only=True)
    post_type_display = serializers.CharField(source='get_post_type_display', read_only=True)
    
    class Meta:
        model = Post
        fields = [
            'id', 'author', 'post_type', 'post_type_display', 'media_type',
            'image', 'video', 'thumbnail', 'media_url', 'media_items',
            'caption', 'description', 'location', 'privacy',
            'comments_enabled', 'likes_count', 'comments_count',
            'is_liked', 'is_saved', 'created_at',
        ]
    
    def get_likes_count(self, obj):
        if hasattr(obj, 'likes_total'):
            return obj.likes_total
        return obj.likes.count()

    def get_comments_count(self, obj):
        if hasattr(obj, 'comments_total'):
            return obj.comments_total
        return obj.comments.count()

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
    likes_count = serializers.SerializerMethodField()
    comments_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()
    comments = CommentSerializer(many=True, read_only=True)
    media_url = serializers.SerializerMethodField()
    media_items = PostMediaSerializer(many=True, read_only=True)
    post_type_display = serializers.CharField(source='get_post_type_display', read_only=True)
    
    class Meta:
        model = Post
        fields = [
            'id', 'author', 'post_type', 'post_type_display', 'media_type', 'image', 'video', 'thumbnail',
            'media_url', 'media_items', 'caption', 'description', 'location', 'privacy',
            'comments_enabled', 'likes_count', 'comments_count',
            'is_liked', 'is_saved', 'comments', 'created_at', 'updated_at',
        ]
        read_only_fields = ['author', 'created_at', 'updated_at']
    
    def get_likes_count(self, obj):
        if hasattr(obj, 'likes_total'):
            return obj.likes_total
        return obj.likes.count()

    def get_comments_count(self, obj):
        if hasattr(obj, 'comments_total'):
            return obj.comments_total
        return obj.comments.count()

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

    def validate(self, attrs):
        image = attrs.get('image')
        video = attrs.get('video')
        if self.instance:
            image = image if image is not None else self.instance.image
            video = video if video is not None else self.instance.video
        if not image and not video:
            raise serializers.ValidationError('حداقل یک تصویر یا ویدیو انتخاب کنید.')
        if video:
            attrs['media_type'] = 'video'
        elif image:
            attrs['media_type'] = 'image'
        return attrs


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

    def validate(self, attrs):
        image = attrs.get('image')
        video = attrs.get('video')
        if self.instance:
            image = image if image is not None else self.instance.image
            video = video if video is not None else self.instance.video
        if not image and not video:
            raise serializers.ValidationError(
                'حداقل یک تصویر یا ویدیو انتخاب کنید.'
            )
        if video:
            attrs['media_type'] = 'video'
        elif image:
            attrs['media_type'] = 'image'
        return attrs


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
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError('برای ثبت نظر وارد شوید.')
        if request.user.user_type != 'patient':
            raise serializers.ValidationError('فقط بیماران می‌توانند نظر ثبت کنند.')

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
