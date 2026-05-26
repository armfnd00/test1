/**
 * فید اصلی — استوری، فیلتر، پست‌های پریمیوم
 */
class FeedApp {
    constructor() {
        this.page = 1;
        this.hasMore = true;
        this.loading = false;
        this.specialty = '';
        this.storyManager = null;
    }

    async init() {
        if (!requireAuth('/login/')) return;
        let user = getStoredUser();
        apiClient.getCurrentUser({ suppressAuthRedirect: true })
            .then((freshUser) => {
                user = freshUser;
                setAuthSession(getAuthToken(), freshUser);
                this.syncAppHeaderAvatar(freshUser);
            })
            .catch(() => {
                if (!user) clearAuthSession();
            });

        this.initStories();
        this.setupInfiniteScroll();
        await Promise.allSettled([this.loadCuratedDoctors(), this.loadPosts(1)]);
        this.syncAppHeaderAvatar(user);

        document.getElementById('postDetailClose')?.addEventListener('click', () => this.closeDetail());
        document.getElementById('postDetailModal')?.addEventListener('click', (e) => {
            if (e.target?.id === 'postDetailModal') this.closeDetail();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeDetail();
        });
    }

    syncAppHeaderAvatar(user) {
        const img = document.getElementById('appHeaderAvatar');
        const link = document.getElementById('appHeaderProfile');
        if (img && user) img.src = avatarUrl(user);
        if (link && user?.user_type === 'doctor') {
            link.href = `/doctor/${user.username}/`;
        } else if (link && user?.user_type === 'clinic') {
            link.href = `/clinic/${user.username}/`;
        }
    }

    async loadCuratedDoctors() {
        const section = document.getElementById('luxCuratedSection');
        const scroll = document.getElementById('luxCuratedDoctors');
        if (!scroll) return;
        try {
            const doctors = await apiClient.getExploreDoctors(6);
            if (!doctors.length) return;
            section.hidden = false;
            scroll.innerHTML = '';
            const icons = ['fa-spa', 'fa-syringe', 'fa-star', 'fa-leaf', 'fa-droplet', 'fa-gem'];
            doctors.forEach((d, i) => {
                const a = document.createElement('a');
                a.className = 'lux-service-card';
                a.href = d.profile_url || `/doctor/${d.username}/`;
                a.innerHTML = `
                    <div class="lux-service-card-media">
                        <img src="${avatarUrl(d)}" alt="">
                        <span class="lux-service-badge"><i class="fas ${icons[i % icons.length]}"></i></span>
                    </div>
                    <div class="lux-service-card-body">
                        <strong>${d.full_name || d.username}</strong>
                        <small>${d.specialty_display || ''} ${d.city ? '· ' + d.city : ''}</small>
                    </div>`;
                scroll.appendChild(a);
            });
        } catch (e) {
            console.warn('curated', e);
        }
    }

    async loadReels() {
        const section = document.getElementById('feedReelsSection');
        const scroll = document.getElementById('feedReels');
        if (!scroll) return;
        try {
            const data = await apiClient.getExplorePosts(1, { page_size: 12, media_type: 'video' });
            const videos = (data.results || []).filter((p) =>
                p.media_type === 'video' || p.media_items?.some((m) => m.media_type === 'video'),
            );
            if (!videos.length) return;
            section.hidden = false;
            scroll.innerHTML = '';
            videos.slice(0, 8).forEach((post) => {
                const url = post.media_url || post.media_items?.find((m) => m.media_type === 'video')?.url || '';
                const author = post.author?.full_name || post.author?.username || '';
                const card = document.createElement('article');
                card.className = 'pm-reel-card bn-lazy-enter bn-visible';
                card.innerHTML = `
                    ${url ? `<video src="${url}" muted playsinline loop preload="none" data-autoplay-on-view="1"></video>` : ''}
                    <div class="pm-reel-play"><i class="fas fa-play"></i></div>
                    <span class="pm-reel-label">${author}</span>`;
                card.addEventListener('mouseenter', () => card.querySelector('video')?.play().catch(() => {}));
                card.addEventListener('mouseleave', () => {
                    const v = card.querySelector('video');
                    if (v) { v.pause(); v.currentTime = 0; }
                });
                card.addEventListener('click', () => { window.location.href = `/doctor/${post.author?.username}/`; });
                scroll.appendChild(card);
            });
            requestAnimationFrame(() => window.BNPerf?.afterListPaint(scroll));
        } catch (e) {
            console.warn('reels', e);
        }
    }

