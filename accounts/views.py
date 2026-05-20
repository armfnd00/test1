from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate, get_user_model
from django.shortcuts import get_object_or_404
from django.shortcuts import render
from .models import DoctorProfile, Follow
from .serializers import (
    UserSerializer, RegisterSerializer, 
    DoctorProfileSerializer, FollowSerializer
)

User = get_user_model()


class AuthViewSet(viewsets.GenericViewSet):
    """
    ViewSet برای احراز هویت (ثبت‌نام، ورود، خروج)
    """
    permission_classes = [permissions.AllowAny]
    
    @action(detail=False, methods=['post'])
    def register(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            token, _ = Token.objects.get_or_create(user=user)
            
            # اگر کاربر پزشک است، پروفایل پزشک بسازیم
            if user.user_type == 'doctor':
                DoctorProfile.objects.create(user=user)
            
            return Response({
                'token': token.key,
                'user': UserSerializer(user).data,
                'message': 'ثبت‌نام با موفقیت انجام شد'
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def login(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        
        if not username or not password:
            return Response({
                'error': 'نام کاربری و رمز عبور الزامی است'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        user = authenticate(username=username, password=password)
        
        if user:
            token, _ = Token.objects.get_or_create(user=user)
            return Response({
                'token': token.key,
                'user': UserSerializer(user).data,
                'message': 'ورود موفقیت‌آمیز بود'
            })
        
        return Response({
            'error': 'نام کاربری یا رمز عبور اشتباه است'
        }, status=status.HTTP_401_UNAUTHORIZED)
    
    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def logout(self, request):
        request.user.auth_token.delete()
        return Response({
            'message': 'خروج موفقیت‌آمیز بود'
        })


class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet برای مدیریت کاربران و پروفایل‌ها
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        user_type = self.request.query_params.get('user_type')
        if user_type:
            queryset = queryset.filter(user_type=user_type)
        return queryset
    
    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        """دریافت اطلاعات کاربر جاری"""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)
    
    @action(detail=False, methods=['put', 'patch'], permission_classes=[permissions.IsAuthenticated])
    def update_profile(self, request):
        """بروزرسانی پروفایل کاربر جاری"""
        serializer = self.get_serializer(
            request.user, 
            data=request.data, 
            partial=True
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def follow(self, request, pk=None):
        """فالو کردن یک کاربر"""
        user_to_follow = self.get_object()
        
        if user_to_follow == request.user:
            return Response({
                'error': 'نمی‌توانید خودتان را فالو کنید'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        follow, created = Follow.objects.get_or_create(
            follower=request.user,
            following=user_to_follow
        )
        
        if not created:
            return Response({
                'message': 'شما قبلاً این کاربر را فالو کرده‌اید'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # بروزرسانی امتیاز الگوریتم اگر پزشک است
        if user_to_follow.user_type == 'doctor':
            try:
                user_to_follow.doctor_profile.update_algorithm_score()
            except DoctorProfile.DoesNotExist:
                pass
        
        return Response({
            'message': 'فالو با موفقیت انجام شد'
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def unfollow(self, request, pk=None):
        """آنفالو کردن یک کاربر"""
        user_to_unfollow = self.get_object()
        
        deleted_count, _ = Follow.objects.filter(
            follower=request.user,
            following=user_to_unfollow
        ).delete()
        
        if deleted_count == 0:
            return Response({
                'error': 'شما این کاربر را فالو نکرده‌اید'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # بروزرسانی امتیاز الگوریتم اگر پزشک است
        if user_to_unfollow.user_type == 'doctor':
            try:
                user_to_unfollow.doctor_profile.update_algorithm_score()
            except DoctorProfile.DoesNotExist:
                pass
        
        return Response({
            'message': 'آنفالو با موفقیت انجام شد'
        })
    
    @action(detail=True, methods=['get'])
    def followers(self, request, pk=None):
        """لیست فالوورهای یک کاربر"""
        user = self.get_object()
        followers = Follow.objects.filter(following=user).select_related('follower')
        serializer = FollowSerializer(followers, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def following(self, request, pk=None):
        """لیست فالوینگ‌های یک کاربر"""
        user = self.get_object()
        following = Follow.objects.filter(follower=user).select_related('following')
        serializer = FollowSerializer(following, many=True)
        return Response(serializer.data)


class DoctorProfileViewSet(viewsets.ModelViewSet):
    """
    ViewSet برای مدیریت پروفایل پزشکان
    """
    queryset = DoctorProfile.objects.select_related('user').all()
    serializer_class = DoctorProfileSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # فیلتر بر اساس تخصص
        specialty = self.request.query_params.get('specialty')
        if specialty:
            queryset = queryset.filter(specialty=specialty)
        
        # فیلتر بر اساس شهر
        city = self.request.query_params.get('city')
        if city:
            queryset = queryset.filter(city__icontains=city)
        
        # فقط پزشکان تایید شده
        verified_only = self.request.query_params.get('verified_only')
        if verified_only == 'true':
            queryset = queryset.filter(is_verified=True)
        
        return queryset
    
    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def my_profile(self, request):
        """دریافت پروفایل پزشکی کاربر جاری"""
        if request.user.user_type != 'doctor':
            return Response({
                'error': 'شما پزشک نیستید'
            }, status=status.HTTP_403_FORBIDDEN)
        
        profile = get_object_or_404(DoctorProfile, user=request.user)
        serializer = self.get_serializer(profile)
        return Response(serializer.data)
    
    @action(detail=False, methods=['put', 'patch'], permission_classes=[permissions.IsAuthenticated])
    def update_my_profile(self, request):
        """بروزرسانی پروفایل پزشکی کاربر جاری"""
        if request.user.user_type != 'doctor':
            return Response({
                'error': 'شما پزشک نیستید'
            }, status=status.HTTP_403_FORBIDDEN)
        
        profile = get_object_or_404(DoctorProfile, user=request.user)
        serializer = self.get_serializer(
            profile, 
            data=request.data, 
            partial=True
        )
        if serializer.is_valid():
            serializer.save()
            profile.update_algorithm_score()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    

def login_page(request):
    """صفحه HTML ورود"""
    return render(request, 'auth/login.html')


def register_page(request):
    """صفحه HTML ثبت‌نام"""
    return render(request, 'auth/register.html')
