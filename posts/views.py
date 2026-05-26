from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.exceptions import PermissionDenied
from django.db.models import Q, Count, Prefetch
from django.utils import timezone
from django.core.exceptions import ValidationError as DjangoValidationError

from .models import Post, PostMedia, Comment, Story, Review, Like, SavedPost
from . import services as post_services
from .serializers import (
    PostSerializer, PostListSerializer, CommentSerializer,
    StorySerializer, ReviewSerializer,
)
from .permissions import IsAuthorOrReadOnly, IsDoctorOrReadOnly
from accounts.serializers import UserSerializer


class PostViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly, IsDoctorOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['caption', 'location', 'author__username']
    ordering_fields = ['created_at']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action in ('list', 'feed', 'explore'):
            return PostListSerializer
        return PostSerializer

    def get_queryset(self):
        user = self.request.user
        author_username = self.request.query_params.get('author')
        doctors_only = self.request.query_params.get('doctors_only')
        media_qs = PostMedia.objects.order_by('order')

        if user.is_authenticated:
            following_users = user.following.values_list('following', flat=True)
            queryset = Post.objects.filter(
                Q(privacy='public')
                | Q(author=user)
                | Q(privacy='followers', author__in=following_users)
            ).select_related('author').prefetch_related(
                Prefetch('media_items', queryset=media_qs),
                'likes', 'comments',
            ).annotate(
                likes_total=Count('likes', distinct=True),
                comments_total=Count('comments', distinct=True),
            ).distinct()
        else:
            queryset = Post.objects.filter(
                privacy='public',
            ).select_related('author').prefetch_related(
                Prefetch('media_items', queryset=media_qs),
            ).annotate(
                likes_total=Count('likes', distinct=True),
                comments_total=Count('comments', distinct=True),
            )

        if doctors_only == 'true':
            queryset = queryset.filter(author__user_type='doctor')

        if author_username:
            queryset = queryset.filter(author__username=author_username)
        return queryset

    def _require_patient_engagement(self, user):
        if user.user_type != 'patient':
            raise PermissionDenied('فقط بیماران ثبت‌نام‌شده می‌توانند لایک و نظر ثبت کنند.')

    def create(self, request, *args, **kwargs):
        if request.user.user_type not in ('doctor', 'clinic'):
            raise PermissionDenied('فقط پزشکان و کلینیک‌های زیبایی می‌توانند پست منتشر کنند.')
        try:
            post = post_services.create_doctor_post(
                request.user,
                post_type=request.data.get('post_type', 'standard'),
                caption=request.data.get('caption', ''),
                description=request.data.get('description', ''),
                location=request.data.get('location', ''),
                comments_enabled=request.data.get('comments_enabled', True),
                images=request.FILES.getlist('images') or request.FILES.getlist('image'),
                video=request.FILES.get('video'),
                labels_raw=request.data.get('labels', ''),
            )
        except DjangoValidationError as e:
            msg = e.messages[0] if getattr(e, 'messages', None) else str(e)
            return Response({'error': msg}, status=status.HTTP_400_BAD_REQUEST)

        serializer = PostSerializer(post, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def feed(self, request):
        following_users = request.user.following.values_list('following', flat=True)
        posts = Post.objects.filter(
            author__in=following_users,
            author__user_type='doctor',
        ).filter(
            Q(privacy='public') | Q(privacy='followers')
        ).select_related('author').prefetch_related('likes', 'comments').order_by('-created_at')

        page = self.paginate_queryset(posts)
        if page is not None:
            serializer = self.get_serializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(posts, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticatedOrReadOnly])
    def explore(self, request):
        """اکسپلور — هدایت به الگوریتم پیشرفته (سازگاری با API قدیم)."""
        from explore.services import explore_posts_queryset
        from explore.serializers import ExplorePostSerializer

        specialty = request.query_params.get('specialty')
        search = request.query_params.get('q') or request.query_params.get('search')
        qs = explore_posts_queryset(specialty=specialty, search=search)

        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = ExplorePostSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
        serializer = ExplorePostSerializer(qs[:50], many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def like(self, request, pk=None):
        self._require_patient_engagement(request.user)
        post = self.get_object()
        like, created = Like.objects.get_or_create(user=request.user, post=post)
        if created:
            try:
                from notifications.services import notify_like
                notify_like(post, request.user)
            except Exception:
                pass
            return Response({'status': 'liked'}, status=status.HTTP_201_CREATED)
        return Response({'status': 'already liked'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def unlike(self, request, pk=None):
        self._require_patient_engagement(request.user)
        post = self.get_object()
        deleted_count, _ = Like.objects.filter(user=request.user, post=post).delete()
        if deleted_count:
            return Response({'status': 'unliked'}, status=status.HTTP_200_OK)
        return Response({'status': 'not liked'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def save(self, request, pk=None):
        post = self.get_object()
        saved, created = SavedPost.objects.get_or_create(user=request.user, post=post)
        if created:
            return Response({'status': 'saved'}, status=status.HTTP_201_CREATED)
        return Response({'status': 'already saved'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def unsave(self, request, pk=None):
        post = self.get_object()
        deleted_count, _ = SavedPost.objects.filter(user=request.user, post=post).delete()
        if deleted_count:
            return Response({'status': 'unsaved'}, status=status.HTTP_200_OK)
        return Response({'status': 'not saved'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def saved(self, request):
        saved_posts = SavedPost.objects.filter(user=request.user).select_related(
            'post__author',
        ).prefetch_related('post__likes', 'post__comments')
        posts = [sp.post for sp in saved_posts]
        page = self.paginate_queryset(posts)
        if page is not None:
            serializer = self.get_serializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(posts, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['get', 'post'], permission_classes=[IsAuthenticatedOrReadOnly])
    def comments(self, request, pk=None):
        post = self.get_object()
        if request.method == 'GET':
            comments = post.comments.filter(parent__isnull=True).select_related('user')
            serializer = CommentSerializer(comments, many=True, context={'request': request})
            return Response(serializer.data)
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_401_UNAUTHORIZED)
        if not post.comments_enabled:
            return Response(
                {'error': 'نظرات برای این پست غیرفعال است'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = CommentSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            comment = serializer.save(user=request.user, post=post)
            try:
                from notifications.services import notify_comment
                notify_comment(comment)
            except Exception:
                pass
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.all().select_related('user', 'post')
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly]

    def perform_create(self, serializer):
        comment = serializer.save(user=self.request.user)
        try:
            from notifications.services import notify_comment
            notify_comment(comment)
        except Exception:
            pass

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def reply(self, request, pk=None):
        parent_comment = self.get_object()
        if not parent_comment.post.comments_enabled:
            return Response(
                {'error': 'نظرات برای این پست غیرفعال است'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = CommentSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            comment = serializer.save(
                user=request.user,
                post=parent_comment.post,
                parent=parent_comment,
            )
            try:
                from notifications.services import notify_comment
                notify_comment(comment)
            except Exception:
                pass
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class StoryViewSet(viewsets.ModelViewSet):
    serializer_class = StorySerializer
    permission_classes = [IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly, IsDoctorOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        now = timezone.now()
        if user.is_authenticated:
            following_users = user.following.values_list('following', flat=True)
            return Story.objects.filter(
                Q(user=user) | Q(user__in=following_users),
                user__user_type__in=('doctor', 'clinic'),
                expires_at__gt=now,
            ).select_related('user').order_by('-created_at')
        return Story.objects.filter(
            user__user_type__in=('doctor', 'clinic'),
            expires_at__gt=now,
        ).select_related('user').order_by('-created_at')

    def perform_create(self, serializer):
        if self.request.user.user_type not in ('doctor', 'clinic'):
            raise PermissionDenied('فقط پزشکان و کلینیک‌ها می‌توانند استوری منتشر کنند.')
        image = serializer.validated_data.get('image')
        if image:
            serializer.validated_data['image'] = post_services.optimize_image_upload(
                image,
                prefix='story',
            )
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_stories(self, request):
        now = timezone.now()
        stories = Story.objects.filter(
            user=request.user,
            expires_at__gt=now,
        ).order_by('-created_at')
        serializer = self.get_serializer(stories, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def ring(self, request):
        """استوری‌های فعال پزشکان — گروه‌بندی شده برای نمایش حلقه."""
        now = timezone.now()
        stories = Story.objects.filter(
            user__user_type__in=('doctor', 'clinic'),
            expires_at__gt=now,
        ).select_related('user').order_by('user_id', '-created_at')
        rings = {}
        for story in stories:
            uid = story.user_id
            if uid not in rings:
                rings[uid] = {
                    'user': story.user,
                    'stories': [],
                }
            rings[uid]['stories'].append(story)
        payload = []
        for item in rings.values():
            payload.append({
                'user': UserSerializer(item['user'], context={'request': request}).data,
                'stories': StorySerializer(
                    item['stories'], many=True, context={'request': request},
                ).data,
            })
        return Response(payload)


class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.all().select_related('patient', 'doctor')
    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly]
    filter_backends = [filters.OrderingFilter]
    ordering = ['-created_at']

    def get_queryset(self):
        queryset = super().get_queryset()
        doctor_id = self.request.query_params.get('doctor_id')
        doctor_username = self.request.query_params.get('doctor')
        if doctor_id:
            queryset = queryset.filter(doctor_id=doctor_id)
        if doctor_username:
            queryset = queryset.filter(doctor__username=doctor_username)
        return queryset

    def perform_create(self, serializer):
        review = serializer.save(patient=self.request.user)
        try:
            from notifications.services import notify_review
            notify_review(review)
        except Exception:
            pass
