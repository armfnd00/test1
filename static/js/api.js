/**
 * APIClient — درخواست‌های REST با Token
 */
class APIClient {
    constructor(authMgr) {
        this.authManager = authMgr;
        this.baseURL = '/api';
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const { response, data } = await authFetch(url, options);

        if (response.status === 401 && this.authManager.isAuthenticated() && !options.suppressAuthRedirect) {
            clearAuthSession();
            window.location.href = '/login/';
            throw { status: 401, message: 'نشست منقضی شده', data };
        }

        if (!response.ok) {
            throw {
                status: response.status,
                message: formatApiErrors(data),
                data,
            };
        }
        return data;
    }

    get(endpoint, params = {}) {
        const qs = new URLSearchParams(params).toString();
        const path = qs ? `${endpoint}?${qs}` : endpoint;
        return this.request(path, { method: 'GET' });
    }

    post(endpoint, data = {}, isFormData = false) {
        return this.request(endpoint, {
            method: 'POST',
            body: isFormData ? data : JSON.stringify(data),
        });
    }

    put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    patch(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    getPosts(page = 1) {
        return this.get('/posts/', { page });
    }

    getFeed(page = 1) {
        return this.get('/posts/feed/', { page });
    }

    getExplorePosts(page = 1, params = {}) {
        return this.get('/explore/feed/', { page, page_size: 18, ...params });
    }

    getExploreDoctors(limit = 10) {
        return this.get('/explore/doctors/', { limit });
    }

    getExploreSpecialties() {
        return this.get('/explore/specialties/');
    }

    smartSearch(q, params = {}) {
        return this.get('/explore/search/', { q, ...params });
    }

    getExploreMeta() {
        return this.get('/explore/meta/');
    }

    getPost(postId) {
        return this.get(`/posts/${postId}/`);
    }

    deletePost(postId) {
        return this.delete(`/posts/${postId}/`);
    }

    createPost(formData) {
        return this.post('/posts/', formData, true);
    }

    createStory(formData) {
        return this.post('/stories/', formData, true);
    }

    deleteStory(storyId) {
        return this.delete(`/stories/${storyId}/`);
    }

    getStoryRing() {
        return this.get('/stories/ring/');
    }

    getMyStories() {
        return this.get('/stories/my_stories/');
    }

    initiatePayment(appointmentId) {
        return this.post(`/appointments/appointments/${appointmentId}/pay/`);
    }

    likePost(postId) {
        return this.post(`/posts/${postId}/like/`);
    }

    unlikePost(postId) {
        return this.post(`/posts/${postId}/unlike/`);
    }

    savePost(postId) {
        return this.post(`/posts/${postId}/save/`);
    }

    unsavePost(postId) {
        return this.post(`/posts/${postId}/unsave/`);
    }

    getSavedPosts(params = {}) {
        return this.get('/posts/saved/', params);
    }

    getReviews(params = {}) {
        return this.get('/posts/reviews/', params);
    }

    addReview(data) {
        return this.post('/posts/reviews/', data);
    }

    listClinics(params = {}) {
        return this.get('/accounts/clinics/', params);
    }

    getClinicProfile(username) {
        return this.get(`/accounts/clinics/${username}/`);
    }

    getClinicDoctors(username) {
        return this.get(`/accounts/clinics/${username}/doctors/`);
    }

    joinClinic(username) {
        return this.post(`/accounts/clinics/${username}/join/`);
    }

    leaveClinic(username) {
        return this.post(`/accounts/clinics/${username}/leave/`);
    }

    removeClinicDoctor(username, doctorUsername) {
        return this.post(`/accounts/clinics/${username}/remove_doctor/`, {
            doctor_username: doctorUsername,
        });
    }

    getComments(postId) {
        return this.get(`/posts/${postId}/comments/`);
    }

    addComment(postId, text) {
        return this.post(`/posts/${postId}/comments/`, { text, post: postId });
    }

    getCurrentUser(options = {}) {
        if (!this._currentUserPromise || options.force) {
            this._currentUserPromise = this.request('/accounts/users/me/', {
                method: 'GET',
                suppressAuthRedirect: Boolean(options.suppressAuthRedirect),
            }).then((user) => {
                setAuthSession(getAuthToken(), user);
                return user;
            }).catch((error) => {
                this._currentUserPromise = null;
                throw error;
            });
        }
        return this._currentUserPromise;
    }

    getUserProfile(username) {
        return this.get(`/accounts/users/${username}/`);
    }

    updateProfile(data) {
        return this.patch('/accounts/users/update_profile/', data);
    }

    followUser(username) {
        return this.post(`/accounts/users/${username}/follow/`);
    }

    unfollowUser(username) {
        return this.post(`/accounts/users/${username}/unfollow/`);
    }

    getUserFollowers(username) {
        return this.get(`/accounts/users/${username}/followers/`);
    }

    getUserFollowing(username) {
        return this.get(`/accounts/users/${username}/following/`);
    }

    listDoctors(params = {}) {
        return this.get('/accounts/doctors/', params);
    }

    getDoctorProfile(username) {
        return this.get(`/accounts/doctors/${username}/`);
    }

    getMyDoctorProfile() {
        return this.get('/accounts/doctors/my_profile/');
    }

    updateDoctorProfile(data) {
        return this.patch('/accounts/doctors/update_my_profile/', data);
    }

    setDoctorProfileLayout(profileLayout) {
        return this.post('/accounts/doctors/set_layout/', { profile_layout: profileLayout });
    }

    updateClinicProfile(data) {
        return this.patch('/accounts/clinics/update_my_profile/', data);
    }

    searchUsers(q) {
        return this.get('/accounts/users/search/', { q });
    }

    searchPosts(q) {
        return this.get('/posts/', { search: q });
    }

    // ==================== Appointments API ====================

    getAppointmentStats() {
        return this.get('/appointments/appointments/stats/');
    }

    getAppointments(tab = 'all') {
        return this.get('/appointments/appointments/', { tab });
    }

    getAppointment(id) {
        return this.get(`/appointments/appointments/${id}/`);
    }

    bookAppointment(timeSlotId, notes = '') {
        return this.post('/appointments/appointments/book/', {
            time_slot_id: timeSlotId,
            notes,
        });
    }

    payAppointment(id) {
        return this.initiatePayment(id);
    }

    cancelAppointment(id, reason = '') {
        return this.post(`/appointments/appointments/${id}/cancel/`, { reason });
    }

    completeAppointment(id) {
        return this.post(`/appointments/appointments/${id}/complete/`);
    }

    getDoctorAvailableDates(doctorUsername) {
        return this.get('/appointments/time-slots/available_dates/', { doctor: doctorUsername });
    }

    getDoctorTimeSlots(doctorUsername, params = {}) {
        return this.get('/appointments/time-slots/', {
            doctor: doctorUsername,
            available_only: 'true',
            ...params,
        });
    }

    getMySchedule() {
        return this.get('/appointments/time-slots/my_schedule/');
    }

    createTimeSlot(data) {
        return this.post('/appointments/time-slots/', data);
    }

    bulkCreateTimeSlots(data) {
        return this.post('/appointments/time-slots/bulk_create/', data);
    }

    deleteTimeSlot(id) {
        return this.delete(`/appointments/time-slots/${id}/`);
    }

    getPatientRecords(params = {}) {
        return this.get('/appointments/patient-records/', params);
    }

    getPatientRecordAppointments() {
        return this.get('/appointments/patient-records/appointment_options/');
    }

    createPatientRecord(formData) {
        return this.post('/appointments/patient-records/', formData, true);
    }

    updatePatientRecord(id, formData) {
        return this.request(`/appointments/patient-records/${id}/`, {
            method: 'PATCH',
            body: formData,
        });
    }

    deletePatientRecord(id) {
        return this.delete(`/appointments/patient-records/${id}/`);
    }

    // ==================== Notifications ====================

    getNotifications(params = {}) {
        return this.get('/notifications/items/', params);
    }

    getUnreadNotificationCount() {
        return this.get('/notifications/items/unread_count/');
    }

    getNotificationPulse() {
        return this.get('/notifications/items/pulse/');
    }

    markNotificationRead(id) {
        return this.post(`/notifications/items/${id}/mark_read/`);
    }

    markAllNotificationsRead() {
        return this.post('/notifications/items/mark_all_read/');
    }

    deleteNotification(id) {
        return this.delete(`/notifications/items/${id}/remove/`);
    }

    getNotificationPreferences() {
        return this.get('/notifications/items/preferences/');
    }

    updateNotificationPreferences(data) {
        return this.patch('/notifications/items/preferences/', data);
    }

    // ==================== Wallet & Security ====================

    getWallet() {
        return this.get('/accounts/wallet/me/');
    }

    depositWallet(amount) {
        return this.post('/accounts/wallet/deposit/', { amount });
    }

    changePassword(data) {
        return this.post('/accounts/auth/change_password/', data);
    }

    updateProfileFormData(formData) {
        return this.request('/accounts/users/update_profile/', {
            method: 'PATCH',
            body: formData,
        });
    }

    // ==================== Messaging ====================

    getConversations() {
        return this.get('/messaging/');
    }

    startConversation(username) {
        return this.post('/messaging/start/', { username });
    }

    getConversationMessages(conversationId, params = {}) {
        return this.get(`/messaging/${conversationId}/messages/`, params);
    }

    sendMessage(conversationId, payload) {
        if (payload instanceof FormData) {
            return this.post(`/messaging/${conversationId}/send/`, payload, true);
        }
        return this.post(`/messaging/${conversationId}/send/`, { text: payload });
    }

    markConversationRead(conversationId) {
        return this.post(`/messaging/${conversationId}/read/`);
    }

    requestVideoCall(conversationId) {
        return this.post(`/messaging/${conversationId}/request_call/`);
    }

    acceptVideoCall(conversationId, callId) {
        return this.post(`/messaging/${conversationId}/accept_call/`, { call_id: callId });
    }

    declineVideoCall(conversationId, callId) {
        return this.post(`/messaging/${conversationId}/decline_call/`, { call_id: callId });
    }

    endVideoCall(conversationId, callId, reason = 'ended') {
        return this.post(`/messaging/${conversationId}/end_call/`, { call_id: callId, reason });
    }

    signalVideoCall(conversationId, callId, kind, payload) {
        return this.post(`/messaging/${conversationId}/signal_call/`, { call_id: callId, kind, payload });
    }

    getVideoCallState(conversationId, callId) {
        return this.get(`/messaging/${conversationId}/call_state/`, { call_id: callId });
    }
}

const apiClient = new APIClient(authManager);
