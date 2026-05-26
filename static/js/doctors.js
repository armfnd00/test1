class DoctorsPage {
    constructor() {
        this.type = new URLSearchParams(window.location.search).get('type') || 'all';
    }

    async init() {
        this.syncTypeTabs();
        await this.loadDoctors();
        document.querySelectorAll('#doctorsFilters .filter-chip').forEach((chip) => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('#doctorsFilters .filter-chip').forEach((c) => c.classList.remove('active'));
                chip.classList.add('active');
                this.type = chip.dataset.type || 'all';
                history.replaceState(null, '', this.type === 'all' ? '/doctors/' : `/doctors/?type=${this.type}`);
                this.loadDoctors();
            });
        });
    }

    syncTypeTabs() {
        if (!['all', 'doctors', 'clinics'].includes(this.type)) this.type = 'all';
        document.querySelectorAll('#doctorsFilters .filter-chip').forEach((chip) => {
            chip.classList.toggle('active', (chip.dataset.type || 'all') === this.type);
        });
    }

    async loadDoctors() {
        const list = document.getElementById('providersList') || document.getElementById('doctorsList');
        const loader = document.getElementById('doctorsLoader');
        list.innerHTML = '';
        if (loader) loader.style.display = 'none';
        try {
            const [data, clinicData] = await Promise.all([
                this.type === 'clinics' ? Promise.resolve({ results: [] }) : apiClient.listDoctors({ page_size: 50 }),
                this.type === 'doctors' ? Promise.resolve({ results: [] }) : apiClient.listClinics({ page_size: 50 }).catch(() => ({ results: [] })),
            ]);
            const doctors = data.results || data;
            const clinics = clinicData.results || clinicData;
            if (!doctors.length && !clinics.length) {
                list.innerHTML = '<p style="text-align:center;padding:40px;color:var(--bn-text-3)">موردی یافت نشد</p>';
                return;
            }
            doctors.forEach((d) => {
                const card = document.createElement('div');
                card.className = 'bn-entity-card doctor-card';
                card.innerHTML = `
                    <img src="${avatarUrl(d.user || d)}" alt="" class="doctor-card-avatar">
                    <div class="doctor-card-body">
                        <h3>${d.user?.full_name || d.full_name || d.username} ${(d.is_verified || d.user?.is_verified) ? '<i class="fas fa-check-circle verified-tick"></i>' : ''}</h3>
                        <p class="doctor-card-meta">${d.specialty_display || ''} · ${d.city || ''}</p>
                        <p class="doctor-card-meta">${d.clinic_name || ''}</p>
                        <span class="doctor-card-rating"><i class="fas fa-star"></i> ${d.average_rating ?? '—'}</span>
                    </div>
                    <div class="doctor-card-actions">
                        <a href="/doctor/${d.user?.username || d.username}/" class="btn btn-primary btn-sm">مشاهده پروفایل</a>
                    </div>`;
                list.appendChild(card);
            });
            clinics.forEach((c) => {
                const u = c.user || c;
                const card = document.createElement('div');
                card.className = 'bn-entity-card doctor-card';
                card.innerHTML = `
                    <img src="${avatarUrl(u)}" alt="" class="doctor-card-avatar">
                    <div class="doctor-card-body">
                        <h3>${c.official_name || u.full_name || u.username}</h3>
                        <p class="doctor-card-meta">کلینیک · ${c.city || ''}</p>
                        <p class="doctor-card-meta">${c.doctors_count ?? 0} پزشک همکار</p>
                    </div>
                    <div class="doctor-card-actions">
                        <a href="/clinic/${u.username}/" class="btn btn-outline btn-sm">پروفایل</a>
                    </div>`;
                list.appendChild(card);
            });
        } catch (e) {
            if (loader) loader.style.display = 'none';
            list.innerHTML = `<p class="text-muted">${e.message}</p>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('providersList') || document.getElementById('doctorsList')) new DoctorsPage().init();
});
