from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone

class TimeSlot(models.Model):
    doctor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='time_slots')
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_available = models.BooleanField(default=True)
    
    class Meta:
        unique_together = ('doctor', 'date', 'start_time')
        ordering = ['date', 'start_time']
        indexes = [
            models.Index(fields=['doctor', 'date', 'is_available']),
        ]
    
    def clean(self):
        if self.start_time >= self.end_time:
            raise ValidationError('زمان شروع باید قبل از زمان پایان باشد')
        
        if self.date < timezone.now().date():
            raise ValidationError('نمی‌توانید برای گذشته زمان تعریف کنید')
    
    def __str__(self):
        return f"{self.doctor.username} - {self.date} {self.start_time}-{self.end_time}"

class Appointment(models.Model):
    STATUS_CHOICES = (
        ('pending', 'در انتظار پرداخت'),
        ('confirmed', 'تایید شده'),
        ('completed', 'انجام شده'),
        ('cancelled', 'لغو شده'),
    )
    
    patient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='patient_appointments')
    doctor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='doctor_appointments')
    time_slot = models.OneToOneField(TimeSlot, on_delete=models.CASCADE, related_name='appointment')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    payment_amount = models.PositiveIntegerField()
    payment_status = models.BooleanField(default=False)
    payment_ref_id = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['patient', '-created_at']),
            models.Index(fields=['doctor', 'status']),
        ]
    
    def __str__(self):
        return f"Appointment: {self.patient.username} with Dr. {self.doctor.username}"
    
    def confirm_payment(self, ref_id):
        """تایید پرداخت و رزرو نوبت"""
        self.payment_status = True
        self.payment_ref_id = ref_id
        self.status = 'confirmed'
        self.time_slot.is_available = False
        self.time_slot.save()
        self.save()
