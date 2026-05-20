class APIClient {
    constructor(authManager) {
        this.authManager = authManager;
        this.baseURL = '/api';
    }

    /**
     * Generic request handler
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            ...options,
            headers: {
                ...this.authManager.getAuthHeaders(),
                ...options.headers,
            }
        };

        // Remove Content-Type for FormData
        if (options.body instanceof FormData) {
            delete config.headers['Content-Type'];
        }

        try {
            const response = await fetch(url, config);

            // Handle 401 - try to refresh token
            if (response.status === 401 && this.authManager.isAuthenticated()) {
                try {
                    await this.authManager.refreshToken();
                    // Retry request with new token
                    config.headers = {
                        ...this.authManager.getAuthHeaders(),
                        ...options.headers,
                    };
                    const retryResponse = await fetch(url, config);
                    return await this.handleResponse(retryResponse);
                } catch (refreshError) {
                    this.authManager.logout();
                    throw refreshError;
                }
            }

            return await this.handleResponse(response);
        } catch (error) {
            console.error(`API request failed: ${endpoint}`, error);
            throw error;
        }
    }

    /**
     * Handle API response
     */
    async handleResponse(response) {
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            
            if (!response.ok) {
                throw {
                    status: response.status,
                    message: data.detail || data.error || 'Request failed',
                    data: data
                };
            }
            
            return data;
        }

        if (!response.ok) {
            throw {
                status: response.status,
                message: `Request failed with status ${response.status}`,
            };
        }

        return response;
    }

    /**
     * GET request
     */
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        
        return this.request(url, {
            method: 'GET',
        });
    }

    /**
     * POST request
     */
    async post(endpoint, data = {}, isFormData = false) {
        const body = isFormData ? data : JSON.stringify(data);
        
        return this.request(endpoint, {
            method: 'POST',
            body: body,
        });
    }

    /**
     * PUT request
     */
    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    /**
     * PATCH request
     */
    async patch(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    /**
     * DELETE request
     */
    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE',
        });
    }

    // ==================== Posts API ====================

    /**
     * Get all posts (with pagination)
     */
    async getPosts(page = 1, pageSize = 10) {
        return this.get('/posts/', { page, page_size: pageSize });
    }

    /**
     * Get single post
     */
    async getPost(postId) {
        return this.get(`/posts/${postId}/`);
    }

    /**
     * Create new post
     */
    async createPost(formData) {
        return this.post('/posts/', formData, true);
    }

    /**
     * Update post
     */
    async updatePost(postId, data) {
        return this.patch(`/posts/${postId}/`, data);
    }

    /**
     * Delete post
     */
    async deletePost(postId) {
        return this.delete(`/posts/${postId}/`);
    }

    /**
     * Like a post
     */
    async likePost(postId) {
        return this.post(`/posts/${postId}/like/`);
    }

    /**
     * Unlike a post
     */
    async unlikePost(postId) {
        return this.post(`/posts/${postId}/unlike/`);
    }

    /**
     * Save a post
     */
    async savePost(postId) {
        return this.post(`/posts/${postId}/save/`);
    }

    /**
     * Unsave a post
     */
    async unsavePost(postId) {
        return this.post(`/posts/${postId}/unsave/`);
    }

    /**
     * Get post comments
     */
    async getComments(postId) {
        return this.get(`/posts/${postId}/comments/`);
    }

    /**
     * Add comment to post
     */
    async addComment(postId, text) {
        return this.post(`/posts/${postId}/comments/`, { text });
    }

    /**
     * Delete comment
     */
    async deleteComment(postId, commentId) {
        return this.delete(`/posts/${postId}/comments/${commentId}/`);
    }

    // ==================== User API ====================

    /**
     * Get current user
     */
    async getCurrentUser() {
        return this.get('/accounts/users/me/');
    }

    /**
     * Get user profile
     */
    async getUserProfile(username) {
        return this.get(`/accounts/users/${username}/`);
    }

    /**
     * Update user profile
     */
    async updateProfile(data) {
        return this.patch('/accounts/users/me/', data);
    }

    /**
     * Follow user
     */
    async followUser(userId) {
        return this.post(`/accounts/users/${userId}/follow/`);
    }

    /**
     * Unfollow user
     */
    async unfollowUser(userId) {
        return this.post(`/accounts/users/${userId}/unfollow/`);
    }

    // ==================== Stories API ====================

    /**
     * Get stories
     */
    async getStories() {
        return this.get('/stories/');
    }

    /**
     * Create story
     */
    async createStory(formData) {
        return this.post('/stories/', formData, true);
    }

    /**
     * View story
     */
    async viewStory(storyId) {
        return this.post(`/stories/${storyId}/view/`);
    }

    // ==================== Search API ====================

    /**
     * Search users
     */
    async searchUsers(query) {
        return this.get('/accounts/users/search/', { q: query });
    }

    /**
     * Search posts
     */
    async searchPosts(query) {
        return this.get('/posts/search/', { q: query });
    }

    // ==================== Notifications API ====================

    /**
     * Get notifications
     */
    async getNotifications() {
        return this.get('/notifications/');
    }

    /**
     * Mark notification as read
     */
    async markNotificationRead(notificationId) {
        return this.post(`/notifications/${notificationId}/read/`);
    }

    /**
     * Mark all notifications as read
     */
    async markAllNotificationsRead() {
        return this.post('/notifications/mark-all-read/');
    }
}

// Export singleton instance
const apiClient = new APIClient(authManager);
