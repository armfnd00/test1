from django.contrib import admin
from .models import Post, Like, Comment, SavedPost, Story, Review


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ['id', 'author', 'media_type', 'caption_preview', 'privacy', 'created_at']
    list_filter = ['media_type', 'privacy', 'created_at', 'comments_enabled']
    search_fields = ['author__username', 'caption', 'location']
    readonly_fields = ['created_at', 'updated_at']
    
    def caption_preview(self, obj):
        return obj.caption[:50] + '...' if len(obj.caption) > 50 else obj.caption
    caption_preview.short_description = 'توضیحات'


@admin.register(Like)
class LikeAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'post', 'created_at']
    list_filter = ['created_at']
    search_fields = ['user__username', 'post__caption']


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'post', 'text_preview', 'parent', 'created_at']
    list_filter = ['created_at']
    search_fields = ['user__username', 'text', 'post__caption']
    
    def text_preview(self, obj):
        return obj.text[:50] + '...' if len(obj.text) > 50 else obj.text
    text_preview.short_description = 'متن'


@admin.register(SavedPost)
class SavedPostAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'post', 'created_at']
    list_filter = ['created_at']
    search_fields = ['user__username', 'post__caption']


@admin.register(Story)
class StoryAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'media_type', 'created_at', 'expires_at', 'is_expired']
    list_filter = ['media_type', 'created_at', 'expires_at']
    search_fields = ['user__username', 'caption']
    readonly_fields = ['created_at']


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ['id', 'patient', 'doctor', 'rating', 'created_at']
    list_filter = ['rating', 'created_at']
    search_fields = ['patient__username', 'doctor__username', 'comment']
