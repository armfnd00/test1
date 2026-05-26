/**
 * اکسپلور BeautyNet — Masonry + الگوریتم + مودال اینستاگرامی
 */
class ExplorePage {
    constructor() {
        this.page = 1;
        this.hasMore = true;
        this.loading = false;
        this.specialty = '';
        this.search = '';
        this.currentPost = null;
        this.observer = null;
        this.videoObserver = null;
    }

    async init() {
        await this.setupAuthUI();
        this.bindEvents();
        this.setupInfiniteScroll();
        await this.loadFeed(1);
        this.highlightNav();
    }

    highlightNav() {
        document.querySelectorAll('.bottom-nav-fab').forEach((el) => {
            el.classList.add('active');
        });
    }

    _useAppGrid() {
        return document.getElementById('exploreMasonry')?.classList.contains('explore-app-grid');
    }

    initStories() {
        this.storyManager = new StoryManager({
            containerId: 'exploreStoriesWrapper',
            onOwnStory: null,
        });
        this.storyManager.load();
    }

    async setupAuthUI() {
        let commentEnabled = isLoggedIn();

        if (commentEnabled) {
            try {
                const me = await refreshAuthUser();
                commentEnabled = Boolean(me);
            } catch (e) {
                if (e?.status === 401) {
                    clearAuthSession();
                    commentEnabled = false;
                }
            }
        }

        this.syncCommentControls(null, commentEnabled);
    }

    bindEvents() {
        const search = document.getElementById('exploreSearch');
        search?.addEventListener('input', (e) => {
            clearTimeout(this._searchDebounce);
            this._searchDebounce = setTimeout(() => {
                this.search = e.target.value.trim();
                this.resetAndLoad();
            }, 450);
        });

        document.getElementById('exploreModalClose')?.addEventListener('click', () => this.closeModal());
        document.getElementById('exploreModalBackdrop')?.addEventListener('click', () => this.closeModal());

        document.getElementById('exploreModalLike')?.addEventListener('click', () => this.toggleLike());
        document.getElementById('exploreModalSave')?.addEventListener('click', () => this.toggleSave());
        document.getElementById('exploreModalShare')?.addEventListener('click', () => this.shareCurrentPost());
        document.getElementById('exploreCommentSubmit')?.addEventListener('click', () => this.submitComment());
        document.getElementById('exploreCommentInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.submitComment();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });

        document.querySelectorAll('.explore-trend-pill').forEach((pill) => {
            pill.addEventListener('click', (e) => {
                e.preventDefault();
                const val = pill.dataset.specialty || '';
                this.setSpecialty(val);
                document.querySelectorAll('.specialty-chip, .filter-chip').forEach((c) => {
                    c.classList.toggle('active', (c.dataset.value || '') === val);
                });
            });
        });
    }

    async loadSpecialties() {
        const container = document.getElementById('specialtyChips');
        if (!container) return;
        try {
            const specialties = await apiClient.getExploreSpecialties();
            const chipClass = container.classList.contains('filter-chips') ? 'filter-chip specialty-chip bn-pill' : 'specialty-chip bn-pill';
            if (!container.querySelector('[data-value=""]')) {
                const allBtn = document.createElement('button');
                allBtn.type = 'button';
                allBtn.className = `${chipClass} active`;
                allBtn.textContent = 'همه';
                allBtn.dataset.value = '';
                allBtn.addEventListener('click', () => this.setSpecialty(''));
                container.appendChild(allBtn);
            }

            specialties.forEach((s) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = chipClass;
                btn.textContent = s.label;
                btn.dataset.value = s.value;
                btn.addEventListener('click', () => this.setSpecialty(s.value));
                container.appendChild(btn);
            });
        } catch (e) {
            console.warn(e);
        }
    }

    setSpecialty(value) {
        this.specialty = value;
        document.querySelectorAll('.specialty-chip, #specialtyChips .filter-chip').forEach((chip) => {
            chip.classList.toggle('active', chip.dataset.value === value);
        });
        this.resetAndLoad();
    }

