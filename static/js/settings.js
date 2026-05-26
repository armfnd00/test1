/**
 * تنظیمات — حساب، کیف پول، اعلان، امنیت
 */
class SettingsPage {
    constructor() {
        this.user = null;
        this.doctorProfile = null;
        this.clinicProfile = null;
        this.locationPicker = null;
        this.maxAvatarSize = 10 * 1024 * 1024;
    }

    async init() {
        if (!requireAuth()) return;
        this.user = await apiClient.getCurrentUser();
        this.bindTabs();
        this.fillUserForm();
        await Promise.all([
            this.loadWallet(),
            this.loadNotificationPrefs(),
        ]);

        if (this.user.user_type === 'doctor') {
            document.getElementById('doctorSettingsNav')?.classList.remove('hidden');
            document.getElementById('locationSettingsNav')?.classList.remove('hidden');
            document.getElementById('locationPanelTitle').textContent = 'موقعیت مطب';
            await this.loadDoctorProfile();
            await this.initLocationPicker('مطب پزشک');
            this.openHashPanel();
        }
        if (this.user.user_type === 'clinic') {
            document.getElementById('clinicSettingsNav')?.classList.remove('hidden');
            document.getElementById('locationSettingsNav')?.classList.remove('hidden');
            document.getElementById('locationPanelTitle').textContent = 'موقعیت کلینیک';
            await this.loadClinicProfile();
            await this.initLocationPicker('کلینیک');
            this.openHashPanel();
        }

        this.bindForms();
    }

    async initLocationPicker(label) {
        this.locationPicker = new LuxLocationPicker({
            container: 'settingsLocationPicker',
            cityInput: 'locCity',
            addressInput: 'locAddress',
            latInput: 'locLat',
            lngInput: 'locLng',
            label,
        });
        await this.locationPicker.mount();
        this.fillLocationForm();
    }

