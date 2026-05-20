// Feed Management
class FeedManager {
    constructor() {
        this.currentPage = 1;
        this.hasMore = true;
        this.isLoading = false;
        this.currentPostId = null;
        this.currentMediaIndex = 0;
        
        this.init();
    }
    
    init() {
        this.loadUserInfo();
        this.loadStories();
        this.loadFeed();
        this.setupEventListeners();
        this.setupInfiniteScroll();
    }
    
    setupEventListeners() {
        // Create Post
        document.getElementById('createPostInput')?.addEventListener('click', () => {
            this.openCreatePostModal();
        });
        
        document.getElementById('uploadPhotoBtn')?.addEventListener('click', () => {
            this.openCreatePostModal();
        });
        
        document.getElementById('selectFilesBtn')?.addEventListener('click', () => {
            document.getElementById('postImageInput').click();
        });
        
        document.getElementById('postImageInput')?.addEventListener('change', (e) => {
            this.handleImageSelect(e);
        });
        
        document.getElementById('removeImageBtn')?.addEventListener('click', () => {
            this.removeImage();
        });
        
        document.getElementById('postCaption')?.addEventListener('input', (e) => {
            this.updateCaptionCount(e.target.value);
            this.validatePostForm();
        });
        
        document.getElementById('createPostForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitPost();
        });
        
        // Modal Controls
        document.getElementById('closeCreatePostModal')?.addEventListener('click', () => {
            this.closeModal('createPostModal');
        });
        
        document.getElementById('cancelCreatePostBtn')?.addEventListener('click', () => {
            this.closeModal('createPostModal');
        });
        
        document.getElementById('closePostDetailModal')?.addEventListener('click', () => {
            this.closeModal('postDetailModal');
        });
        
        document.getElementById('closeShareModal')?.addEventListener('click', () => {
            this.closeModal('shareModal');
        });
        
        // Stories Navigation
        document.getElementById('storiesNext')?.addEventListener('click', () => {
            this.scrollStories('next');
        });
        
        // Share
        document.getElementById('sharePostBtn')?.addEventListener('click', () => {
            this.openShareModal();
        });
        
        // Comment in Detail Modal
        document.getElementById('submitCommentDetailBtn')?.addEventListener('click', () => {
            this.submitComment();
        });
        