    async loadFeaturedDoctors() {
        const container = document.getElementById('featuredDoctors');
        if (!container) return;
        try {
            const doctors = await apiClient.getExploreDoctors(8);
            container.innerHTML = '';
            doctors.forEach((d) => {
                const a = document.createElement('a');
                a.className = 'featured-doctor-card';
                a.href = d.profile_url || `/doctor/${d.username}/`;
                a.innerHTML = `
                    <img src="${avatarUrl(d)}" alt="">
                    <div>
                        <strong>${d.full_name || d.username}</strong>
                        ${d.is_verified ? '<span class="verified"><i class="fas fa-check-circle"></i></span>' : ''}
                        <br><small>${d.specialty_display || ''} · ${d.city || ''}</small>
                    </div>
                `;
                container.appendChild(a);
            });
        } catch (e) {
            container.innerHTML = '<p class="text-muted">بارگذاری نشد</p>';
        }
    }

    resetAndLoad() {
        this.page = 1;
        this.hasMore = true;
        this.videoObserver?.disconnect();
        this.videoObserver = null;
        document.getElementById('exploreMasonry').innerHTML = '';
        this.loadFeed(1);
    }

    setupInfiniteScroll() {
        const sentinel = document.getElementById('exploreSentinel');
        if (!sentinel) return;
        this.observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && this.hasMore && !this.loading) {
                this.loadFeed(this.page + 1);
            }
        }, { rootMargin: '200px' });
        this.observer.observe(sentinel);
    }

    async loadFeed(page) {
        if (this.loading || !this.hasMore) return;
        this.loading = true;
        const masonry = document.getElementById('exploreMasonry');
        const loader = document.getElementById('exploreLoader');
        if (loader) {
            loader.hidden = true;
            loader.classList.add('hidden');
        }

        if (page === 1 && masonry) {
            window.BNPerf?.showSkeleton(masonry, 6, 'explore');
        }

        try {
            const params = { page, page_size: 18 };
            if (this.specialty) params.specialty = this.specialty;
            if (this.search) params.q = this.search;

            const data = await apiClient.getExplorePosts(page, params);
            const posts = this.shufflePosts(data.results || []);

            const countEl = document.getElementById('explorePostCount');
            if (countEl && data.count != null) {
                countEl.textContent = `${data.count} پست`;
            }

            const emptyEl = document.getElementById('exploreEmpty');
            if (emptyEl) {
                emptyEl.hidden = !(page === 1 && !posts.length);
            }

            if (page === 1) window.BNPerf?.clearSkeleton(masonry);

            const fragment = document.createDocumentFragment();
            posts.forEach((post, i) => fragment.appendChild(this.createCard(post, i)));
            masonry.appendChild(fragment);

            this.hasMore = Boolean(data.next);
            this.page = page;
            this.observeCardVideos(masonry);
            requestAnimationFrame(() => window.BNPerf?.afterListPaint(masonry));
        } catch (e) {
            window.BNPerf?.clearSkeleton(masonry);
            showToast(e.message || 'خطا در بارگذاری اکسپلور', 'error');
        } finally {
            this.loading = false;
            if (loader) {
                loader.hidden = true;
                loader.classList.add('hidden');
            }
        }
    }

    shufflePosts(posts) {
        const shuffled = [...posts];
        for (let i = shuffled.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    createCard(post, index = 0) {
        const card = document.createElement('article');
        let cls = this._useAppGrid()
            ? 'bn-explore-card explore-app-card explore-card iconic-card has-meta-lux bn-lazy-enter bn-visible'
            : 'explore-card hover-lift animate-in';
        if (this._useAppGrid()) {
            if (index % 7 === 0) cls += ' explore-app-card--wide';
            else if (index % 5 === 2 || index % 4 === 1) cls += ' explore-app-card--tall';
        }
        card.className = cls;
        card.dataset.postId = post.id;
        const items = post.media_items || [];
        const mediaList = PostCarousel.getMediaList(post);
        const firstMedia = mediaList[0];
        const isVideo = Boolean(firstMedia?.isVideo || (post.media_type === 'video' && !post.media_items?.length));
        const typeLabel = this.getPostTypeLabel(post);

        let mediaHtml = '';
        if (post.post_type === 'before_after' && items.length >= 2) {
            const before = items.find((m) => m.label === 'before') || items[0];
            const after = items.find((m) => m.label === 'after') || items[1];
            mediaHtml = `
                <div class="explore-ba-split">
                    <img src="${before.url}" alt="قبل" loading="lazy" decoding="async">
                    <img src="${after.url}" alt="بعد" loading="lazy" decoding="async">
                </div>
                <span class="explore-ba-label explore-ba-label--before">قبل</span>
                <span class="explore-ba-label explore-ba-label--after">بعد</span>`;
        } else {
            const media = firstMedia?.url || post.media_url || post.image;
            mediaHtml = isVideo
                ? `<video src="${media}" muted playsinline loop preload="none" data-explore-card-video="1"></video>`
                : `<img src="${media}" alt="" loading="lazy" decoding="async">`;
        }

        card.innerHTML = `
            <div class="explore-card-media card-carousel-mini">
                ${mediaHtml}
                ${PostCarousel.miniBadge(post)}
                <span class="explore-card-type-chip">${typeLabel}</span>
                <button type="button" class="explore-card-bookmark ${post.is_saved ? 'saved' : ''}" aria-label="ذخیره"><i class="${post.is_saved ? 'fas' : 'far'} fa-bookmark"></i></button>
                <div class="explore-card-overlay">
                    <div class="explore-card-overlay-actions">
                        <span><i class="fas fa-heart"></i> ${post.likes_count || 0}</span>
                        <span><i class="far fa-comment"></i> ${post.comments_count || 0}</span>
                    </div>
                    <strong>نمایش بزرگ</strong>
                </div>
            </div>
        `;

        card.addEventListener('click', (e) => {
            if (e.target.closest('.explore-card-bookmark')) return;
            this.openPost(post);
        });
        card.querySelector('.explore-card-bookmark')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!requireAuth()) return;
            try {
                if (post.is_saved) {
                    await apiClient.unsavePost(post.id);
                    post.is_saved = false;
                } else {
                    await apiClient.savePost(post.id);
                    post.is_saved = true;
                }
                e.currentTarget.querySelector('i').className = post.is_saved ? 'fas fa-bookmark' : 'far fa-bookmark';
                e.currentTarget.classList.toggle('saved', post.is_saved);
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
        const video = card.querySelector('video');
        if (video && window.matchMedia?.('(hover: hover)').matches) {
            card.addEventListener('mouseenter', () => {
                video.preload = 'metadata';
                video.play().catch(() => {});
            });
            card.addEventListener('mouseleave', () => { video.pause(); video.currentTime = 0; });
        }
        return card;
    }

    observeCardVideos(root) {
        if (!root) return;
        if (!('IntersectionObserver' in window)) return;
        if (!this.videoObserver) {
            this.videoObserver = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    const video = entry.target;
                    if (entry.isIntersecting && entry.intersectionRatio > 0.65) {
                        video.preload = 'metadata';
                    } else {
                        video.pause();
                        video.preload = 'none';
                    }
                });
            }, { threshold: [0, 0.65] });
        }
        root.querySelectorAll('video[data-explore-card-video]:not([data-video-observed])').forEach((video) => {
            video.dataset.videoObserved = '1';
            this.videoObserver.observe(video);
        });
    }

    getPostTypeLabel(post) {
        if (post.post_type === 'before_after') return 'قبل / بعد';
        if (post.media_type === 'video') return 'ویدیو';
        if ((post.media_items?.length || 0) > 1) return 'گالری';
        return 'تصویر';
    }

    async openPost(post) {
        this.currentPost = post;
        try {
            const full = await apiClient.getPost(post.id);
            this.currentPost = { ...post, ...full };
        } catch (e) {
            console.warn('Using list post data', e);
        }
        try {
            this.renderModal(this.currentPost);
            const modal = document.getElementById('explorePostModal');
            modal?.classList.add('open');
            modal?.setAttribute('aria-hidden', 'false');
            ModalLock.lock();
            requestAnimationFrame(() => window.BNPerf?.scanLazy(modal));
        } catch (e) {
            console.error(e);
            this.closeModal();
            showToast('نمایش پست انجام نشد. دوباره تلاش کنید.', 'error');
        }
    }

    renderModal(post) {
        const mediaEl = document.getElementById('exploreModalMedia');
        PostCarousel.render(mediaEl, post);

        const author = post.author || {};
        const profileUrl = author.user_type === 'clinic' ? `/clinic/${author.username}/` : `/doctor/${author.username}/`;
        document.getElementById('exploreModalAuthorLink')?.setAttribute('href', profileUrl);
        const avatar = document.getElementById('exploreModalAvatar');
        if (avatar) avatar.src = avatarUrl(author);
        const name = document.getElementById('exploreModalAuthorName');
        if (name) name.textContent = author.full_name || author.username || 'BeautyNet';
        const specialty = document.getElementById('exploreModalSpecialty');
        if (specialty) specialty.textContent =
            [post.doctor_specialty, post.doctor_city].filter(Boolean).join(' · ');

        const bookBtn = document.getElementById('exploreModalBookBtn');
        const bookUrl = `/booking/?doctor=${author.username}`;
        if (author.user_type === 'clinic') {
            if (bookBtn) {
                bookBtn.href = profileUrl;
                bookBtn.innerHTML = '<i class="fas fa-hospital"></i> پروفایل';
                bookBtn.onclick = null;
            }
        } else {
            if (bookBtn) {
                bookBtn.href = bookUrl;
                bookBtn.innerHTML = '<i class="fas fa-calendar-check"></i> نوبت';
                bookBtn.onclick = (e) => {
                    if (!isLoggedIn()) {
                        e.preventDefault();
                        showToast('برای رزرو نوبت وارد شوید', 'info');
                        window.location.href = `/login/?next=${encodeURIComponent(bookUrl)}`;
                    }
                };
            }
        }

        const capEl = document.getElementById('exploreModalCaption');
        if (capEl) {
            capEl.innerHTML = `
                ${post.caption ? `<p class="modal-caption-title">${post.caption}</p>` : ''}
                <div class="modal-post-meta-row">
                    <span class="modal-post-type">${this.getPostTypeLabel(post)}</span>
                    ${post.doctor_specialty ? `<span class="modal-post-type modal-post-type--soft">${post.doctor_specialty}</span>` : ''}
                </div>
                ${post.description ? `<p class="modal-caption-desc">${post.description}</p>` : ''}`;
        }
        document.getElementById('exploreModalLikes').textContent = post.likes_count || 0;
        const commentsCount = document.getElementById('exploreModalCommentsCount');
        if (commentsCount) commentsCount.textContent = post.comments_count || 0;

        const likeBtn = document.getElementById('exploreModalLike');
        likeBtn?.querySelector('i') && (likeBtn.querySelector('i').className = post.is_liked ? 'fas fa-heart' : 'far fa-heart');
        likeBtn?.classList.toggle('liked', post.is_liked);

        const saveBtn = document.getElementById('exploreModalSave');
        saveBtn?.querySelector('i') && (saveBtn.querySelector('i').className = post.is_saved ? 'fas fa-bookmark' : 'far fa-bookmark');
        saveBtn?.classList.toggle('saved', post.is_saved);

        this.syncCommentControls(post);
        this.loadModalComments(post.id);
    }

    syncCommentControls(post = null, authOverride = null) {
        const input = document.getElementById('exploreCommentInput');
        const submit = document.getElementById('exploreCommentSubmit');
        if (!input || !submit) return;

        const loggedIn = authOverride ?? isLoggedIn();
        const commentsEnabled = post?.comments_enabled !== false;
        input.disabled = !loggedIn || !commentsEnabled;
        submit.disabled = !loggedIn || !commentsEnabled;

        if (!loggedIn) {
            input.placeholder = 'برای نظر دادن وارد شوید';
        } else if (!commentsEnabled) {
            input.placeholder = 'نظرات این پست غیرفعال است';
        } else {
            input.placeholder = 'نظر بنویسید...';
        }
    }

    async loadModalComments(postId) {
        const box = document.getElementById('exploreModalComments');
        box.innerHTML = '<p class="text-muted">...</p>';
        try {
            const comments = await apiClient.getComments(postId);
            const list = comments.results || comments;
            box.innerHTML = '<h3 class="explore-comments-title">گفت‌وگوها</h3>';
            if (!list.length) {
                box.innerHTML += '<p class="text-muted explore-comments-empty">اولین نظر را بنویسید</p>';
                return;
            }
            list.forEach((c) => {
                const el = document.createElement('div');
                el.className = 'explore-modal-comment';
                el.innerHTML = `<img src="${avatarUrl(c.user)}" class="avatar-sm" alt="">
                    <div><strong>${c.user.full_name || c.user.username}</strong><p>${c.text}</p></div>`;
                box.appendChild(el);
            });
        } catch (e) {
            box.innerHTML = '<p class="text-muted">نظرات در دسترس نیست</p>';
        }
    }

    closeModal() {
        const modal = document.getElementById('explorePostModal');
        if (modal?.classList.contains('open')) ModalLock.unlock();
        modal?.classList.remove('open');
        modal?.setAttribute('aria-hidden', 'true');
        document.getElementById('exploreModalMedia').innerHTML = '';
    }

    async toggleLike() {
        if (!requireAuth('/login/')) return;
        const me = getStoredUser();
        if (me?.user_type !== 'patient') {
            showToast('فقط بیماران می‌توانند لایک کنند', 'info');
            return;
        }
        const post = this.currentPost;
        const btn = document.getElementById('exploreModalLike');
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
            btn.querySelector('i').className = post.is_liked ? 'fas fa-heart' : 'far fa-heart';
            btn.classList.toggle('liked', post.is_liked);
            document.getElementById('exploreModalLikes').textContent = post.likes_count;
            this.syncOpenCardStats(post);
        } catch (e) {
            showToast(e.message, 'error');
        }
    }

    async toggleSave() {
        if (!requireAuth('/login/')) return;
        const post = this.currentPost;
        try {
            if (post.is_saved) {
                await apiClient.unsavePost(post.id);
                post.is_saved = false;
                showToast('از ذخیره‌ها حذف شد', 'info');
            } else {
                await apiClient.savePost(post.id);
                post.is_saved = true;
                showToast('ذخیره شد', 'success');
            }
            document.getElementById('exploreModalSave').querySelector('i').className =
                post.is_saved ? 'fas fa-bookmark' : 'far fa-bookmark';
            document.getElementById('exploreModalSave').classList.toggle('saved', post.is_saved);
            document.querySelector(`.explore-app-card[data-post-id="${post.id}"] .explore-card-bookmark`)?.classList.toggle('saved', post.is_saved);
            const cardIcon = document.querySelector(`.explore-app-card[data-post-id="${post.id}"] .explore-card-bookmark i`);
            if (cardIcon) cardIcon.className = post.is_saved ? 'fas fa-bookmark' : 'far fa-bookmark';
        } catch (e) {
            showToast(e.message, 'error');
        }
    }

    async shareCurrentPost() {
        const post = this.currentPost;
        if (!post) return;
        const profilePath = post.author?.user_type === 'clinic'
            ? `/clinic/${post.author?.username || ''}/`
            : `/doctor/${post.author?.username || ''}/`;
        const url = `${window.location.origin}${profilePath}`;
        const title = post.caption || post.author?.full_name || 'BeautyNet';
        try {
            if (navigator.share) {
                await navigator.share({ title, url });
            } else if (navigator.clipboard) {
                await navigator.clipboard.writeText(url);
                showToast('لینک پست کپی شد', 'success');
            }
        } catch {
            // user cancelled share
        }
    }

    syncOpenCardStats(post) {
        const card = document.querySelector(`.explore-app-card[data-post-id="${post.id}"]`);
        if (!card) return;
        card.querySelectorAll('.explore-card-engagement span:first-child, .explore-card-overlay-actions span:first-child').forEach((el) => {
            el.innerHTML = `<i class="fas fa-heart"></i> ${post.likes_count || 0}`;
        });
        card.querySelectorAll('.explore-card-engagement span:nth-child(2), .explore-card-overlay-actions span:nth-child(2)').forEach((el) => {
            el.innerHTML = `<i class="far fa-comment"></i> ${post.comments_count || 0}`;
        });
    }

    async submitComment() {
        if (!requireAuth('/login/')) return;
        const input = document.getElementById('exploreCommentInput');
        const text = input.value.trim();
        if (!text) return;
        if (this.currentPost?.comments_enabled === false) {
            showToast('نظرات این پست غیرفعال است', 'info');
            return;
        }
        try {
            await apiClient.addComment(this.currentPost.id, text);
            input.value = '';
            this.currentPost.comments_count = (this.currentPost.comments_count || 0) + 1;
            const commentsCount = document.getElementById('exploreModalCommentsCount');
            if (commentsCount) commentsCount.textContent = this.currentPost.comments_count;
            this.syncOpenCardStats(this.currentPost);
            await this.loadModalComments(this.currentPost.id);
            showToast('نظر ثبت شد', 'success');
        } catch (e) {
            showToast(e.message, 'error');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('exploreMasonry') && !window.explorePage) {
        window.explorePage = new ExplorePage();
        window.explorePage.init();
    }
});