    bindTabs() {
        this.activatePanel = (panelId, updateHash = false, allowHidden = false) => {
            const btn = document.querySelector(`.settings-nav-btn[data-panel="${panelId}"]`);
            const panel = document.getElementById(panelId);
            if (!btn || !panel) return;
            if (!allowHidden && btn.classList.contains('hidden')) return;
            document.querySelectorAll('.settings-nav-btn').forEach((b) => b.classList.remove('active'));
            document.querySelectorAll('.settings-panel').forEach((p) => p.classList.remove('active'));
            btn.classList.add('active');
            panel.classList.add('active');
            if (updateHash) history.replaceState(null, '', `#${panelId}`);
            if (panelId === 'panelLocation' && this.locationPicker?.map) {
                setTimeout(() => this.locationPicker.map.invalidateSize(), 250);
            }
        };

        document.querySelectorAll('.settings-nav-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.activatePanel(btn.dataset.panel, true);
            });
        });
        this.openHashPanel();
        window.addEventListener('hashchange', () => this.openHashPanel());
    }

    openHashPanel() {
        const panelId = window.location.hash?.replace('#', '');
        if (panelId) this.activatePanel?.(panelId);
    }

    fillUserForm() {
        const names = `${this.user.first_name || ''} ${this.user.last_name || ''}`.trim();
        document.getElementById('settingsFullname').value = names;
        document.getElementById('settingsEmail').value = this.user.email || '';
        document.getElementById('settingsPhone').value = this.user.phone || '';
        document.getElementById('settingsBio').value = this.user.bio || '';
        const preview = document.getElementById('settingsAvatarPreview');
        if (preview) preview.src = avatarUrl(this.user);
    }

    async loadDoctorProfile() {
        try {
            this.doctorProfile = await apiClient.getMyDoctorProfile();
            this.fillDoctorForm();
        } catch (e) {
            showToast(e.message, 'error');
        }
    }

    async loadClinicProfile() {
        try {
            this.clinicProfile = await apiClient.getClinicProfile(this.user.username);
            document.getElementById('clinicOfficialName').value = this.clinicProfile.official_name || '';
            document.getElementById('clinicServices').value = this.clinicProfile.services || '';
            document.getElementById('clinicWebsite').value = this.clinicProfile.website || '';
        } catch (e) {
            showToast(e.message, 'error');
        }
    }

    fillDoctorForm() {
        const p = this.doctorProfile;
        if (!p) return;
        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val ?? '';
        };
        set('doctorSpecialty', p.specialty);
        set('doctorLicense', p.license_number);
        set('doctorExperience', p.experience_years);
        set('doctorClinic', p.clinic_name);
        set('doctorFee', p.consultation_fee);
        const layout = p.profile_layout === 'luxury_editorial' ? 'luxury_editorial' : 'classic';
        const layoutInput = document.querySelector(`input[name="doctorProfileLayout"][value="${layout}"]`);
        if (layoutInput) layoutInput.checked = true;
    }

    fillLocationForm() {
        const profile = this.user.user_type === 'doctor' ? this.doctorProfile : this.clinicProfile;
        if (!profile || !this.locationPicker) return;
        const loc = profile.location || {};
        this.locationPicker.setValues({
            city: profile.city || loc.city || '',
            address: loc.address || profile.address || '',
            lat: loc.latitude != null ? String(loc.latitude) : '',
            lng: loc.longitude != null ? String(loc.longitude) : '',
        });
    }

    bindForms() {
        document.getElementById('settingsForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveUser();
        });
        document.getElementById('doctorSettingsForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveDoctor(false);
        });
        document.getElementById('clinicSettingsForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveClinic(false);
        });
        document.getElementById('locationSettingsForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            if (this.user.user_type === 'doctor') this.saveDoctor(true);
            else if (this.user.user_type === 'clinic') this.saveClinic(true);
        });
        document.getElementById('passwordForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.changePassword();
        });
        document.getElementById('notifPrefsForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveNotificationPrefs(false);
        });
        document.getElementById('privacyForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveNotificationPrefs(true);
        });
        document.getElementById('walletDepositForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.depositWallet();
        });

        document.getElementById('settingsAvatarInput')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
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
                document.getElementById('settingsAvatarPreview').src = URL.createObjectURL(file);
                this._pendingAvatar = file;
                this.uploadAvatar(file);
            }
        });

        document.querySelectorAll('input[name="doctorProfileLayout"]').forEach((input) => {
            input.addEventListener('change', () => {
                if (this.user?.user_type === 'doctor') this.saveDoctorLayoutOnly(input.value);
            });
        });

        document.getElementById('settingsLogout')?.addEventListener('click', logout);
    }

    locationPayload() {
        const loc = this.locationPicker?.getValues() || {};
        return {
            city: loc.city || document.getElementById('locCity')?.value?.trim() || '',
            address: loc.address || document.getElementById('locAddress')?.value?.trim() || '',
            latitude: loc.latitude,
            longitude: loc.longitude,
        };
    }

    async saveUser() {
        const parts = document.getElementById('settingsFullname').value.trim().split(/\s+/);
        showLoading();
        try {
            let updated;
            if (this._pendingAvatar) {
                const fd = new FormData();
                fd.append('first_name', parts[0] || '');
                fd.append('last_name', parts.slice(1).join(' ') || '');
                fd.append('email', document.getElementById('settingsEmail').value);
                fd.append('phone', document.getElementById('settingsPhone').value);
                fd.append('bio', document.getElementById('settingsBio').value);
                fd.append('avatar', this._pendingAvatar);
                updated = await apiClient.updateProfileFormData(fd);
                this._pendingAvatar = null;
            } else {
                updated = await apiClient.updateProfile({
                    first_name: parts[0] || '',
                    last_name: parts.slice(1).join(' ') || '',
                    email: document.getElementById('settingsEmail').value,
                    phone: document.getElementById('settingsPhone').value,
                    bio: document.getElementById('settingsBio').value,
                });
            }
            this.user = updated;
            setAuthSession(getAuthToken(), updated);
            updateNavbarAuth();
            showToast('اطلاعات ذخیره شد', 'success');
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
            updateNavbarAuth();
            const preview = document.getElementById('settingsAvatarPreview');
            if (preview) preview.src = `${avatarUrl(updated)}?t=${Date.now()}`;
            const navAvatar = document.getElementById('navAvatar');
            if (navAvatar) navAvatar.src = `${avatarUrl(updated)}?t=${Date.now()}`;
            showToast('عکس پروفایل ذخیره شد', 'success');
        } catch (e) {
            showToast(e.message || 'آپلود عکس انجام نشد', 'error');
        } finally {
            hideLoading();
        }
    }

    async saveClinic(locationOnly) {
        showLoading();
        try {
            const data = locationOnly ? this.locationPayload() : {
                official_name: document.getElementById('clinicOfficialName').value,
                services: document.getElementById('clinicServices').value,
                website: document.getElementById('clinicWebsite').value,
                ...this.locationPayload(),
            };
            if (locationOnly) {
                Object.keys(data).forEach((k) => {
                    if (!['city', 'address', 'latitude', 'longitude'].includes(k)) delete data[k];
                });
            }
            this.clinicProfile = await apiClient.updateClinicProfile(data);
            this.fillLocationForm();
            showToast(locationOnly ? 'موقعیت ذخیره شد' : 'پروفایل کلینیک ذخیره شد', 'success');
        } catch (e) {
            showToast(e.message, 'error');
        } finally {
            hideLoading();
        }
    }

    async saveDoctor(locationOnly) {
        showLoading();
        try {
            const data = locationOnly ? this.locationPayload() : {
                experience_years: parseInt(document.getElementById('doctorExperience')?.value, 10) || 0,
                consultation_fee: parseInt(document.getElementById('doctorFee')?.value, 10) || 0,
                profile_layout: document.querySelector('input[name="doctorProfileLayout"]:checked')?.value || 'classic',
            };
            if (!locationOnly) {
                const specialty = document.getElementById('doctorSpecialty')?.value;
                const licenseNumber = document.getElementById('doctorLicense')?.value?.trim();
                const clinicName = document.getElementById('doctorClinic')?.value?.trim();
                if (specialty) data.specialty = specialty;
                if (licenseNumber) data.license_number = licenseNumber;
                if (clinicName) data.clinic_name = clinicName;
            }
            if (locationOnly) {
                Object.keys(data).forEach((k) => {
                    if (!['city', 'address', 'latitude', 'longitude'].includes(k)) delete data[k];
                });
            }
            this.doctorProfile = await apiClient.updateDoctorProfile(data);
            this.fillDoctorForm();
            this.fillLocationForm();
            showToast(locationOnly ? 'موقعیت ذخیره شد' : 'پروفایل پزشک ذخیره شد', 'success');
        } catch (e) {
            showToast(e.message, 'error');
        } finally {
            hideLoading();
        }
    }

    async saveDoctorLayoutOnly(layout) {
        showLoading();
        try {
            this.doctorProfile = await apiClient.setDoctorProfileLayout(layout);
            this.fillDoctorForm();
            showToast('حالت نمایش پروفایل ذخیره شد', 'success');
        } catch (e) {
            if (this.doctorProfile) this.fillDoctorForm();
            showToast(e.message || 'ذخیره حالت نمایش انجام نشد', 'error');
        } finally {
            hideLoading();
        }
    }

    async changePassword() {
        const old_password = document.getElementById('oldPassword').value;
        const new_password = document.getElementById('newPassword').value;
        const new_password_confirm = document.getElementById('newPasswordConfirm').value;
        if (new_password !== new_password_confirm) {
            showToast('رمز جدید و تکرار آن یکسان نیست', 'error');
            return;
        }
        showLoading();
        try {
            const res = await apiClient.changePassword({ old_password, new_password, new_password_confirm });
            if (res.token) {
                setAuthSession(res.token, this.user);
            }
            document.getElementById('passwordForm').reset();
            showToast('رمز عبور با موفقیت تغییر کرد', 'success');
        } catch (e) {
            showToast(e.message, 'error');
        } finally {
            hideLoading();
        }
    }

    async saveNotificationPrefs(privacyOnly) {
        showLoading();
        try {
            const payload = privacyOnly ? {
                profile_private: document.getElementById('prefPrivateProfile').checked,
                email_digest: document.getElementById('prefEmailDigest').checked,
            } : {
                notify_likes: document.getElementById('prefLikes').checked,
                notify_comments: document.getElementById('prefComments').checked,
                notify_follows: document.getElementById('prefFollows').checked,
                notify_messages: document.getElementById('prefMessages').checked,
                notify_appointments: document.getElementById('prefAppointments').checked,
                notify_reviews: document.getElementById('prefReviews').checked,
                notify_system: document.getElementById('prefSystem').checked,
            };
            await apiClient.updateNotificationPreferences(payload);
            showToast('تنظیمات ذخیره شد', 'success');
        } catch (e) {
            showToast(e.message, 'error');
        } finally {
            hideLoading();
        }
    }

    async depositWallet() {
        const amount = parseInt(document.getElementById('walletDepositAmount').value, 10);
        if (!amount || amount < 10000) {
            showToast('حداقل مبلغ شارژ ۱۰٬۰۰۰ تومان', 'error');
            return;
        }
        showLoading();
        try {
            const res = await apiClient.depositWallet(amount);
            document.getElementById('walletDepositAmount').value = '';
            await this.loadWallet();
            showToast(res.message || 'کیف پول شارژ شد', 'success');
        } catch (e) {
            showToast(e.message, 'error');
        } finally {
            hideLoading();
        }
    }

    async loadWallet() {
        try {
            const wallet = await apiClient.getWallet();
            document.getElementById('walletBalance').textContent =
                Number(wallet.balance || 0).toLocaleString('fa-IR');
            this.renderTransactions(wallet.transactions || []);
        } catch (e) {
            document.getElementById('walletTransactions').innerHTML =
                `<p class="text-muted">${e.message || 'خطا در بارگذاری کیف پول'}</p>`;
        }
    }

    renderTransactions(items) {
        const box = document.getElementById('walletTransactions');
        if (!items.length) {
            box.innerHTML = '<p class="text-muted">هنوز تراکنشی ثبت نشده</p>';
            return;
        }
        box.innerHTML = '';
        items.forEach((tx) => {
            const row = document.createElement('div');
            row.className = 'wallet-tx-row';
            const positive = tx.amount > 0;
            row.innerHTML = `
                <div class="wallet-tx-info">
                    <strong>${tx.description || tx.type_display}</strong>
                    <small>${new Date(tx.created_at).toLocaleDateString('fa-IR')}</small>
                </div>
                <span class="wallet-tx-amount ${positive ? 'positive' : 'negative'}">
                    ${positive ? '+' : ''}${Number(tx.amount).toLocaleString('fa-IR')}
                </span>`;
            box.appendChild(row);
        });
    }

    async loadNotificationPrefs() {
        try {
            const prefs = await apiClient.getNotificationPreferences();
            document.getElementById('prefLikes').checked = prefs.notify_likes;
            document.getElementById('prefComments').checked = prefs.notify_comments;
            document.getElementById('prefFollows').checked = prefs.notify_follows;
            document.getElementById('prefMessages').checked = prefs.notify_messages;
            document.getElementById('prefAppointments').checked = prefs.notify_appointments;
            document.getElementById('prefReviews').checked = prefs.notify_reviews;
            document.getElementById('prefSystem').checked = prefs.notify_system;
            document.getElementById('prefPrivateProfile').checked = prefs.profile_private;
            document.getElementById('prefEmailDigest').checked = prefs.email_digest;
        } catch (e) {
            console.warn('prefs', e);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.settings-layout')) {
        new SettingsPage().init();
    }
});