    initStories() {
        this.storyManager = new StoryManager({
            containerId: 'feedStories',
            onOwnStory: null,
        });
        this.storyManager.load();
    }

    initFilters() {
        document.querySelectorAll('#feedFilters .filter-chip, #feedFilters .bn-pill').forEach((chip) => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('#feedFilters .filter-chip, #feedFilters .bn-pill').forEach((c) => c.classList.remove('active'));
                chip.classList.add('active');
                this.specialty = chip.dataset.specialty || '';
                this.resetFeed();
            });
        });
    }

    resetFeed() {
        this.page = 1;
        this.hasMore = true;
        document.getElementById('feedPosts').innerHTML = '';
        this.loadPosts(1);
    }

    setupInfiniteScroll() {
        const el = document.getElementById('feedSentinel');
        if (!el) return;
        new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && this.hasMore && !this.loading) {
                this.loadPosts(this.page + 1);
            }
        }, { rootMargin: '200px' }).observe(el);
    }

    async loadPosts(page) {
        if (this.loading || !this.hasMore) return;
        this.loading = true;
        const container = document.getElementById('feedPosts');
        const loader = document.getElementById('feedLoader');
        if (loader) {
            loader.hidden = true;
            loader.classList.add('hidden');
        }

        if (page === 1 && container) {
            window.BNPerf?.showSkeleton(container, 3, 'feed');
        }

        try {
            const params = { page, page_size: 10 };
            if (this.specialty) params.specialty = this.specialty;

            const data = await apiClient.getExplorePosts(page, params);
            const posts = data.results || data;

            if (page === 1) window.BNPerf?.clearSkeleton(container);

            const fragment = document.createDocumentFragment();
            posts.forEach((post, i) => {
                fragment.appendChild(this.buildPostCard(post, i));
            });
            container.appendChild(fragment);

            this.hasMore = Boolean(data.next);
            this.page = page;
            requestAnimationFrame(() => window.BNPerf?.afterListPaint(container));
        } catch (e) {
            window.BNPerf?.clearSkeleton(container);
            showToast(e.message || 'خطا در بارگذاری', 'error');
        } finally {
            this.loading = false;
            if (loader) {
                loader.hidden = true;
                loader.classList.add('hidden');
            }
        }
    }

    buildPostCard(post, index) {
        const card = document.createElement('article');
        card.className = 'bn-feed-card feed-post feed-post--cinema feed-post--iconic bn-lazy-enter bn-visible';
        card.style.transitionDelay = `${Math.min(index * 0.04, 0.24)}s`;

        const author = post.author || {};
        const specialty = post.doctor_specialty || '';
        const verified = post.doctor_verified ? '<i class="fas fa-check-circle verified-tick"></i>' : '';

        const typeLabel = this.getPostTypeLabel(post);
        const profilePath = author.user_type === 'clinic'
            ? `/clinic/${author.username}/`
            : `/doctor/${author.username}/`;
        const serviceLabel = post.doctor_specialty || post.specialty_display || typeLabel || 'خدمات زیبایی';

        card.innerHTML = `
            <div class="bn-feed-card__media feed-post-media-wrap">
                <header class="bn-feed-card__author">
                    <a href="${profilePath}" class="feed-post-author">
                        <img src="${avatarUrl(author)}" alt="" loading="lazy" decoding="async" width="40" height="40">
                        <div>
                            <strong>${verified}${author.full_name || author.username}</strong>
                            <small>${specialty}</small>
                        </div>
                    </a>
                </header>
                <div class="feed-post-media" data-post-id="${post.id}"></div>
            </div>
            <div class="bn-feed-card__body feed-post-body">
                <div class="feed-post-compact-actions" aria-label="تعاملات پست">
                    <span class="feed-post-service-type">${serviceLabel}</span>
                    <div class="feed-post-icon-actions">
                        <button type="button" class="feed-stat-pill like-btn ${post.is_liked ? 'liked' : ''}" data-id="${post.id}" aria-label="لایک">
                        <i class="${post.is_liked ? 'fas' : 'far'} fa-heart"></i>
                        <span class="likes-count">${post.likes_count || 0}</span>
                        </button>
                        <button type="button" class="feed-stat-pill comment-btn" data-id="${post.id}" aria-label="نظر">
                        <i class="far fa-comment"></i>
                        <span class="comments-count">${post.comments_count || 0}</span>
                        </button>
                        <button type="button" class="feed-stat-pill save-btn ${post.is_saved ? 'saved' : ''}" data-id="${post.id}" aria-label="ذخیره">
                            <i class="${post.is_saved ? 'fas' : 'far'} fa-bookmark"></i>
                        </button>
                    </div>
                    <a href="${profilePath}" class="feed-post-profile-icon" aria-label="مشاهده پروفایل">
                        <i class="fas fa-user-doctor"></i>
                    </a>
                </div>
                ${post.caption ? `<p class="bn-feed-card__caption feed-post-caption"><strong>${author.username}</strong> ${post.caption}</p>` : ''}
                ${post.description ? `<p class="bn-feed-card__desc feed-post-desc">${post.description}</p>` : ''}
            </div>`;

        const mediaEl = card.querySelector('.feed-post-media');
        this.renderPostMedia(mediaEl, post);

        if (card.querySelector('.like-btn')) {
            card.querySelectorAll('.like-btn').forEach((btn) => {
                btn.addEventListener('click', (e) => { e.stopPropagation(); this.toggleLike(post, card); });
            });
        }
        card.querySelectorAll('.comment-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); this.openDetail(post); });
        });
        card.querySelectorAll('.save-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); this.toggleSave(post, card); });
        });
        mediaEl.addEventListener('click', () => this.openDetail(post));
        return card;
    }

    getPostTypeLabel(post) {
        if (post.post_type === 'before_after') return 'قبل / بعد';
        if (post.media_type === 'video') return 'ویدیو';
        if ((post.media_items?.length || 0) > 1) return 'گالری';
        return 'تصویر';
    }

    renderPostMedia(el, post, options = {}) {
        if (!el) return;
        PostCarousel.destroy?.(el);
        if (post.post_type === 'before_after') {
            const items = post.media_items || [];
            const before = items.find((m) => m.label === 'before') || items[0];
            const after = items.find((m) => m.label === 'after') || items[1];
            if (before?.url && after?.url) {
                BeforeAfterSlider.mount(el, before.url, after.url);
                return;
            }
        }
        if (post.media_items?.length > 1) {
            PostCarousel.render(el, post);
            return;
        }
        const url = post.media_url || PostCarousel.getMediaList(post)[0]?.url;
        if (post.media_type === 'video' && url) {
            el.innerHTML = `<video src="${url}" ${options.controls ? 'controls' : ''} playsinline preload="${options.controls ? 'metadata' : 'none'}" controlsList="nodownload" data-autoplay-on-view="1"></video>`;
        } else if (url) {
            el.innerHTML = `<img src="${url}" alt="" loading="lazy" decoding="async">`;
        } else {
            el.innerHTML = '<div class="feed-media-empty"><i class="fas fa-image"></i><span>رسانه در دسترس نیست</span></div>';
        }
    }

    async toggleLike(post, card) {
        const me = getStoredUser();
        if (me?.user_type !== 'patient') {
            showToast('فقط بیماران می‌توانند لایک کنند', 'info');
            return;
        }
        try {
            if (post.is_liked) {
                await apiClient.unlikePost(post.id);
                post.is_liked = false;
                post.likes_count = Math.max(0, (post.likes_count || 1) - 1);
            } else {
                await apiClient.likePost(post.id);
                post.is_liked = true;
                post.likes_count = (post.likes_count || 0) + 1;
            }
            card.querySelectorAll('.like-btn').forEach((btn) => {
                btn.classList.toggle('liked', post.is_liked);
                const icon = btn.querySelector('i');
                if (icon) icon.className = post.is_liked ? 'fas fa-heart' : 'far fa-heart';
            });
            if (post.is_liked && window.PremiumUI) PremiumUI.animateLike(card.querySelector('.like-btn'));
            card.querySelector('.likes-count').textContent = post.likes_count;
        } catch (e) {
            showToast(e.message, 'error');
        }
    }

    async toggleSave(post, card) {
        if (!requireAuth()) return;
        try {
            if (post.is_saved) {
                await apiClient.unsavePost(post.id);
                post.is_saved = false;
            } else {
                await apiClient.savePost(post.id);
                post.is_saved = true;
            }
            card.querySelectorAll('.save-btn').forEach((btn) => {
                btn.classList.toggle('saved', post.is_saved);
                const icon = btn.querySelector('i');
                if (icon) icon.className = post.is_saved ? 'fas fa-bookmark' : 'far fa-bookmark';
            });
        } catch (e) {
            showToast(e.message, 'error');
        }
    }

    async openDetail(post) {
        const modal = document.getElementById('postDetailModal');
        const mediaEl = document.getElementById('postDetailMedia');
        const bodyEl = document.getElementById('postDetailBody');
        if (!modal || !mediaEl || !bodyEl) return;

        mediaEl.innerHTML = '<div class="post-detail-loading"><div class="spinner"></div></div>';
        bodyEl.innerHTML = '<div class="post-detail-loading-text">در حال آماده‌سازی پست...</div>';
        modal.classList.add('active', 'open', 'post-detail-modal--ready');
        modal.setAttribute('aria-hidden', 'false');
        ModalLock.lock();

        try {
            const full = await apiClient.getPost(post.id);
            post = { ...post, ...full };
        } catch (e) {
            console.warn(e);
        }
        let comments = [];
        try {
            const res = post.comments || await apiClient.getComments(post.id);
            comments = (res.results || res || []).slice(0, 8);
        } catch (e) {
            comments = [];
        }

        try {
            this.renderPostMedia(mediaEl, post, { controls: true });
        } catch (e) {
            console.warn('post media render failed', e);
            mediaEl.innerHTML = '<div class="feed-media-empty"><i class="fas fa-image"></i><span>نمایش رسانه انجام نشد</span></div>';
        }

        const commentsHtml = comments.length
            ? comments.map((comment) => `
                <div class="post-detail-comment">
                    <img src="${avatarUrl(comment.user)}" alt="">
                    <div><strong>${comment.user?.username || ''}</strong> ${comment.text || ''}</div>
                </div>`).join('')
            : '<p class="text-muted post-detail-empty-comments">هنوز نظری ثبت نشده</p>';

        bodyEl.innerHTML = `
            <div class="post-detail-author-line">
                <img src="${avatarUrl(post.author)}" alt="">
                <div>
                    <strong>${post.author?.full_name || post.author?.username}</strong>
                    <small>${post.doctor_specialty || ''}</small>
                </div>
            </div>
            <div class="feed-post-meta-row">
                <span class="feed-post-tag">${this.getPostTypeLabel(post)}</span>
                ${post.location ? `<span class="feed-post-tag feed-post-tag--soft">${post.location}</span>` : ''}
            </div>
            <div class="bn-feed-card__stats feed-post-stats">
                <span class="feed-stat-pill"><i class="fas fa-heart"></i><span>${post.likes_count || 0}</span><small>لایک</small></span>
                <span class="feed-stat-pill"><i class="far fa-comment"></i><span>${post.comments_count || 0}</span><small>نظر</small></span>
            </div>
            ${post.caption ? `<p class="modal-caption-title">${post.caption}</p>` : ''}
            ${post.description ? `<p class="modal-caption-desc">${post.description}</p>` : ''}
            <div class="post-detail-comments">
                <h4>کامنت‌ها</h4>
                ${commentsHtml}
            </div>
            <form class="comment-form post-detail-comment-form" id="feedDetailCommentForm">
                <input type="text" id="feedDetailCommentInput" placeholder="${post.comments_enabled === false ? 'نظرات این پست غیرفعال است' : 'نظر بنویسید...'}" ${post.comments_enabled === false ? 'disabled' : ''}>
                <button type="submit" class="btn-text" ${post.comments_enabled === false ? 'disabled' : ''}>ارسال</button>
            </form>`;
        document.getElementById('feedDetailCommentForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.submitDetailComment(post);
        });
        requestAnimationFrame(() => window.BNPerf?.scanLazy(modal));
    }

    closeDetail() {
        const modal = document.getElementById('postDetailModal');
        if (!modal?.classList.contains('active')) return;
        modal.classList.remove('active', 'open', 'post-detail-modal--ready');
        modal.setAttribute('aria-hidden', 'true');
        ModalLock.unlock();
        const mediaEl = document.getElementById('postDetailMedia');
        const bodyEl = document.getElementById('postDetailBody');
        PostCarousel.destroy?.(mediaEl);
        if (mediaEl) mediaEl.innerHTML = '';
        if (bodyEl) bodyEl.innerHTML = '';
    }

    async submitDetailComment(post) {
        if (!requireAuth('/login/')) return;
        if (post.comments_enabled === false) {
            showToast('نظرات این پست غیرفعال است', 'info');
            return;
        }
        const input = document.getElementById('feedDetailCommentInput');
        const text = input?.value?.trim();
        if (!text) return;
        try {
            await apiClient.addComment(post.id, text);
            input.value = '';
            post.comments_count = (post.comments_count || 0) + 1;
            await this.openDetail(post);
            showToast('نظر ثبت شد', 'success');
        } catch (e) {
            showToast(e.message || 'ثبت نظر انجام نشد', 'error');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('feedPosts')) {
        new FeedApp().init();
    }
});
