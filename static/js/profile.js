/**
 * مدیریت پروفایل کاربر و پزشک
 */
class ProfileManager {
    constructor() {
        this.user = null;
        this.doctorProfile = null;
        this.viewUsername = document.body.dataset.profileUsername || null;
        if (this.viewUsername === '') this.viewUsername = null;
        this.isOwnProfile = !this.viewUsername;
        this.maxAvatarSize = 10 * 1024 * 1024;
    }

    async init() {
        const isPublicDoctorView =
            this.viewUsername && document.body.classList.contains('doctor-profile');

        if (isPublicDoctorView) {
            this.hidePublisherUI();
        }

        if (!isPublicDoctorView && !requireAuth()) return;

        this.setupTabs();
        this.setupModals();

        try {
            if (this.viewUsername) {
                await this.loadPublicProfile(this.viewUsername);
            } else {
                await this.loadOwnProfile();
            }
        } catch (e) {
            showToast(e.message || 'خطا در بارگذاری پروفایل', 'error');
        }
    }

    setupTabs() {
        document.querySelectorAll('.tab-btn').forEach((tab) => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach((t) => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
                tab.classList.add('active');
                const target = tab.dataset.tab;
                document.getElementById(`${target}Tab`)?.classList.add('active');
                if (target === 'booking' && this._bookingDoctor) {
                    this.initBookingWidget(this._bookingDoctor.user, this._bookingDoctor.profile);
                }
                if (target === 'patientRecords' && this.isOwnProfile) {
                    this.initPatientRecords();
                }
            });
        });
    }

    setupModals() {
        const bind = (btnId, modalId, closeId) => {
            const btn = document.getElementById(btnId);
            const modal = document.getElementById(modalId);
            const close = document.getElementById(closeId);
            if (btn && modal) btn.onclick = () => { modal.style.display = 'flex'; };
            if (close && modal) close.onclick = () => { modal.style.display = 'none'; };
        };
        bind('editProfileBtn', 'editProfileModal', 'closeEditModal');
        bind('followersBtn', 'followModal', 'closeFollowModal');
        bind('followingBtn', 'followModal', 'closeFollowModal');
        bind('writeReviewBtn', 'reviewModal', 'closeReviewModal');

        document.getElementById('cancelEditBtn')?.addEventListener('click', () => {
            document.getElementById('editProfileModal').style.display = 'none';
        });

        document.getElementById('editProfileForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProfile();
        });

        document.getElementById('avatarEditBtn')?.addEventListener('click', () => {
            if (!this.isOwnProfile) return;
            document.getElementById('profileAvatarInput')?.click();
        });

        document.getElementById('profileAvatarInput')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                showToast('فقط فایل تصویری برای آواتار مجاز است', 'error');
                e.target.value = '';
                return;
            }
            if (file.size > this.maxAvatarSize) {
                showToast('حجم عکس پروفایل حداکثر ۱۰ مگابایت است', 'error');
                e.target.value = '';
                return;
            }
            this._pendingAvatar = file;
            const previewUrl = URL.createObjectURL(file);
            const avatar = document.getElementById('profileAvatar');
            if (avatar) avatar.src = previewUrl;
            this.uploadAvatar(file);
        });

        document.getElementById('followersBtn')?.addEventListener('click', () => {
            document.getElementById('followModalTitle').textContent = 'فالوورها';
            this.loadFollowList('followers');
        });
        document.getElementById('followingBtn')?.addEventListener('click', () => {
            document.getElementById('followModalTitle').textContent = 'فالوینگ';
            this.loadFollowList('following');
        });

        document.getElementById('bio')?.addEventListener('input', (e) => {
            const el = document.getElementById('bioCount');
            if (el) el.textContent = e.target.value.length;
        });

        document.querySelectorAll('#reviewStars i').forEach((star) => {
            star.addEventListener('click', () => {
                const value = parseInt(star.dataset.value, 10);
                document.querySelectorAll('#reviewStars i').forEach((s, i) => {
                    s.classList.toggle('fas', i < value);
                    s.classList.toggle('far', i >= value);
                });
            });
        });
    }

    async loadOwnProfile() {
        this.user = await apiClient.getCurrentUser();
        setAuthSession(getAuthToken(), this.user);

        if (this.user.user_type === 'doctor' && !document.body.classList.contains('doctor-profile')) {
            window.location.href = `/doctor/${this.user.username}/`;
            return;
        }
        if (this.user.user_type === 'clinic') {
            window.location.href = `/clinic/${this.user.username}/`;
            return;
        }
        if (this.user.user_type === 'doctor') {
            this.doctorProfile = await apiClient.getMyDoctorProfile();
            this.renderDoctorProfile(this.user, this.doctorProfile);
            await this.loadUserPosts(this.user.username);
            return;
        }

        this.renderUserProfile(this.user, true);
        await this.loadUserPosts(this.user.username);
    }

    async loadPublicProfile(username) {
        this.user = await apiClient.getUserProfile(username);
        const me = isLoggedIn() ? await refreshAuthUser() : (clearAuthSession(), null);
        this.isOwnProfile = Boolean(me && me.username === username);

        if (this.user.user_type === 'doctor') {
            try {
                this.doctorProfile = await apiClient.getDoctorProfile(username);
            } catch (e) {
                console.warn(e);
            }
            if (document.querySelector('.doctor-profile')) {
                this.renderDoctorProfile(this.user, this.doctorProfile);
            }
        } else if (this.user.user_type === 'clinic') {
            window.location.href = `/clinic/${username}/`;
            return;
        } else {
            this.renderUserProfile(this.user, this.isOwnProfile);
        }
        await this.loadUserPosts(username);
    }

    renderUserProfile(user, isOwn) {
        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val ?? '';
        };
        set('profileUsername', user.username);
        set('profileFullname', user.full_name || user.username);
        set('profileBio', user.bio || 'بیوگرافی ثبت نشده است.');
        set('postsCount', user.posts_count ?? 0);
        set('followersCount', user.followers_count ?? 0);
        set('followingCount', user.following_count ?? 0);

        const avatar = document.getElementById('profileAvatar');
        if (avatar) avatar.src = avatarUrl(user);

        const editBtn = document.getElementById('editProfileBtn');
        if (editBtn) editBtn.style.display = isOwn ? 'inline-flex' : 'none';
        const avatarEditBtn = document.getElementById('avatarEditBtn');
        if (avatarEditBtn) avatarEditBtn.hidden = !isOwn;

        const createPostBtn = document.getElementById('createPostBtn');
        if (createPostBtn) {
            createPostBtn.hidden = true;
            createPostBtn.setAttribute('aria-hidden', 'true');
        }
        const emptyPosts = document.getElementById('emptyPosts');
        if (emptyPosts && user.user_type === 'patient') {
            const title = emptyPosts.querySelector('h3');
            const text = emptyPosts.querySelector('p');
            if (title) title.textContent = 'پروفایل بیمار';
            if (text) text.textContent = 'بیماران امکان انتشار پست ندارند؛ فعالیت‌ها، ذخیره‌ها و نوبت‌ها در بخش‌های مربوط نمایش داده می‌شود.';
        }

        if (isOwn) {
            document.getElementById('editFullname')?.setAttribute('value', user.full_name || '');
            const fn = document.getElementById('editFullname');
            if (fn) fn.value = `${user.first_name || ''} ${user.last_name || ''}`.trim();
            const bio = document.getElementById('editBio');
            if (bio) bio.value = user.bio || '';
            const email = document.getElementById('editEmail');
            if (email) email.value = user.email || '';
            const phone = document.getElementById('editPhone');
            if (phone) phone.value = user.phone || '';
        }
    }

    renderDoctorProfile(user, profile) {
        this.hidePublisherUI();

        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val ?? '';
        };
        set('doctorUsername', user.username);
        set('doctorName', user.full_name || user.username);
        set('doctorSpecialty', profile?.specialty_display || 'پزشک زیبایی');
        set('doctorPostsCount', user.posts_count ?? 0);
        set('doctorFollowersCount', user.followers_count ?? 0);
        set('doctorFollowingCount', user.following_count ?? 0);
        set('doctorReviewsCount', profile?.reviews_count ?? 0);
        set('doctorRating', profile?.average_rating ?? '0.0');
        const addrEl = document.getElementById('doctorAddress');
        if (addrEl) {
            const locText = profile?.can_see_location && profile?.location
                ? `${profile.location.city} — ${profile.location.clinic_name}`
                : 'آدرس دقیق پس از رزرو و پرداخت نوبت';
            addrEl.innerHTML = `<i class="fas fa-${profile?.can_see_location && profile?.location ? 'map-marker-alt' : 'lock'}"></i><span>${locText}</span>`;
        }
        set('doctorFee', profile ? `${Number(profile.consultation_fee).toLocaleString('fa-IR')} تومان` : '—');
        const bioEl = document.getElementById('doctorBio');
        if (bioEl) {
            bioEl.textContent = user.bio || '';
            bioEl.style.display = user.bio ? '' : 'none';
        }

        const verified = document.getElementById('doctorVerifiedBadge');
        if (verified) {
            if (profile?.is_verified) {
                verified.hidden = false;
            } else {
                verified.hidden = true;
            }
        }

        const avatar = document.getElementById('doctorAvatar');
        if (avatar) avatar.src = avatarUrl(user);
        this.renderDoctorClinicAffiliation(profile);
        this.renderEditorialDoctorProfile(user, profile);
        this.enforceDoctorRoleVisibility();

        document.getElementById('doctorFollowersBtn')?.addEventListener('click', () => {
            if (!isLoggedIn()) {
                const next = encodeURIComponent(window.location.pathname);
                window.location.href = `/login/?next=${next}`;
                return;
            }
            document.getElementById('followModalTitle').textContent = 'فالوورها';
            document.getElementById('followModal').style.display = 'flex';
            this.loadFollowList('followers');
        });

        const followBtn = document.getElementById('followDoctorBtn');
        const visitorActions = document.getElementById('doctorVisitorActions');
        if (this.isOwnProfile) {
            if (visitorActions) visitorActions.hidden = true;
            if (followBtn) followBtn.hidden = true;
            document.querySelectorAll('[data-owner-only]').forEach((el) => { el.hidden = false; });
            document.getElementById('doctorShareBtn')?.setAttribute('hidden', '');
            document.getElementById('doctorLogoutBtn')?.addEventListener('click', async () => {
                if (confirm('از حساب کاربری خارج شوید؟')) await logout();
            }, { once: true });
        } else {
            document.querySelectorAll('[data-owner-only]').forEach((el) => { el.hidden = true; });
            if (visitorActions) visitorActions.hidden = false;
            if (followBtn) {
                followBtn.hidden = false;
                followBtn.innerHTML = user.is_following
                    ? '<i class="fas fa-user-check"></i><span>آنفالو</span>'
                    : '<i class="fas fa-user-plus"></i><span>فالو</span>';
                followBtn.onclick = () => this.toggleFollow(user.username, user.is_following);
            }
        }

        this.setupBooking(user, profile);
        this.bindEditorialProfileActions(user);
        this.setupDoctorContentTools();
        this.setupDoctorOwnerQuickPanel(profile);
        this.renderAboutTab(user, profile);
        this.loadReviews(user.username, profile);
        this.setupReviewForm(user.username);
        this.doctorPosts = [];
    }

    setupDoctorOwnerQuickPanel(profile) {
        const panel = document.getElementById('doctorOwnerQuickPanel');
        if (!panel || !this.isOwnProfile) return;

        const layout = profile?.profile_layout === 'luxury_editorial' ? 'luxury_editorial' : 'classic';
        panel.querySelectorAll('input[name="doctorProfileLayoutQuick"]').forEach((input) => {
            input.checked = input.value === layout;
        });

        if (this._doctorOwnerQuickBound) return;
        this._doctorOwnerQuickBound = true;

        panel.querySelectorAll('input[name="doctorProfileLayoutQuick"]').forEach((input) => {
            input.addEventListener('change', () => {
                if (input.checked) this.saveDoctorProfileLayoutQuick(input.value);
            });
        });
    }

    async saveDoctorProfileLayoutQuick(layout) {
        const statusEl = document.getElementById('doctorOwnerQuickStatus');
        if (statusEl) statusEl.textContent = 'در حال ذخیره حالت نمایش...';
        showLoading();
        try {
            const updated = await apiClient.setDoctorProfileLayout(layout);
            this.doctorProfile = updated;
            this.renderEditorialDoctorProfile(this.user, updated);
            this.setupDoctorOwnerQuickPanel(updated);
            if (statusEl) statusEl.textContent = 'حالت نمایش پروفایل ذخیره شد.';
            showToast('حالت نمایش پروفایل ذخیره شد', 'success');
        } catch (e) {
            if (this.doctorProfile) this.setupDoctorOwnerQuickPanel(this.doctorProfile);
            if (statusEl) statusEl.textContent = e.message || 'ذخیره حالت نمایش انجام نشد.';
            showToast(e.message || 'ذخیره حالت نمایش انجام نشد', 'error');
        } finally {
            hideLoading();
        }
    }

    renderEditorialDoctorProfile(user, profile) {
        const editorial = document.getElementById('doctorEditorialProfile');
        const isEditorial = profile?.profile_layout === 'luxury_editorial';
        document.body.classList.toggle('doctor-editorial-layout', isEditorial);
        if (!editorial) return;
        editorial.hidden = !isEditorial;
        if (!isEditorial) return;

        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val ?? '';
        };
        const fullName = user.full_name || user.username;
        const rating = profile?.average_rating ?? '0.0';
        const reviews = profile?.reviews_count ?? 0;
        const fee = profile?.consultation_fee ? Number(profile.consultation_fee).toLocaleString('fa-IR') : null;

        set('doctorEditorialName', fullName);
        set('doctorEditorialSpecialty', `${profile?.specialty_display || 'پزشک زیبایی'}${profile?.experience_years ? ` · ${profile.experience_years} سال تجربه` : ''}`);
        set('doctorEditorialRating', rating);
        set('doctorEditorialReviews', reviews);
        set('doctorEditorialBio', user.bio || `${fullName} در زمینه ${profile?.specialty_display || 'زیبایی'} فعالیت می‌کند و رزرو نوبت آنلاین از همین صفحه در دسترس است.`);
        set('doctorEditorialBookHint', fee ? `هزینه مشاوره ${fee} تومان` : 'زمان مناسب را انتخاب کنید');

        const verified = document.getElementById('doctorEditorialVerified');
        if (verified) verified.hidden = !profile?.is_verified;

        const photo = document.getElementById('doctorEditorialPhoto');
        if (photo) {
            photo.src = avatarUrl(user);
            photo.alt = fullName;
        }

        const specs = document.getElementById('doctorEditorialSpecialties');
        if (specs) {
            const specialty = profile?.specialty_display || 'زیبایی';
            specs.innerHTML = [
                `<span><i class="fas fa-wand-magic-sparkles"></i> ${specialty}</span>`,
                `<span><i class="fas fa-shield-heart"></i> مشاوره محرمانه</span>`,
                `<span><i class="fas fa-calendar-check"></i> رزرو آنلاین</span>`,
                `<span><i class="fas fa-images"></i> نمونه‌کار واقعی</span>`,
            ].join('');
        }
    }

    bindEditorialProfileActions(user) {
        const bookBtn = document.getElementById('doctorEditorialBookBtn');
        const classicBookBtn = document.getElementById('bookAppointmentBtn');
        if (bookBtn) {
            if (this.isOwnProfile) {
                bookBtn.onclick = () => { window.location.href = '/settings/#panelDoctor'; };
            } else {
                bookBtn.onclick = () => classicBookBtn?.click();
            }
        }

        const followBtn = document.getElementById('doctorEditorialFollowBtn');
        if (followBtn) {
            followBtn.hidden = this.isOwnProfile;
            followBtn.innerHTML = user.is_following ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
            followBtn.onclick = () => this.toggleFollow(user.username, user.is_following);
        }

        document.getElementById('doctorEditorialShareBtn')?.addEventListener('click', () => {
            const url = window.location.href;
            if (navigator.share) {
                navigator.share({ title: user.full_name || user.username, url }).catch(() => {});
            } else if (navigator.clipboard) {
                navigator.clipboard.writeText(url);
                showToast('لینک کپی شد', 'success');
            }
        }, { once: true });
    }

    renderDoctorClinicAffiliation(profile) {
        const box = document.getElementById('doctorClinicAffiliation');
        if (!box) return;
        const clinic = profile?.linked_clinic;
        if (clinic?.username) {
            box.innerHTML = `
                <a class="profile-affiliation-card" href="/clinic/${clinic.username}/">
                    <span class="profile-affiliation-icon"><i class="fas fa-hospital"></i></span>
                    <span>
                        <small>عضو کلینیک</small>
                        <strong>${clinic.official_name || clinic.username}</strong>
                        <em>${clinic.city || ''}</em>
                    </span>
                    <i class="fas fa-chevron-left"></i>
                </a>`;
            return;
        }
        if (this.isOwnProfile) {
            box.innerHTML = `
                <div class="profile-affiliation-card profile-affiliation-card--empty">
                    <span class="profile-affiliation-icon"><i class="fas fa-link"></i></span>
                    <span>
                        <small>اتصال کلینیک</small>
                        <strong>هنوز عضو کلینیکی نیستید</strong>
                        <em>از پروفایل کلینیک موردنظر روی «عضویت در کلینیک» بزنید.</em>
                    </span>
                </div>`;
        } else {
            box.innerHTML = '';
        }
    }

    renderAboutTab(user, profile) {
        const aboutEl = document.getElementById('doctorAboutContent');
        if (!aboutEl) return;
        const items = [];
        if (user.bio) {
            items.push(`<div class="about-card"><h3><i class="fas fa-user-md"></i> درباره</h3><p>${user.bio}</p></div>`);
        }
        if (profile) {
            items.push(`<div class="about-card"><h3><i class="fas fa-stethoscope"></i> تخصص</h3><p>${profile.specialty_display || '—'}</p></div>`);
            if (profile.experience_years) {
                items.push(`<div class="about-card"><h3><i class="fas fa-briefcase"></i> سابقه</h3><p>${profile.experience_years} سال تجربه</p></div>`);
            }
            if (profile.linked_clinic?.username) {
                items.push(`<div class="about-card"><h3><i class="fas fa-hospital"></i> کلینیک همکار</h3><p><a href="/clinic/${profile.linked_clinic.username}/">${profile.linked_clinic.official_name}</a> · ${profile.linked_clinic.city || ''}</p></div>`);
            } else if (profile.city || profile.clinic_name) {
                items.push(`<div class="about-card"><h3><i class="fas fa-hospital"></i> مطب</h3><p>${profile.clinic_name || ''} · ${profile.city || ''}</p></div>`);
            }
            if (profile.license_number) {
                items.push(`<div class="about-card"><h3><i class="fas fa-id-card"></i> نظام پزشکی</h3><p>${profile.license_number}</p></div>`);
            }
        }
        aboutEl.innerHTML = items.length
            ? items.join('') + `<div class="about-card"><h3><i class="fas fa-map-marked-alt"></i> موقعیت</h3><div id="doctorLocationPanel"></div></div>`
            : '<div class="empty-state"><i class="fas fa-info-circle"></i><p>اطلاعات تکمیلی ثبت نشده است.</p></div>';

        const locPanel = document.getElementById('doctorLocationPanel');
        if (locPanel && profile) {
            if (profile.can_see_location && profile.location) {
                MapLinks.renderCard(locPanel, profile.location);
            } else {
                locPanel.innerHTML = `
                    <div class="profile-location-locked">
                        <i class="fas fa-lock"></i>
                        موقعیت دقیق پس از رزرو نوبت برای شما نمایش داده می‌شود.
                    </div>`;
            }
        }
    }

    async loadReviews(doctorUsername, profile) {
        const listEl = document.getElementById('reviewsList');
        if (!listEl) return;

        const overallEl = document.getElementById('overallRating');
        const totalEl = document.getElementById('totalReviews');
        const avg = profile?.average_rating ?? 0;
        const count = profile?.reviews_count ?? 0;

        if (overallEl) overallEl.textContent = avg;
        if (totalEl) totalEl.textContent = count;

        listEl.innerHTML = '<p class="text-muted" style="padding:16px">در حال بارگذاری نظرات...</p>';

        try {
            const data = await apiClient.getReviews({ doctor: doctorUsername });
            const reviews = data.results || data;
            this.updateRatingBars(reviews);

            if (!reviews.length) {
                listEl.innerHTML = '<div class="empty-state"><i class="fas fa-comment-dots"></i><h3>هنوز نظری ثبت نشده</h3><p>اولین نفری باشید که تجربه خود را می‌نویسد.</p></div>';
                return;
            }

            listEl.innerHTML = '';
            reviews.forEach((r) => {
                const item = document.createElement('article');
                item.className = 'review-item';
                const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
                const patient = r.patient || {};
                item.innerHTML = `
                    <header class="review-item-head">
                        <img src="${avatarUrl(patient)}" alt="" class="avatar-sm">
                        <div>
                            <strong>${patient.full_name || patient.username || 'بیمار'}</strong>
                            <span class="review-stars" aria-label="${r.rating} از 5">${stars}</span>
                        </div>
                        <time>${new Date(r.created_at).toLocaleDateString('fa-IR')}</time>
                    </header>
                    <p>${r.comment || '—'}</p>`;
                listEl.appendChild(item);
            });
        } catch (e) {
            listEl.innerHTML = `<p class="text-muted">${e.message}</p>`;
        }

        const writeBtn = document.getElementById('writeReviewBtn');
        const me = getStoredUser();
        if (writeBtn) {
            const canReview = me?.user_type === 'patient' && !this.isOwnProfile;
            writeBtn.style.display = canReview ? 'inline-flex' : 'none';
        }
    }

    updateRatingBars(reviews) {
        const counts = [0, 0, 0, 0, 0];
        reviews.forEach((r) => {
            if (r.rating >= 1 && r.rating <= 5) counts[r.rating - 1] += 1;
        });
        const total = reviews.length || 1;
        document.querySelectorAll('.rating-bar-item').forEach((row) => {
            const star = parseInt(row.dataset.star, 10);
            const pct = Math.round((counts[star - 1] / total) * 100);
            const fill = row.querySelector('.rating-bar-fill');
            const pctLabel = row.querySelector('.rating-pct');
            if (fill) fill.style.width = `${pct}%`;
            if (pctLabel) pctLabel.textContent = `${pct}%`;
        });
    }

    setupReviewForm(doctorUsername) {
        const form = document.getElementById('reviewForm');
        if (!form || form.dataset.bound) return;
        form.dataset.bound = '1';
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!requireAuth()) return;
            const me = getStoredUser();
            if (me?.user_type !== 'patient') {
                showToast('فقط بیماران می‌توانند نظر ثبت کنند', 'info');
                return;
            }
            const activeStars = document.querySelectorAll('#reviewStars i.fas').length;
            if (!activeStars) {
                showToast('امتیاز را انتخاب کنید', 'error');
                return;
            }
            const comment = document.getElementById('reviewText')?.value?.trim() || '';
            showLoading();
            try {
                await apiClient.addReview({
                    doctor_username: doctorUsername,
                    rating: activeStars,
                    comment,
                });
                showToast('نظر شما ثبت شد', 'success');
                document.getElementById('reviewModal').style.display = 'none';
                const profile = await apiClient.getDoctorProfile(doctorUsername);
                this.loadReviews(doctorUsername, profile);
                const rc = document.getElementById('doctorReviewsCount');
                const rt = document.getElementById('doctorRating');
                if (rc) rc.textContent = profile.reviews_count ?? 0;
                if (rt) rt.textContent = profile.average_rating ?? '0';
            } catch (err) {
                showToast(err.message, 'error');
            } finally {
                hideLoading();
            }
        });
    }

    hidePublisherUI() {
        const fab = document.getElementById('doctorOwnerFab');
        if (fab) {
            fab.hidden = true;
            fab.setAttribute('aria-hidden', 'true');
        }
        document.querySelectorAll('.doctor-create-bar').forEach((el) => {
            el.hidden = true;
            el.style.display = 'none';
        });
    }

    setupDoctorContentTools() {
        if (!this.isOwnProfile || !document.body.classList.contains('doctor-profile')) {
            this.hidePublisherUI();
            return;
        }
        this._initPublisherTools('doctorOwnerFab', 'doctorAddPostBtn', 'doctorAddStoryBtn');
    }

    setupClinicContentTools() {
        if (!this.isOwnProfile || !document.body.classList.contains('clinic-profile')) return;
        this._initPublisherTools('clinicCreateBar', 'clinicAddPostBtn', 'clinicAddStoryBtn');
    }

    async _initPublisherTools(containerId, postBtnId, storyBtnId) {
        const user = await ContentPermissions.resolveUser();
        const container = document.getElementById(containerId);
        const isOwner = Boolean(user && this.user && user.username === this.user.username);

        if (!ContentPermissions.canPublishOnProfile(user, isOwner)) {
            if (container) {
                container.hidden = true;
                container.setAttribute('aria-hidden', 'true');
            }
            return;
        }

        if (container) {
            container.hidden = false;
            container.removeAttribute('aria-hidden');
        }

        if (!this._postComposer) {
            this._postComposer = new PostComposer({
                onSuccess: () => this.loadUserPosts(this.user.username),
            });
            this._postComposer.bindModal('postComposerModal');
        }

        const postBtn = document.getElementById(postBtnId);
        if (postBtn && !postBtn.dataset.bound) {
            postBtn.dataset.bound = '1';
            postBtn.addEventListener('click', () => this._postComposer.open('standard'));
        }

        const storyBtn = document.getElementById(storyBtnId);
        if (storyBtn && !storyBtn.dataset.bound) {
            storyBtn.dataset.bound = '1';
            storyBtn.addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*,video/*';
                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    showLoading();
                    try {
                        await StoryManager.upload(file);
                        showToast('استوری منتشر شد', 'success');
                    } catch (err) {
                        showToast(err.message, 'error');
                    } finally {
                        hideLoading();
                    }
                };
                input.click();
            });
        }
    }

    enforceDoctorRoleVisibility() {
        const viewer = getStoredUser();
        const ownerOnlyIds = ['scheduleTabBtn', 'patientRecordsTabBtn', 'scheduleTab', 'patientRecordsTab'];
        ownerOnlyIds.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.hidden = !this.isOwnProfile;
            el.setAttribute('aria-hidden', String(!this.isOwnProfile));
        });

        const bookingAllowed = Boolean(!this.isOwnProfile && viewer?.user_type === 'patient');
        ['bookingTabBtn', 'bookingTab'].forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (!bookingAllowed) {
                el.hidden = true;
                el.setAttribute('aria-hidden', 'true');
                el.classList.remove('active');
            }
        });

        const activePanel = document.querySelector('.tab-content.active');
        if (activePanel?.hidden) {
            document.querySelectorAll('.tab-btn, .tab-content').forEach((el) => el.classList.remove('active'));
            document.querySelector('[data-tab="posts"]')?.classList.add('active');
            document.getElementById('postsTab')?.classList.add('active');
        }
    }

    setupBooking(user, profile) {
        const bookBtn = document.getElementById('bookAppointmentBtn');
        const bookingTabBtn = document.getElementById('bookingTabBtn');
        const visitorActions = document.getElementById('doctorVisitorActions');
        if (!bookBtn) return;

        const me = isLoggedIn() ? getStoredUser() : null;
        const apptUrl = `/booking/?doctor=${user.username}`;

        if (this.isOwnProfile) {
            if (visitorActions) visitorActions.hidden = true;
            bookingTabBtn && (bookingTabBtn.hidden = true);
            const scheduleTabBtn = document.getElementById('scheduleTabBtn');
            if (scheduleTabBtn) {
                scheduleTabBtn.hidden = false;
                scheduleTabBtn.addEventListener('click', () => this.initScheduleManager(), { once: true });
            }
            const recordsTabBtn = document.getElementById('patientRecordsTabBtn');
            if (recordsTabBtn) {
                recordsTabBtn.hidden = false;
                recordsTabBtn.addEventListener('click', () => this.initPatientRecords(), { once: true });
            }
            this.initScheduleManager();
            this.initPatientRecords();
            document.getElementById('doctorStickyBook')?.setAttribute('hidden', '');
            return;
        }

        if (visitorActions) visitorActions.hidden = false;
        bookBtn.innerHTML = '<i class="fas fa-calendar-check"></i><span>رزرو نوبت</span>';

        const showSticky = (onClick) => {
            const sticky = document.getElementById('doctorStickyBook');
            const stickyBtn = document.getElementById('doctorStickyBookBtn');
            if (!sticky || !stickyBtn) return;
            sticky.hidden = false;
            document.body.classList.add('has-sticky-book', 'dp-shell');
            stickyBtn.onclick = onClick;
            document.getElementById('doctorShareBtn')?.addEventListener('click', () => {
                const url = window.location.href;
                if (navigator.share) {
                    navigator.share({ title: user.full_name || user.username, url }).catch(() => {});
                } else if (navigator.clipboard) {
                    navigator.clipboard.writeText(url);
                    showToast('لینک کپی شد', 'success');
                }
            });
        };

        if (!me) {
            const goLogin = () => {
                window.location.href = `/login/?next=${encodeURIComponent(apptUrl)}`;
            };
            bookBtn.onclick = goLogin;
            showSticky(goLogin);
            return;
        }

        if (me.user_type !== 'patient') {
            if (visitorActions) visitorActions.hidden = false;
            if (bookBtn) bookBtn.hidden = true;
            if (bookingTabBtn) bookingTabBtn.hidden = true;
            document.getElementById('doctorStickyBook')?.setAttribute('hidden', '');
            return;
        }

        if (bookBtn) bookBtn.hidden = false;

        if (bookingTabBtn) bookingTabBtn.hidden = false;
        this._bookingDoctor = { user, profile };

        const openBooking = () => {
            document.querySelectorAll('.tab-btn').forEach((t) => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
            bookingTabBtn?.classList.add('active');
            document.getElementById('bookingTab')?.classList.add('active');
            this.initBookingWidget(user, profile);
            document.getElementById('bookingTab')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };

        bookBtn.onclick = openBooking;
        showSticky(openBooking);

        const followTop = document.getElementById('followDoctorBtnTop');
        if (followTop) {
            followTop.hidden = false;
            followTop.onclick = () => this.toggleFollow(user.username, user.is_following);
        }

        document.getElementById('bookingTabBtn')?.addEventListener('click', () => {
            if (!document.getElementById('bookingWidgetRoot')?.innerHTML.trim()) {
                this.initBookingWidget(user, profile);
            }
        }, { once: false });
    }

    initBookingWidget(user, profile) {
        const root = document.getElementById('bookingWidgetRoot');
        if (!root || root.querySelector('.bk-widget')) return;
        const widget = new BookingWidget({
            container: root,
            doctorUsername: user.username,
            consultationFee: profile?.consultation_fee || 0,
            doctorInfo: { user, ...profile },
            onBooked: () => {
                showToast('نوبت ثبت شد', 'success');
                window.location.href = '/appointments/?tab=pending';
            },
        });
        widget.init();
    }

    initScheduleManager() {
        if (this._scheduleBound || !this.isOwnProfile) return;
        const form = document.getElementById('scheduleCreateForm');
        const dateInput = document.getElementById('scheduleStartDate');
        if (!form || !dateInput) return;
        this._scheduleBound = true;
        dateInput.value = new Date().toISOString().slice(0, 10);
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.createScheduleSlots();
        });
        this.loadScheduleSlots();
    }

    buildDailySlots(start, end, duration) {
        const toMinutes = (t) => {
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
        };
        const toTime = (mins) => {
            const h = String(Math.floor(mins / 60)).padStart(2, '0');
            const m = String(mins % 60).padStart(2, '0');
            return `${h}:${m}`;
        };
        const startMin = toMinutes(start);
        const endMin = toMinutes(end);
        const slots = [];
        for (let cur = startMin; cur + duration <= endMin; cur += duration) {
            slots.push({ start_time: toTime(cur), end_time: toTime(cur + duration) });
        }
        return slots;
    }

    async createScheduleSlots() {
        const startDate = document.getElementById('scheduleStartDate')?.value;
        const days = Number(document.getElementById('scheduleDays')?.value || 7);
        const startTime = document.getElementById('scheduleStartTime')?.value;
        const endTime = document.getElementById('scheduleEndTime')?.value;
        const duration = Number(document.getElementById('scheduleDuration')?.value || 30);
        if (!startDate || !startTime || !endTime || !duration) {
            showToast('بازه زمانی معتبر نیست', 'error');
            return;
        }
        const slots = this.buildDailySlots(startTime, endTime, duration);
        if (!slots.length) {
            showToast('ساعت پایان باید بعد از ساعت شروع باشد', 'error');
            return;
        }
        showLoading();
        try {
            const res = await apiClient.bulkCreateTimeSlots({
                start_date: startDate,
                days,
                slots,
            });
            showToast(res.message || 'زمان‌ها ساخته شد', 'success');
            await this.loadScheduleSlots();
        } catch (e) {
            showToast(e.message || 'خطا در ساخت زمان‌ها', 'error');
        } finally {
            hideLoading();
        }
    }

    async loadScheduleSlots() {
        const wrap = document.getElementById('scheduleTableWrap');
        if (!wrap || !this.isOwnProfile) return;
        try {
            const slots = await apiClient.getMySchedule();
            if (!slots.length) {
                wrap.innerHTML = `
                    <div class="bn-profile-empty">
                        <i class="fas fa-calendar-plus"></i>
                        <h3>هنوز زمان خالی ثبت نشده</h3>
                        <p>از فرم بالا برنامه نوبت‌دهی را بسازید.</p>
                    </div>`;
                return;
            }
            const rows = slots.map((s) => `
                <tr>
                    <td>${new Date(s.date).toLocaleDateString('fa-IR')}</td>
                    <td>${String(s.start_time).slice(0, 5)} - ${String(s.end_time).slice(0, 5)}</td>
                    <td>${s.is_available ? 'آزاد' : 'رزرو شده'}</td>
                    <td>
                        ${s.is_available ? `<button type="button" class="btn btn-outline btn-sm" data-delete-slot="${s.id}">حذف</button>` : '—'}
                    </td>
                </tr>`).join('');
            wrap.innerHTML = `
                <table class="schedule-table">
                    <thead><tr><th>تاریخ</th><th>ساعت</th><th>وضعیت</th><th></th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>`;
            wrap.querySelectorAll('[data-delete-slot]').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    if (!confirm('این زمان حذف شود؟')) return;
                    try {
                        await apiClient.deleteTimeSlot(btn.dataset.deleteSlot);
                        showToast('زمان حذف شد', 'success');
                        await this.loadScheduleSlots();
                    } catch (e) {
                        showToast(e.message || 'حذف انجام نشد', 'error');
                    }
                });
            });
        } catch (e) {
            wrap.innerHTML = `<div class="bn-profile-empty"><p>${e.message || 'بارگذاری زمان‌ها انجام نشد'}</p></div>`;
        }
    }

    initPatientRecords() {
        if (this._patientRecordsBound || !this.isOwnProfile) return;
        const form = document.getElementById('patientRecordForm');
        if (!form) return;
        this._patientRecordsBound = true;
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.savePatientRecord();
        });
        document.getElementById('patientRecordResetBtn')?.addEventListener('click', () => this.resetPatientRecordForm());
        document.getElementById('patientRecordRefreshBtn')?.addEventListener('click', () => {
            this.loadPatientRecordAppointments();
            this.loadPatientRecords();
        });
        this.loadPatientRecordAppointments();
        this.loadPatientRecords();
    }

    async loadPatientRecordAppointments() {
        const select = document.getElementById('patientRecordAppointment');
        if (!select) return;
        select.innerHTML = '<option value="">در حال بارگذاری نوبت‌ها...</option>';
        try {
            const data = await apiClient.getPatientRecordAppointments();
            const appointments = data.results || [];
            if (!appointments.length) {
                select.innerHTML = '<option value="">هنوز نوبتی برای ثبت پرونده وجود ندارد</option>';
                return;
            }
            select.innerHTML = '<option value="">انتخاب نوبت بیمار</option>';
            appointments.forEach((appointment) => {
                const patient = appointment.patient || {};
                const option = document.createElement('option');
                option.value = appointment.id;
                option.disabled = appointment.has_record;
                option.dataset.amount = appointment.payment_amount || 0;
                option.textContent = `${patient.full_name || patient.username} · ${appointment.visit_display} · ${appointment.status_display}${appointment.has_record ? ' · پرونده دارد' : ''}`;
                select.appendChild(option);
            });
            select.onchange = () => {
                const option = select.selectedOptions[0];
                const amount = document.getElementById('patientRecordAmount');
                if (amount && option?.dataset.amount) amount.value = option.dataset.amount;
            };
        } catch (e) {
            select.innerHTML = `<option value="">${e.message || 'بارگذاری نوبت‌ها انجام نشد'}</option>`;
        }
    }

    async loadPatientRecords() {
        const box = document.getElementById('patientRecordsList');
        if (!box || !this.isOwnProfile) return;
        box.innerHTML = '<div class="bn-profile-empty"><i class="fas fa-folder-open"></i><p>در حال بارگذاری پرونده‌ها...</p></div>';
        try {
            const data = await apiClient.getPatientRecords();
            const records = data.results || data;
            if (!records.length) {
                box.innerHTML = '<div class="bn-profile-empty"><i class="fas fa-folder-heart"></i><h3>هنوز پرونده‌ای ثبت نشده</h3><p>بعد از رزرو نوبت بیمار، از فرم بالا پرونده درمانی بسازید.</p></div>';
                return;
            }
            box.innerHTML = '';
            records.forEach((record) => box.appendChild(this.renderPatientRecordCard(record, true)));
        } catch (e) {
            box.innerHTML = `<div class="bn-profile-empty"><p>${e.message || 'بارگذاری پرونده‌ها انجام نشد'}</p></div>`;
        }
    }

    renderPatientRecordCard(record, editable = false) {
        const card = document.createElement('article');
        card.className = 'patient-record-card';
        const before = record.before_image_url || record.before_image || '';
        const after = record.after_image_url || record.after_image || '';
        card.innerHTML = `
            <div class="patient-record-card__media">
                ${before ? `<img src="${before}" alt="قبل" loading="lazy">` : '<div class="patient-record-placeholder">قبل</div>'}
                ${after ? `<img src="${after}" alt="بعد" loading="lazy">` : '<div class="patient-record-placeholder">بعد</div>'}
            </div>
            <div class="patient-record-card__body">
                <div class="patient-record-card__top">
                    <div>
                        <strong>${record.patient_name || record.patient?.full_name || record.patient?.username || 'بیمار'}</strong>
                        <span>${record.visit_display || ''}</span>
                    </div>
                    <em>${Number(record.amount_spent || 0).toLocaleString('fa-IR')} تومان</em>
                </div>
                <h3>${record.title || 'پرونده درمان'}</h3>
                ${record.complaint ? `<p><b>مشکل:</b> ${record.complaint}</p>` : ''}
                ${record.treatment_summary ? `<p><b>درمان:</b> ${record.treatment_summary}</p>` : ''}
                ${record.doctor_notes && editable ? `<p class="patient-record-private"><b>یادداشت خصوصی:</b> ${record.doctor_notes}</p>` : ''}
                <div class="patient-record-card__meta">
                    <span class="${record.share_with_clinic ? 'is-shared' : ''}">
                        <i class="fas fa-${record.share_with_clinic ? 'hospital' : 'lock'}"></i>
                        ${record.share_with_clinic ? 'قابل مشاهده برای کلینیک' : 'فقط پزشک'}
                    </span>
                    ${record.clinic_name ? `<span>${record.clinic_name}</span>` : ''}
                </div>
                ${editable ? `
                    <div class="patient-record-card__actions">
                        <button type="button" class="bn-btn bn-btn--ghost" data-edit-record="${record.id}">ویرایش</button>
                        <button type="button" class="btn btn-outline btn-sm" data-delete-record="${record.id}">حذف</button>
                    </div>` : ''}
            </div>`;
        card.querySelector('[data-edit-record]')?.addEventListener('click', () => this.editPatientRecord(record));
        card.querySelector('[data-delete-record]')?.addEventListener('click', () => this.deletePatientRecord(record.id));
        return card;
    }

    editPatientRecord(record) {
        document.getElementById('patientRecordId').value = record.id;
        const select = document.getElementById('patientRecordAppointment');
        if (select) {
            select.value = record.appointment || '';
            select.disabled = true;
        }
        document.getElementById('patientRecordTitle').value = record.title || '';
        document.getElementById('patientRecordAmount').value = record.amount_spent || 0;
        document.getElementById('patientRecordComplaint').value = record.complaint || '';
        document.getElementById('patientRecordTreatment').value = record.treatment_summary || '';
        document.getElementById('patientRecordNotes').value = record.doctor_notes || '';
        document.getElementById('patientRecordShareClinic').checked = Boolean(record.share_with_clinic);
        document.getElementById('patientRecordsTab')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    resetPatientRecordForm() {
        const form = document.getElementById('patientRecordForm');
        form?.reset();
        document.getElementById('patientRecordId').value = '';
        const select = document.getElementById('patientRecordAppointment');
        if (select) select.disabled = false;
        document.getElementById('patientRecordTitle').value = 'پرونده درمان';
    }

    async savePatientRecord() {
        const id = document.getElementById('patientRecordId')?.value;
        const appointmentId = document.getElementById('patientRecordAppointment')?.value;
        if (!id && !appointmentId) {
            showToast('نوبت بیمار را انتخاب کنید', 'error');
            return;
        }
        const fd = new FormData();
        if (!id) fd.append('appointment_id', appointmentId);
        fd.append('title', document.getElementById('patientRecordTitle')?.value || 'پرونده درمان');
        fd.append('amount_spent', document.getElementById('patientRecordAmount')?.value || 0);
        fd.append('complaint', document.getElementById('patientRecordComplaint')?.value || '');
        fd.append('treatment_summary', document.getElementById('patientRecordTreatment')?.value || '');
        fd.append('doctor_notes', document.getElementById('patientRecordNotes')?.value || '');
        fd.append('share_with_clinic', document.getElementById('patientRecordShareClinic')?.checked ? 'true' : 'false');
        const before = document.getElementById('patientRecordBefore')?.files?.[0];
        const after = document.getElementById('patientRecordAfter')?.files?.[0];
        if (before) fd.append('before_image', before);
        if (after) fd.append('after_image', after);
        showLoading();
        try {
            if (id) await apiClient.updatePatientRecord(id, fd);
            else await apiClient.createPatientRecord(fd);
            showToast('پرونده بیمار ذخیره شد', 'success');
            this.resetPatientRecordForm();
            await this.loadPatientRecordAppointments();
            await this.loadPatientRecords();
        } catch (e) {
            showToast(e.message || 'ذخیره پرونده انجام نشد', 'error');
        } finally {
            hideLoading();
        }
    }

    async deletePatientRecord(id) {
        if (!confirm('این پرونده حذف شود؟')) return;
        try {
            await apiClient.deletePatientRecord(id);
            showToast('پرونده حذف شد', 'success');
            await this.loadPatientRecordAppointments();
            await this.loadPatientRecords();
        } catch (e) {
            showToast(e.message || 'حذف پرونده انجام نشد', 'error');
        }
    }

    async toggleFollow(username, isFollowing) {
        try {
            if (isFollowing) {
                await apiClient.unfollowUser(username);
                showToast('آنفالو شد', 'success');
            } else {
                await apiClient.followUser(username);
                showToast('فالو شد', 'success');
            }
            await this.loadPublicProfile(username);
        } catch (e) {
            showToast(e.message, 'error');
        }
    }

    async loadUserPosts(username) {
        const grid = document.getElementById('postsGrid') || document.getElementById('doctorPostsGrid');
        const empty = document.getElementById('emptyPosts') || document.getElementById('doctorPostsEmpty');
        if (!grid) return;

        try {
            const data = await apiClient.get('/posts/', { author: username, doctors_only: 'true' });
            const posts = data.results || data;
            this.doctorPosts = posts;
            grid.innerHTML = '';
            if (!posts.length) {
                if (empty) {
                    empty.hidden = false;
                    empty.style.display = '';
                }
                return;
            }
            if (empty) {
                empty.hidden = true;
                empty.style.display = 'none';
            }
            posts.forEach((post, index) => {
                const item = document.createElement('div');
                const isDoctorGrid = grid.id === 'doctorPostsGrid' || grid.classList.contains('dp-posts-grid') || grid.classList.contains('bn-profile-grid');
                item.className = isDoctorGrid ? 'bn-profile-grid-cell grid-cell-luxury' : 'post-grid-item';
                const thumb = PostCarousel.getMediaList(post)[0]?.url || post.media_url || post.image || DEFAULT_AVATAR;
                const isVideo = post.media_type === 'video' && !post.media_items?.length;
                const typeBadge = post.post_type === 'before_after'
                    ? '<span class="grid-type-badge">قبل/بعد</span>'
                    : (post.media_items?.length > 1 ? `<span class="grid-type-badge">${post.media_items.length}</span>` : '');
                item.innerHTML = `
                    ${this.isOwnProfile ? `<button type="button" class="profile-post-delete" data-delete-post="${post.id}" aria-label="حذف پست"><i class="fas fa-trash"></i></button>` : ''}
                    ${typeBadge}
                    ${isVideo ? `<video src="${thumb}" muted playsinline></video>` : `<img src="${thumb}" alt="" loading="lazy">`}
                    <div class="grid-cell-overlay">
                        <span><i class="fas fa-heart"></i> ${post.likes_count || 0}</span>
                        <span><i class="fas fa-comment"></i> ${post.comments_count || 0}</span>
                    </div>`;
                if (isDoctorGrid) {
                    item.addEventListener('click', () => this.openDoctorPost(index));
                }
                item.querySelector('[data-delete-post]')?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deletePost(post.id);
                });
                grid.appendChild(item);
            });
        } catch (e) {
            console.error(e);
        }
    }

    openDoctorPost(index) {
        const post = this.doctorPosts?.[index];
        if (!post) return;
        if (!this._exploreUi) {
            this._exploreUi = { bindEvents: () => {}, setupAuthUI: () => {} };
            document.getElementById('exploreModalClose')?.addEventListener('click', () => {
                const modal = document.getElementById('explorePostModal');
                if (modal?.classList.contains('open')) ModalLock.unlock();
                modal?.classList.remove('open');
            });
            document.getElementById('exploreModalBackdrop')?.addEventListener('click', () => {
                const modal = document.getElementById('explorePostModal');
                if (modal?.classList.contains('open')) ModalLock.unlock();
                modal?.classList.remove('open');
            });
        }
        PostCarousel.render(document.getElementById('exploreModalMedia'), post);
        const capEl = document.getElementById('exploreModalCaption');
        if (capEl) {
            capEl.innerHTML = `
                ${post.caption ? `<p class="modal-caption-title">${post.caption}</p>` : ''}
                ${post.description ? `<p class="modal-caption-desc">${post.description}</p>` : ''}`;
        }
        document.getElementById('explorePostModal')?.classList.add('open');
        ModalLock.lock();
    }

    async deletePost(postId) {
        if (!postId || !confirm('این پست حذف شود؟')) return;
        showLoading();
        try {
            await apiClient.deletePost(postId);
            showToast('پست حذف شد', 'success');
            await this.loadUserPosts(this.user.username);
        } catch (e) {
            showToast(e.message || 'حذف پست انجام نشد', 'error');
        } finally {
            hideLoading();
        }
    }

    async loadFollowList(type) {
        const list = document.getElementById('followList');
        if (!list || !this.user) return;
        list.innerHTML = '<p class="text-muted">در حال بارگذاری...</p>';
        try {
            const data = type === 'followers'
                ? await apiClient.getUserFollowers(this.user.username)
                : await apiClient.getUserFollowing(this.user.username);
            list.innerHTML = '';
            data.forEach((row) => {
                const u = type === 'followers' ? row.follower : row.following;
                const item = document.createElement('a');
                item.className = 'follow-list-item';
                item.href = u.user_type === 'doctor'
                    ? `/doctor/${u.username}/`
                    : `/profile/${u.username}/`;
                item.innerHTML = `
                    <img src="${avatarUrl(u)}" alt="" class="avatar-sm">
                    <span>${u.full_name || u.username}</span>
                `;
                list.appendChild(item);
            });
            if (!data.length) {
                list.innerHTML = '<p class="text-muted">موردی یافت نشد</p>';
            }
        } catch (e) {
            list.innerHTML = '<p class="text-muted">خطا در بارگذاری</p>';
        }
    }

    async saveProfile() {
        const names = (document.getElementById('editFullname')?.value || '').trim().split(/\s+/);
        const first_name = names[0] || '';
        const last_name = names.slice(1).join(' ') || '';
        const payload = {
            first_name,
            last_name,
            bio: document.getElementById('editBio')?.value || '',
            email: document.getElementById('editEmail')?.value || '',
            phone: document.getElementById('editPhone')?.value || '',
        };
        showLoading();
        try {
            let updated;
            if (this._pendingAvatar) {
                const fd = new FormData();
                Object.entries(payload).forEach(([key, value]) => fd.append(key, value));
                fd.append('avatar', this._pendingAvatar);
                updated = await apiClient.updateProfileFormData(fd);
                this._pendingAvatar = null;
            } else {
                updated = await apiClient.updateProfile(payload);
            }
            this.user = updated;
            setAuthSession(getAuthToken(), updated);
            this.renderUserProfile(updated, true);
            document.getElementById('editProfileModal').style.display = 'none';
            showToast('پروفایل ذخیره شد', 'success');
            updateNavbarAuth();
        } catch (e) {
            showToast(e.message, 'error');
        } finally {
            hideLoading();
        }
    }

    async uploadAvatar(file) {
        showLoading();
        try {
            const fd = new FormData();
            fd.append('avatar', file);
            const updated = await apiClient.updateProfileFormData(fd);
            this.user = updated;
            this._pendingAvatar = null;
            setAuthSession(getAuthToken(), updated);
            const avatar = document.getElementById('profileAvatar');
            if (avatar) avatar.src = `${avatarUrl(updated)}?t=${Date.now()}`;
            const doctorAvatar = document.getElementById('doctorAvatar');
            if (doctorAvatar) doctorAvatar.src = `${avatarUrl(updated)}?t=${Date.now()}`;
            const editorialPhoto = document.getElementById('doctorEditorialPhoto');
            if (editorialPhoto) editorialPhoto.src = `${avatarUrl(updated)}?t=${Date.now()}`;
            updateNavbarAuth();
            const navAvatar = document.getElementById('navAvatar');
            if (navAvatar) navAvatar.src = `${avatarUrl(updated)}?t=${Date.now()}`;
            showToast('عکس پروفایل ذخیره شد', 'success');
        } catch (e) {
            showToast(e.message || 'آپلود عکس انجام نشد', 'error');
        } finally {
            hideLoading();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.profile-container')) {
        const pm = new ProfileManager();
        pm.init();
    }
});