        document.getElementById('commentDetailInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.submitComment();
            }
        });
    }
    
    async loadUserInfo() {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/auth/login';
            return;
        }
        
        try {
            const response = await fetch('/api/accounts/users/me/', {
                headers: {
                    'Authorization': `Token ${token}`
                }
            });
            
            if (response.ok) {
                const user = await response.json();
                this.updateUserUI(user);
            }
        } catch (error) {
            console.error('Error loading user info:', error);
        }
    }
    
    updateUserUI(user) {
        const avatarUrl = user.avatar || '/static/images/default-avatar.png';
        
        // Update all avatar elements
        document.querySelectorAll('#createPostAvatar, #sidebarAvatar, #postAuthorAvatar').forEach(img => {
            img.src = avatarUrl;
        });
        
        // Update username
        document.getElementById('sidebarUsername').textContent = user.username;
        document.getElementById('sidebarFullname').textContent = user.full_name || user.username;
        document.getElementById('postAuthorName').textContent = user.username;
    }
    
    async loadStories() {
        // Mock stories data - replace with API call
        const stories = [
            { id: 1, username: 'doctor_beauty', avatar: '/static/images/default-avatar.png' },
            { id: 2, username: 'skin_clinic', avatar: '/static/images/default-avatar.png' },
            { id: 3, username: 'beauty_expert', avatar: '/static/images/default-avatar.png' },
            { id: 4, username: 'laser_center', avatar: '/static/images/default-avatar.png' },
            { id: 5, username: 'beauty_tips', avatar: '/static/images/default-avatar.png' }
        ];
        
        const wrapper = document.getElementById('storiesWrapper');
        const addStory = wrapper.querySelector('.add-story');
        
        stories.forEach(story => {
            const storyEl = document.createElement('div');
            storyEl.className = 'story-item';
            storyEl.innerHTML = `
                <div class="story-avatar">
                    <img src="${story.avatar}" alt="${story.username}">
                </div>
                <span class="story-username">${story.username}</span>
            `;
            wrapper.appendChild(storyEl);
        });
    }
    
    async loadFeed(page = 1) {
        if (this.isLoading || !this.hasMore) return;
        
        this.isLoading = true;
        const feedContainer = document.getElementById('postsFeed');
        
        try {
            // Mock posts data - replace with API call
            const posts = this.getMockPosts(page);
            
            if (page === 1) {
                feedContainer.innerHTML = '';
            }
            
            posts.forEach(post => {
                feedContainer.appendChild(this.createPostCard(post));
            });
            
            this.hasMore = posts.length > 0;
            this.currentPage = page;
            
            if (this.hasMore) {
                document.getElementById('loadMorePosts').style.display = 'block';
            }
        } catch (error) {
            console.error('Error loading feed:', error);
            feedContainer.innerHTML = '<p class="error-message">خطا در بارگذاری پست‌ها</p>';
        } finally {
            this.isLoading = false;
        }
    }
    
    getMockPosts(page) {
        // Mock data - replace with real API
        if (page > 2) return [];
        
        return [
            {
                id: 1,
                author: {
                    username: 'doctor_beauty',
                    avatar: '/static/images/default-avatar.png',
                    full_name: 'دکتر زیبایی'
                },
                image: 'https://via.placeholder.com/600x600/e8d5c4/4a7c59?text=Post+1',
                caption: 'نتیجه لیزر موهای زائد بعد از 6 جلسه 🌟',
                likes_count: 245,
                comments_count: 18,
                is_liked: false,
                is_saved: false,
                created_at: '2 ساعت پیش',
                location: 'تهران، ایران'
            },
            {
                id: 2,
                author: {
                    username: 'skin_clinic',
                    avatar: '/static/images/default-avatar.png',
                    full_name: 'کلینیک پوست'
                },
                image: 'https://via.placeholder.com/600x600/e8d5c4/4a7c59?text=Post+2',
                caption: 'جوانسازی پوست با تکنولوژی روز دنیا ✨',
                likes_count: 189,
                comments_count: 12,
                is_liked: true,
                is_saved: false,
                created_at: '5 ساعت پیش'
            },
            {
                id: 3,
                author: {
                    username: 'beauty_expert',
                    avatar: '/static/images/default-avatar.png',
                    full_name: 'متخصص زیبایی'
                },
                image: 'https://via.placeholder.com/600x600/e8d5c4/4a7c59?text=Post+3',
                caption: 'مراقبت از پوست در فصل زمستان ❄️',
                likes_count: 312,
                comments_count: 24,
                is_liked: false,
                is_saved: true,
                created_at: '1 روز پیش'
            }
        ];
    }
    
    createPostCard(post) {
        const card = document.createElement('div');
        card.className = 'post-card';
        card.dataset.postId = post.id;
        
        card.innerHTML = `
            <div class="post-header">
                <div class="post-author">
                    <img src="${post.author.avatar}" alt="${post.author.username}">
                    <div class="post-author-info">
                        <h3>${post.author.username}</h3>
                        ${post.location ? `<span class="post-location">${post.location}</span>` : ''}
                    </div>
                </div>
                <button class="btn-icon">
                    <i class="fas fa-ellipsis-h"></i>
                </button>
            </div>
            
            <img src="${post.image}" alt="Post" class="post-image" onclick="feedManager.openPostDetail(${post.id})">
            
            <div class="post-actions">
                <div class="action-buttons-left">
                    <button class="btn-icon btn-like ${post.is_liked ? 'liked' : ''}" onclick="feedManager.toggleLike(${post.id}, this)">
                        <i class="${post.is_liked ? 'fas' : 'far'} fa-heart"></i>
                    </button>
                    <button class="btn-icon" onclick="feedManager.openPostDetail(${post.id})">
                        <i class="far fa-comment"></i>
                    </button>
                    <button class="btn-icon">
                        <i class="far fa-paper-plane"></i>
                    </button>
                </div>
                <button class="btn-icon btn-save ${post.is_saved ? 'saved' : ''}" onclick="feedManager.toggleSave(${post.id}, this)">
                    <i class="${post.is_saved ? 'fas' : 'far'} fa-bookmark"></i>
                </button>
            </div>
            
            <div class="post-likes">
                <span class="likes-count">${post.likes_count}</span> لایک
            </div>
            
            <div class="post-caption">
                <strong>${post.author.username}</strong>
                ${post.caption}
            </div>
            
            ${post.comments_count > 0 ? `
                <div class="post-comments-link" onclick="feedManager.openPostDetail(${post.id})">
                    مشاهده ${post.comments_count} نظر
                </div>
            ` : ''}
            
            <div class="post-time">${post.created_at}</div>
            
            <div class="add-comment">
                <button class="btn-icon emoji-btn">
                    <i class="far fa-smile"></i>
                </button>
                <input type="text" placeholder="نظر خود را بنویسید..." class="comment-input" data-post-id="${post.id}">
                <button class="btn-text" onclick="feedManager.addQuickComment(${post.id})">ارسال</button>
            </div>
        `;
        
        return card;
    }
    
    openCreatePostModal() {
        document.getElementById('createPostModal').classList.add('active');
    }
    
    handleImageSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('previewImage').src = e.target.result;
            document.getElementById('uploadPlaceholder').style.display = 'none';
            document.getElementById('imagePreview').style.display = 'block';
            this.validatePostForm();
        };
        reader.readAsDataURL(file);
    }
    
    removeImage() {
        document.getElementById('postImageInput').value = '';
        document.getElementById('uploadPlaceholder').style.display = 'flex';
        document.getElementById('imagePreview').style.display = 'none';
        this.validatePostForm();
    }
    
    updateCaptionCount(text) {
        document.getElementById('captionCount').textContent = text.length;
    }
    
    validatePostForm() {
        const hasImage = document.getElementById('imagePreview').style.display !== 'none';
        const hasCaption = document.getElementById('postCaption').value.trim().length > 0;
        
        document.getElementById('submitPostBtn').disabled = !hasImage && !hasCaption;
    }
    
    async submitPost() {
        const caption = document.getElementById('postCaption').value.trim();
        const imageInput = document.getElementById('postImageInput');
        const privacy = document.getElementById('postPrivacy').value;
        const disableComments = document.getElementById('disableComments').checked;
        
        const formData = new FormData();
        if (imageInput.files[0]) {
            formData.append('image', imageInput.files[0]);
        }
        formData.append('caption', caption);
        formData.append('privacy', privacy);
        formData.append('comments_enabled', !disableComments);
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/posts/', {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${token}`
                },
                body: formData
            });
            
            if (response.ok) {
                this.closeModal('createPostModal');
                this.resetCreatePostForm();
                this.loadFeed(1);
                this.showNotification('پست شما با موفقیت منتشر شد', 'success');
            } else {
                throw new Error('Failed to create post');
            }
        } catch (error) {
            console.error('Error creating post:', error);
            this.showNotification('خطا در انتشار پست', 'error');
        }
    }
    
    resetCreatePostForm() {
        document.getElementById('createPostForm').reset();
        this.removeImage();
        document.getElementById('captionCount').textContent = '0';
    }
    
    async toggleLike(postId, button) {
        const isLiked = button.classList.contains('liked');
        const icon = button.querySelector('i');
        const likesCount = button.closest('.post-card').querySelector('.likes-count');
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/posts/${postId}/${isLiked ? 'unlike' : 'like'}/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${token}`
                }
            });
            
            if (response.ok) {
                button.classList.toggle('liked');
                icon.className = button.classList.contains('liked') ? 'fas fa-heart' : 'far fa-heart';
                
                const currentCount = parseInt(likesCount.textContent);
                likesCount.textContent = isLiked ? currentCount - 1 : currentCount + 1;
            }
        } catch (error) {
            console.error('Error toggling like:', error);
        }
    }
    
    async toggleSave(postId, button) {
        const isSaved = button.classList.contains('saved');
        const icon = button.querySelector('i');
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/posts/${postId}/${isSaved ? 'unsave' : 'save'}/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${token}`
                }
            });

            if (response.ok) {
                button.classList.toggle('saved');
                icon.className = button.classList.contains('saved') ? 'fas fa-bookmark' : 'far fa-bookmark';
            }
        } catch (error) {
            console.error('Error toggling save:', error);
        }
    }

    openPostDetail(postId) {
        this.currentPostId = postId;
        document.getElementById('postDetailModal').classList.add('active');
        this.loadPostDetail(postId);
    }

    async loadPostDetail(postId) {
        const commentsContainer = document.getElementById('postCommentsContainer');

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/posts/${postId}/`, {
                headers: {
                    'Authorization': `Token ${token}`
                }
            });

            if (!response.ok) throw new Error();

            const post = await response.json();

            document.getElementById('detailMediaContainer').innerHTML =
                `<img src="${post.image}" alt="Post">`;

            document.getElementById('detailAuthorAvatar').src = post.author.avatar || '/static/images/default-avatar.png';
            document.getElementById('detailAuthorUsername').textContent = post.author.username;

            commentsContainer.innerHTML = '';

            const captionEl = document.createElement('div');
            captionEl.className = 'comment-item caption-item';
            captionEl.innerHTML = `
                <img src="${post.author.avatar || '/static/images/default-avatar.png'}">
                <div class="comment-content">
                    <div class="comment-text">
                        <strong>${post.author.username}</strong> ${post.caption}
                    </div>
                </div>
            `;
            commentsContainer.appendChild(captionEl);

            post.comments.forEach(comment => {
                const commentEl = document.createElement('div');
                commentEl.className = 'comment-item';
                commentEl.innerHTML = `
                    <img src="${comment.user.avatar || '/static/images/default-avatar.png'}">
                    <div class="comment-content">
                        <div class="comment-text">
                            <strong>${comment.user.username}</strong> ${comment.text}
                        </div>
                        <div class="comment-meta">
                            <span>${comment.created_at}</span>
                        </div>
                    </div>
                `;
                commentsContainer.appendChild(commentEl);
            });

        } catch (error) {
            console.error('Error loading post detail:', error);
        }
    }

    async submitComment() {
        const input = document.getElementById('commentDetailInput');
        const text = input.value.trim();
        if (!text) return;

        try {
            const token = localStorage.getItem('token');

            const response = await fetch(`/api/posts/${this.currentPostId}/comments/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text })
            });

            if (response.ok) {
                input.value = '';
                this.loadPostDetail(this.currentPostId);
            }

        } catch (error) {
            console.error('Error submitting comment:', error);
        }
    }

    addQuickComment(postId) {
        const input = document.querySelector(`.comment-input[data-post-id="${postId}"]`);
        const text = input.value.trim();
        if (!text) return;

        this.submitQuickComment(postId, text);
        input.value = '';
    }

    async submitQuickComment(postId, text) {
        try {
            const token = localStorage.getItem('token');

            await fetch(`/api/posts/${postId}/comments/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text })
            });

        } catch (error) {
            console.error('Error adding comment:', error);
        }
    }

    setupInfiniteScroll() {
        window.addEventListener('scroll', () => {
            if (this.isLoading || !this.hasMore) return;

            const scrollTop = window.scrollY;
            const windowHeight = window.innerHeight;
            const docHeight = document.documentElement.scrollHeight;

            if (scrollTop + windowHeight >= docHeight - 300) {
                this.loadFeed(this.currentPage + 1);
            }
        });
    }

    scrollStories(direction) {
        const wrapper = document.getElementById('storiesWrapper');
        const scrollAmount = 300;

        if (direction === 'next') {
            wrapper.scrollLeft += scrollAmount;
        } else {
            wrapper.scrollLeft -= scrollAmount;
        }
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }

    openShareModal() {
        document.getElementById('shareModal').classList.add('active');
    }

    showNotification(message, type = 'info') {
        alert(message);
    }
}

const feedManager = new FeedManager();
