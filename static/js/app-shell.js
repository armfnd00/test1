/**
 * اپ موبایل — ناوبری پایین، هدر لوکس
 */
(async function () {
    let user = null;
    if (isLoggedIn()) {
        user = await refreshAuthUser();
    } else {
        clearAuthSession();
    }

    const path = window.location.pathname;
    const map = {
        '/feed/': 'feed',
        '/search/': 'search',
        '/explore/': 'explore',
        '/saved/': 'saved',
        '/doctors/': 'doctors',
        '/clinics/': 'clinics',
        '/profile/': 'profile',
    };

    let active = 'feed';
    for (const [p, key] of Object.entries(map)) {
        if (path === p || (key === 'profile' && path.startsWith('/profile'))) {
            active = key;
            break;
        }
    }
    if (path.startsWith('/clinic/')) active = 'profile';
    if (path.startsWith('/doctor/')) active = 'profile';
    if (path.startsWith('/appointments')) active = 'profile';

    document.querySelectorAll('.bottom-nav-item').forEach((el) => {
        el.classList.toggle('active', el.dataset.nav === active);
    });

    document.querySelectorAll('.bottom-nav-fab, .bottom-nav-item--primary').forEach((el) => {
        el.classList.toggle('active', path === '/explore/' || path.startsWith('/explore'));
    });

    const prof = document.getElementById('globalBottomNavProfile') || document.getElementById('bottomNavProfile');
    const headerProf = document.getElementById('appHeaderProfile');
    const headerAvatar = document.getElementById('appHeaderAvatar');

    if (user) {
        const profileHref = user.user_type === 'doctor'
            ? `/doctor/${user.username}/`
            : user.user_type === 'clinic'
                ? `/clinic/${user.username}/`
                : '/profile/';
        if (prof) prof.href = profileHref;
        if (headerProf) headerProf.href = profileHref;
        if (headerAvatar) headerAvatar.src = avatarUrl(user);
    }

    document.querySelectorAll('.app-header-icon[href="/notifications/"] .notif-badge').forEach((b) => {
        b.style.position = 'absolute';
        b.style.top = '2px';
        b.style.left = '2px';
    });
    document.getElementById('appHeaderLogout')?.addEventListener('click', async () => {
        if (confirm('از حساب کاربری خارج شوید؟')) await logout();
    });
})();
