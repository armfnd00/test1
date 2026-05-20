from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from django.db.models import Q, Count
from django.utils import timezone
from .models import Post, Comment, Story, Review, Like, SavedPost
from .serializers import (
    PostSerializer, PostListSerializer, CommentSerializer,
    StorySerializer, ReviewSerializer
)
from .permissions import IsAuthorOrReadOnly


class PostViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['caption', 'location', 'author__username']
    ordering_fields = ['created_at', 'likes__count']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'list' or self.action in ['feed', 'explore']:
            return PostListSerializer
        return PostSerializer
    
    def get_queryset(self):
        user = self.request.user
        
        if user.is_authenticated:
            # نمایش پست‌های عمومی + پست‌های خود کاربر + پست‌های followers از افرادی که فالو کرده
            following_users = user.following.values_list('following', flat=True)
            
            return Post.objects.filter(
                Q(privacy='public') |
                Q(author=user) |
                Q(privacy='followers', author__in=following_users)
            ).select_related('author').prefetch_related('likes', 'comments').distinct()
        else:
            # کاربران مهمان فقط پست‌های عمومی
            return Post.objects.filter(privacy='public').select_related('author').prefetch_related('likes', 'comments')
    
    def perform_create(self, serializer):
        serializer.save(author=self.request.user)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def feed(self, request):
        """فید شخصی: پست‌های افرادی که کاربر فالو کرده"""
        following_users = request.user.following.values_list('following', flat=True)
        posts = Post.objects.filter(
            author__in=following_users
        ).filter(
            Q(privacy='public') | Q(privacy='followers')
        ).select_related('author').prefetch_related('likes', 'comments').order_by('-created_at')
        
        page = self.paginate_queryset(posts)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(posts, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def explore(self, request):
        """اکسپلور: پست‌های عمومی پرطرفدار"""
        posts = Post.objects.filter(
            privacy='public'
        ).annotate(
            likes_count=Count('likes')
        ).order_by('-likes_count', '-created_at')[:50]
        
        page = self.paginate_queryset(posts)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(posts, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def like(self, request, pk=None):
        """لایک کردن پست"""
        post = self.get_object()
        like, created = Like.objects.get_or_create(user=request.user, post=post)
        
        if created:
            return Response({'status': 'liked'}, status=status.HTTP_201_CREATED)
        return Response({'status': 'already liked'}, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def unlike(self, request, pk=None):
        """حذف لایک"""
        post = self.get_object()
        deleted_count, _ = Like.objects.filter(user=request.user, post=post).delete()
        
        if deleted_count:
            return Response({'status': 'unliked'}, status=status.HTTP_200_OK)
        return Response({'status': 'not liked'}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def save(self, request, pk=None):
        """ذخیره پست"""
        post = self.get_object()
        saved, created = SavedPost.objects.get_or_create(user=request.user, post=post)
        
        if created:
            return Response({'status': 'saved'}, status=status.HTTP_201_CREATED)
        return Response({'status': 'already saved'}, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def unsave(self, request, pk=None):
        """حذف از ذخیره‌ها"""
        post = self.get_object()
        deleted_count, _ = SavedPost.objects.filter(user=request.user, post=post).delete()
        
        if deleted_count:
            return Response({'status': 'unsaved'}, status=status.HTTP_200_OK)
        return Response({'status': 'not saved'}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def saved(self, request):
        """لیست پست‌های ذخیره شده"""
        saved_posts = SavedPost.objects.filter(
            user=request.user
        ).select_related('post__author').prefetch_related('post__likes', 'post__comments')
        
        posts = [sp.post for sp in saved_posts]
        
        page = self.paginate_queryset(posts)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(posts, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get', 'post'], permission_classes=[IsAuthenticatedOrReadOnly])
    def comments(self, request, pk=None):
        """مدیریت نظرات یک پست"""
        post = self.get_object()
        
        if request.method == 'GET':
            comments = post.comments.filter(parent__isnull=True).select_related('user').prefetch_related('replies')
            serializer = CommentSerializer(comments, many=True, context={'request': request})
            return Response(serializer.data)
        
        elif request.method == 'POST':
            if not post.comments_enabled:
                return Response(
                    {'error': 'نظرات برای این پست غیرفعال است'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            serializer = CommentSerializer(data=request.data, context={'request': request})
            if serializer.is_valid():
                serializer.save(user=request.user, post=post)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.all().select_related('user', 'post').prefetch_related('replies')
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly]
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def reply(self, request, pk=None):
        """پاسخ به نظر"""
        parent_comment = self.get_object()
        
        if not parent_comment.post.comments_enabled:
            return Response(
                {'error': 'نظرات برای این پست غیرفعال است'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = CommentSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save(
                user=request.user,
                post=parent_comment.post,
                parent=parent_comment
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class StoryViewSet(viewsets.ModelViewSet):
    serializer_class = StorySerializer
    permission_classes = [IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly]
    
    def get_queryset(self):
        user = self.request.user
        now = timezone.now()
        
        if user.is_authenticated:
            following_users = user.following.values_list('following', flat=True)
            return Story.objects.filter(
                Q(user=user) | Q(user__in=following_users),
                expires_at__gt=now
            ).select_related('user').order_by('-created_at')
        else:
            return Story.objects.filter(expires_at__gt=now).select_related('user').order_by('-created_at')
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_stories(self, request):
        """استوری‌های خود کاربر"""
        now = timezone.now()
        stories = Story.objects.filter(
            user=request.user,
            expires_at__gt=now
        ).order_by('-created_at')
        
        serializer = self.get_serializer(stories, many=True)
        return Response(serializer.data)


class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.all().select_related('patient', 'doctor')
    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['created_at', 'rating']
    ordering = ['-created_at']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        doctor_id = self.request.query_params.get('doctor_id')
        if doctor_id:
            queryset = queryset.filter(doctor_id=doctor_id)
        return queryset
    
    def perform_create(self, serializer):
        serializer.save(patient=self.request.user)
