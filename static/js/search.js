class SearchPage {
    constructor() {
        this._debounce = null;
        this.lastController = null;
    }

    init() {
        const input = document.getElementById('searchInput');
        input?.addEventListener('input', (e) => {
            clearTimeout(this._debounce);
            this._debounce = setTimeout(() => this.search(e.target.value.trim()), 260);
        });
        document.getElementById('smartSearchChips')?.addEventListener('click', (e) => {
            const chip = e.target.closest('[data-mode]');
            if (!chip || !input) return;
            document.querySelectorAll('#smartSearchChips [data-mode]').forEach((btn) => btn.classList.remove('active'));
            chip.classList.add('active');
            input.placeholder = chip.dataset.placeholder || input.placeholder;
            input.focus();
        });
        input?.focus();
        this.showHint();
    }

    escape(value = '') {
        return String(value).replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
        }[ch]));
    }

    showHint() {
        const box = document.getElementById('searchResults');
        const summary = document.getElementById('searchSummary');
        if (summary) {
            summary.hidden = true;
            summary.innerHTML = '';
        }
        if (box) {
            box.innerHTML = '';
        }
    }

    renderSummary(data) {
        const summary = document.getElementById('searchSummary');
        if (!summary) return;
        const parsed = data.parsed || {};
        const chips = [];
        if (parsed.specialty_label) chips.push(`<span><i class="fas fa-stethoscope"></i> ${this.escape(parsed.specialty_label)}</span>`);
        if (parsed.city) chips.push(`<span><i class="fas fa-location-dot"></i> ${this.escape(parsed.city)}</span>`);
        if (parsed.text) chips.push(`<span><i class="fas fa-font"></i> ${this.escape(parsed.text)}</span>`);
        chips.push(`<strong>${data.total || 0} نتیجه</strong>`);
        summary.innerHTML = chips.join('');
        summary.hidden = false;
    }

    async search(q) {
        const box = document.getElementById('searchResults');
        if (!q) {
            this.showHint();
            return;
        }
        box.innerHTML = '<div class="smart-search-loading"><div class="spinner"></div><p>در حال تحلیل تخصص، شهر و نام...</p></div>';
        try {
            const data = await apiClient.smartSearch(q, { limit: 10 });
            this.renderSummary(data);

            const docList = data.doctors || [];
            const clinicList = data.clinics || [];
            const postList = data.posts || [];
            const sections = [];

            if (docList.length) {
                let html = '<section class="smart-result-section"><div class="smart-result-head"><h2>پزشکان پیشنهادی</h2><span>بر اساس شهر، تخصص و نام</span></div>';
                html += '<div class="smart-entity-list">';
                docList.forEach((d) => {
                    const u = d.user || d;
                    html += `<a href="/doctor/${this.escape(u.username)}/" class="bn-entity-card doctor-card smart-entity-card">
                        <img src="${avatarUrl(u)}" class="doctor-card-avatar" alt="" loading="lazy">
                        <div class="doctor-card-body">
                            <h3>${this.escape(u.full_name || u.username)}</h3>
                            <p class="doctor-card-meta">${this.escape(d.specialty_display || '')}${d.city ? ` · ${this.escape(d.city)}` : ''}</p>
                            <div class="smart-card-tags">
                                ${d.is_verified ? '<span><i class="fas fa-check-circle"></i> تایید شده</span>' : ''}
                                ${d.clinic_name ? `<span><i class="fas fa-hospital"></i> ${this.escape(d.clinic_name)}</span>` : ''}
                            </div>
                        </div>
                    </a>`;
                });
                html += '</div>';
                html += '</section>';
                sections.push(html);
            }

            if (clinicList.length) {
                let html = '<section class="smart-result-section"><div class="smart-result-head"><h2>کلینیک‌ها</h2><span>مراکز مرتبط با جستجو</span></div>';
                html += '<div class="smart-entity-list">';
                clinicList.forEach((c) => {
                    const u = c.user || {};
                    html += `<a href="/clinic/${this.escape(u.username)}/" class="bn-entity-card doctor-card smart-entity-card">
                        <img src="${avatarUrl(u)}" class="doctor-card-avatar" alt="" loading="lazy">
                        <div class="doctor-card-body">
                            <h3>${this.escape(c.official_name || u.full_name || u.username)}</h3>
                            <p class="doctor-card-meta">${this.escape(c.city || '')} · ${c.doctors_count || 0} پزشک همکار</p>
                            <div class="smart-card-tags">
                                ${c.is_verified ? '<span><i class="fas fa-check-circle"></i> تایید شده</span>' : ''}
                                ${c.services ? `<span><i class="fas fa-sparkles"></i> ${this.escape(String(c.services).slice(0, 48))}</span>` : ''}
                            </div>
                        </div>
                    </a>`;
                });
                html += '</div>';
                html += '</section>';
                sections.push(html);
            }

            if (postList.length) {
                let html = '<section class="smart-result-section"><div class="smart-result-head"><h2>نمونه‌کارها و پست‌ها</h2><span>نتایج واقعی مرتبط</span></div>';
                html += '<div class="explore-app-grid smart-post-grid">';
                postList.forEach((p) => {
                    const thumb = p.media_items?.[0]?.url || p.media_url || '';
                    const title = p.caption || p.doctor_specialty || 'نتیجه درمان';
                    html += `<article class="explore-app-card explore-card" data-post-id="${p.id}">
                        <div class="explore-card-media">${thumb ? `<img src="${thumb}" alt="" loading="lazy" decoding="async">` : ''}</div>
                        <div class="explore-card-body-lux">
                            <h3 class="explore-card-title">${this.escape(title)}</h3>
                            <p class="explore-card-subtitle">${this.escape([p.doctor_specialty, p.doctor_city].filter(Boolean).join(' · ') || p.author?.full_name || p.author?.username || '')}</p>
                        </div>
                    </article>`;
                });
                html += '</div>';
                html += '</section>';
                sections.push(html);
            }

            if (!sections.length) {
                sections.push(`<div class="lux-empty"><i class="fas fa-face-frown"></i><h3>نتیجه‌ای یافت نشد</h3><p>نام شهر یا تخصص را ساده‌تر وارد کنید؛ مثلا «یزد پوست».</p></div>`);
            }
            box.innerHTML = sections.join('');
            box.querySelectorAll('.explore-app-card[data-post-id]').forEach((card) => {
                card.style.cursor = 'pointer';
                card.addEventListener('click', () => {
                    window.location.href = `/doctor/${postList.find((x) => String(x.id) === card.dataset.postId)?.author?.username || ''}/`;
                });
            });
        } catch (e) {
            box.innerHTML = `<div class="lux-empty"><p>${e.message}</p></div>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('searchInput')) new SearchPage().init();
});
