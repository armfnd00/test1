from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AuthViewSet, UserViewSet, DoctorProfileViewSet,login_page,register_page 

router = DefaultRouter()
router.register('auth', AuthViewSet, basename='auth')
router.register('users', UserViewSet, basename='user')
router.register('doctors', DoctorProfileViewSet, basename='doctor')

urlpatterns = [
    path('', include(router.urls)),
]
