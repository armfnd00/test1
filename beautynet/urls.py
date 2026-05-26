import beautynet.admin  # noqa: F401 — customize admin titles
import os
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import FileResponse, JsonResponse
from django.views.generic import TemplateView

from accounts.views import login_page, register_page
from accounts.page_views import (
    feed_page,
    profile_page,
    user_public_profile_page,
    doctor_profile_page,
    clinic_profile_page,
    settings_page,
    terms_page,
    password_reset_page,
    doctors_page,
    search_page,
    clinics_page,
    booking_page,
    saved_page,
    notifications_page,
)
from explore.views import explore_page
from appointments.views import appointments_page
from messaging.views import chat_page


def healthcheck(request):
    return JsonResponse({'status': 'ok'})


def service_worker(request):
    response = FileResponse(open(settings.BASE_DIR / 'static' / 'sw.js', 'rb'), content_type='application/javascript')
    response['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate'
    response['Pragma'] = 'no-cache'
    response['Expires'] = '0'
    return response


urlpatterns = [
    path('healthz/', healthcheck, name='healthcheck'),
    path('sw.js', service_worker, name='service_worker'),
    path('admin/', admin.site.urls),
    path('api/accounts/', include('accounts.urls')),
    path('api/appointments/', include('appointments.urls')),
    path('api/explore/', include('explore.urls')),
    path('api/notifications/', include('notifications.urls')),
    path('api/', include('posts.urls')),
    path('api/messaging/', include('messaging.urls')),

    path('', TemplateView.as_view(template_name='index.html'), name='home'),
    path('login/', login_page, name='login_page'),
    path('register/', register_page, name='register_page'),
    path('password-reset/', password_reset_page, name='password_reset'),
    path('feed/', feed_page, name='feed'),
    path('profile/', profile_page, name='profile'),
    path('profile/<str:username>/', user_public_profile_page, name='user_public_profile'),
    path('doctor/<str:username>/', doctor_profile_page, name='doctor_profile'),
    path('clinic/<str:username>/', clinic_profile_page, name='clinic_profile'),
    path('clinics/', clinics_page, name='clinics'),
    path('settings/', settings_page, name='settings'),
    path('terms/', terms_page, name='terms'),
    path('explore/', explore_page, name='explore'),
    path('doctors/', doctors_page, name='doctors'),
    path('search/', search_page, name='search'),
    path('booking/', booking_page, name='booking'),
    path('saved/', saved_page, name='saved'),
    path('notifications/', notifications_page, name='notifications'),
    path('messages/', chat_page, name='messages'),
    path('appointments/', appointments_page, name='appointments'),
    path('payments/', include('payments.urls')),
]

if settings.DEBUG:
    from django.contrib.staticfiles.urls import staticfiles_urlpatterns
    urlpatterns += staticfiles_urlpatterns()
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
elif os.environ.get('SERVE_MEDIA', '').lower() in ('1', 'true', 'yes'):
    from django.views.static import serve
    urlpatterns += [
        path(
            'media/<path:path>',
            serve,
            {'document_root': settings.MEDIA_ROOT},
        ),
    ]
