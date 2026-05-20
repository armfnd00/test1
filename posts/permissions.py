from rest_framework import permissions


class IsAuthorOrReadOnly(permissions.BasePermission):
    """
    فقط نویسنده می‌تواند ویرایش یا حذف کند
    """
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # بررسی author برای Post و Story
        if hasattr(obj, 'author'):
            return obj.author == request.user
        # بررسی user برای Comment
        elif hasattr(obj, 'user'):
            return obj.user == request.user
        # بررسی patient برای Review
        elif hasattr(obj, 'patient'):
            return obj.patient == request.user
        
        return False
