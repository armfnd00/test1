from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import get_user_model

User = get_user_model()


def feed_page(request):
    return render(request, 'feed/home.html')


def profile_page(request):
    return render(request, 'profile/user_profile.html')


def user_public_profile_page(request, username):
    user = get_object_or_404(User, username=username)
    if user.user_type == 'doctor':
        return redirect('doctor_profile', username=username)
    if user.user_type == 'clinic':
        return redirect('clinic_profile', username=username)
    return render(request, 'profile/user_profile.html', {'username': username})


def doctor_profile_page(request, username):
    user = get_object_or_404(User, username=username)
    if user.user_type != 'doctor':
        if user.user_type == 'clinic':
            return redirect('clinic_profile', username=username)
        return redirect('user_public_profile', username=username)
    return render(request, 'profile/doctor_profile.html', {'username': username})


def clinic_profile_page(request, username):
    user = get_object_or_404(User, username=username)
    if user.user_type != 'clinic':
        if user.user_type == 'doctor':
            return redirect('doctor_profile', username=username)
        return redirect('user_public_profile', username=username)
    return render(request, 'clinic/profile.html', {'username': username})


def clinics_page(request):
    return redirect('/doctors/?type=clinics')


def settings_page(request):
    return render(request, 'pages/settings.html')


def terms_page(request):
    return render(request, 'pages/terms.html')


def password_reset_page(request):
    return render(request, 'auth/password_reset.html')


def doctors_page(request):
    return render(request, 'doctors/list.html')


def search_page(request):
    return render(request, 'search/search.html')


def booking_page(request):
    return render(request, 'booking/book.html')


def saved_page(request):
    return render(request, 'saved/list.html')


def notifications_page(request):
    return render(request, 'notifications/list.html')
