from django.db import models
from django.conf import settings
from django.core.validators import FileExtensionValidator
from django.utils import timezone
from datetime import timedelta


class Post(models.Model):
    PRIVACY_CHOICES = [
        ('public', 'عمومی'),
        ('followers', 'فالوورها'),
        ('private', 'خصوصی'),
    ]
    
    MEDIA_TYPE_CHOICES = [
        ('image', 'تصویر'),
        ('video', 'ویدیو'),
    ]
    
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='posts',
        verbose_name='نویسنده'
    )
    
    # پشتیبانی از تصویر و ویدیو
    media_type = models.CharField(
        max_length=10,
        choices=MEDIA_TYPE_CHOICES,
        default='image',
        verbose_name='نوع رسانه'
    )
    image = models.ImageField(
        upload_to='posts/%Y/%m/%d/',
        validators=[FileExtensionValidator(['jpg', 'jpeg', 'png', 'gif', 'webp'])],
        blank=True,
        null=True,
        verbose_name='تصویر'
    )
    video = models.FileField(
        upload_to='posts/videos/%Y/%m/%d/',
        validators=[FileExtensionValidator(['mp4', 'mov', 'avi', 'mkv', 'webm'])],
        blank=True,
        null=True,
        verbose_name='ویدیو'
    )
    thumbnail = models.ImageField(
        upload_to='posts/thumbnails/%Y/%m/%d/',
        blank=True,
        null=True,
        verbose_name='تصویر بندانگشتی ویدیو'
    )
    
    caption = models.TextField(
        max_length=2200,
        blank=True,
        verbose_name='توضیحات'
    )
    location = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='موقعیت مکانی'
    )
    privacy = models.CharField(
        max_length=20,
        choices=PRIVACY_CHOICES,
        default='public',
        verbose_name='حریم خصوصی'
    )
    comments_enabled = models.BooleanField(
        default=True,
        verbose_name='فعال بودن نظرات'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاریخ ایجاد')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='تاریخ بروزرسانی')
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'پست'
        verbose_name_plural = 'پست‌ها'
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['author', '-created_at']),
            models.Index(fields=['media_type']),
        ]
    
    def __str__(self):
        return f"{self.author.username} - {self.created_at.strftime('%Y-%m-%d')}"
    
    def clean(self):
        from django.core.exceptions import ValidationError
        
        # حداقل یکی از image یا video باید پر باشد
        if not self.image and not self.video:
            raise ValidationError('باید حداقل یک تصویر یا ویدیو آپلود کنید')
        
        # اگر media_type=image باشد، image باید پر باشد
        if self.media_type == 'image' and not self.image:
            raise ValidationError('برای پست تصویری، باید تصویر آپلود کنید')
        
        # اگر media_type=video باشد، video باید پر باشد
        if self.media_type == 'video' and not self.video:
            raise ValidationError('برای پست ویدیویی، باید ویدیو آپلود کنید')
    
    def save(self, *args, **kwargs):
        # تشخیص خودکار نوع رسانه
        if self.video and not self.image:
            self.media_type = 'video'
        elif self.image and not self.video:
            self.media_type = 'image'
        
        super().save(*args, **kwargs)
    
    @property
    def likes_count(self):
        return self.likes.count()
    
    @property
    def comments_count(self):
        return self.comments.count()
    
    def is_liked_by(self, user):
        return self.likes.filter(user=user).exists()
    
    def is_saved_by(self, user):
        return self.saved_by.filter(user=user).exists()
    
    @property
    def media_url(self):
        """URL رسانه اصلی (تصویر یا ویدیو)"""
        if self.media_type == 'video' and self.video:
            return self.video.url
        elif self.image:
            return self.image.url
        return None


class Like(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='likes',
        verbose_name='کاربر'
    )
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name='likes',
        verbose_name='پست'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاریخ لایک')
    
    class Meta:
        unique_together = ['user', 'post']
        ordering = ['-created_at']
        verbose_name = 'لایک'
        verbose_name_plural = 'لایک‌ها'
        indexes = [
            models.Index(fields=['post', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.user.username} liked {self.post.id}"


class Comment(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='comments',
        verbose_name='کاربر'
    )
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name='comments',
        verbose_name='پست'
    )
    text = models.TextField(
        max_length=500,
        verbose_name='متن نظر'
    )
    parent = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='replies',
        verbose_name='پاسخ به'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاریخ ایجاد')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='تاریخ بروزرسانی')
    
    class Meta:
        ordering = ['created_at']
        verbose_name = 'نظر'
        verbose_name_plural = 'نظرات'
        indexes = [
            models.Index(fields=['post', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.user.username} on {self.post.id}"


class SavedPost(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='saved_posts',
        verbose_name='کاربر'
    )
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name='saved_by',
        verbose_name='پست'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاریخ ذخیره')
    
    class Meta:
        unique_together = ['user', 'post']
        ordering = ['-created_at']
        verbose_name = 'پست ذخیره شده'
        verbose_name_plural = 'پست‌های ذخیره شده'
    
    def __str__(self):
        return f"{self.user.username} saved {self.post.id}"


class Story(models.Model):
    MEDIA_TYPE_CHOICES = [
        ('image', 'تصویر'),
        ('video', 'ویدیو'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='stories',
        verbose_name='کاربر'
    )
    
    media_type = models.CharField(
        max_length=10,
        choices=MEDIA_TYPE_CHOICES,
        default='image',
        verbose_name='نوع رسانه'
    )
    image = models.ImageField(
        upload_to='stories/%Y/%m/%d/',
        validators=[FileExtensionValidator(['jpg', 'jpeg', 'png', 'webp'])],
        blank=True,
        null=True,
        verbose_name='تصویر'
    )
    video = models.FileField(
        upload_to='stories/videos/%Y/%m/%d/',
        validators=[FileExtensionValidator(['mp4', 'mov', 'webm'])],
        blank=True,
        null=True,
        verbose_name='ویدیو'
    )
    
    caption = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='توضیحات'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاریخ ایجاد')
    expires_at = models.DateTimeField(verbose_name='تاریخ انقضا')
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'استوری'
        verbose_name_plural = 'استوری‌ها'
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['expires_at']),
        ]
    
    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=24)
        
        # تشخیص خودکار نوع رسانه
        if self.video and not self.image:
            self.media_type = 'video'
        elif self.image and not self.video:
            self.media_type = 'image'
        
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.user.username} - {self.created_at.strftime('%Y-%m-%d %H:%M')}"
    
    @property
    def is_expired(self):
        return timezone.now() > self.expires_at
    
    @property
    def media_url(self):
        """URL رسانه اصلی"""
        if self.media_type == 'video' and self.video:
            return self.video.url
        elif self.image:
            return self.image.url
        return None


class Review(models.Model):
    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='given_reviews',
        verbose_name='بیمار'
    )
    doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_reviews',
        verbose_name='پزشک'
    )
    rating = models.PositiveSmallIntegerField(
        choices=[(i, i) for i in range(1, 6)],
        verbose_name='امتیاز'
    )
    comment = models.TextField(
        max_length=1000,
        blank=True,
        verbose_name='نظر'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاریخ ایجاد')
    
    class Meta:
        unique_together = ('patient', 'doctor')
        verbose_name = 'نظر'
        verbose_name_plural = 'نظرات'
        indexes = [
            models.Index(fields=['doctor', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.patient.username} rated {self.doctor.username}: {self.rating}/5"
