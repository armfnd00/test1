from django.contrib.auth.models import AbstractUser
from django.db import models
from django.core.validators import RegexValidator

class User(AbstractUser):
    USER_TYPE_CHOICES = (
        ('patient', 'بیمار'),
        ('doctor', 'پزشک'),
    )
    
    user_type = models.CharField(max_length=10, choices=USER_TYPE_CHOICES, default='patient')
    phone_regex = RegexValidator(regex=r'^09\d{9}$', message="شماره موبایل باید به فرمت 09xxxxxxxxx باشد")
    phone = models.CharField(validators=[phone_regex], max_length=11, unique=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    bio = models.TextField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.username} ({self.get_user_type_display()})"

class DoctorProfile(models.Model):
    SPECIALTY_CHOICES = (
        ('skin', 'پوست و مو'),
        ('nose', 'بینی'),
        ('face', 'زیبایی صورت'),
        ('body', 'زیبایی بدن'),
        ('dental', 'دندانپزشکی زیبایی'),
        ('hair', 'کاشت مو'),
    )
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='doctor_profile')
    specialty = models.CharField(max_length=20, choices=SPECIALTY_CHOICES)
    license_number = models.CharField(max_length=50, unique=True)
    experience_years = models.PositiveIntegerField(default=0)
    city = models.CharField(max_length=100)
    address = models.TextField()
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    clinic_name = models.CharField(max_length=200)
    consultation_fee = models.PositiveIntegerField(default=0, help_text='هزینه ویزیت به تومان')
    algorithm_score = models.FloatField(default=0.0, db_index=True)
    is_verified = models.BooleanField(default=False)
    
    def __str__(self):
        return f"Dr. {self.user.get_full_name()} - {self.get_specialty_display()}"
    
    def update_algorithm_score(self):
        """محاسبه امتیاز الگوریتم بر اساس فالوورها، پست‌ها، نوبت‌ها و نظرات"""
        followers_count = self.user.followers.count()
        posts_count = self.user.posts.count()
        appointments_count = self.user.doctor_appointments.filter(status='completed').count()
        avg_rating = self.user.received_reviews.aggregate(models.Avg('rating'))['rating__avg'] or 0
        
        # فرمول امتیازدهی
        score = (
            followers_count * 2 +
            posts_count * 1.5 +
            appointments_count * 3 +
            avg_rating * 10
        )
        
        self.algorithm_score = score
        self.save(update_fields=['algorithm_score'])
        return score

class Follow(models.Model):
    follower = models.ForeignKey(User, on_delete=models.CASCADE, related_name='following')
    following = models.ForeignKey(User, on_delete=models.CASCADE, related_name='followers')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('follower', 'following')
        indexes = [
            models.Index(fields=['follower', 'created_at']),
            models.Index(fields=['following', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.follower.username} follows {self.following.username}"
