class AuthManager {
    constructor() {
        this.token = localStorage.getItem('authToken');
        this.user = null;
    }

    /**
     * Get CSRF token from cookie
     */
    getCSRFToken() {
        const name = 'csrftoken';
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        // Fallback to meta tag
        if (!cookieValue) {
            const metaTag = document.querySelector('meta[name="csrf-token"]');
            if (metaTag) {
                cookieValue = metaTag.getAttribute('content');
            }
        }
        return cookieValue;
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!this.token;
    }

    /**
     * Get current user info
     */
    async getCurrentUser() {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated');
        }

        try {
            const response = await fetch('/api/accounts/users/me/', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    this.logout();
                    throw new Error('Session expired');
                }
                throw new Error('Failed to fetch user info');
            }

            this.user = await response.json();
            return this.user;
        } catch (error) {
            console.error('Error fetching current user:', error);
            throw error;
        }
    }

    /**
     * Login with username and password
     */
    async login(username, password) {
        try {
            const response = await fetch('/api/auth/login/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken(),
                },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Login failed');
            }

            const data = await response.json();
            this.token = data.token || data.access;
            localStorage.setItem('authToken', this.token);
            
            await this.getCurrentUser();
            return this.user;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    /**
     * Register new user
     */
    async register(userData) {
        try {
            const response = await fetch('/api/auth/register/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken(),
                },
                body: JSON.stringify(userData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Registration failed');
            }

            const data = await response.json();
            this.token = data.token || data.access;
            localStorage.setItem('authToken', this.token);
            
            await this.getCurrentUser();
            return this.user;
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    }

    /**
     * Logout user
     */
    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('authToken');
        window.location.href = '/login/';
    }

    /**
     * Get auth headers for API requests
     */
    getAuthHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'X-CSRFToken': this.getCSRFToken(),
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        return headers;
    }

    /**
     * Refresh token (if using JWT)
     */
    async refreshToken() {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
            throw new Error('No refresh token available');
        }

        try {
            const response = await fetch('/api/auth/token/refresh/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken(),
                },
                body: JSON.stringify({ refresh: refreshToken })
            });

            if (!response.ok) {
                throw new Error('Token refresh failed');
            }

            const data = await response.json();
            this.token = data.access;
            localStorage.setItem('authToken', this.token);
            
            return this.token;
        } catch (error) {
            console.error('Token refresh error:', error);
            this.logout();
            throw error;
        }
    }
}

// Export singleton instance
const authManager = new AuthManager();
