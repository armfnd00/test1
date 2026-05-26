/**
 * BeautyNet — تم روشن / تاریک
 */
const ThemeManager = {
    STORAGE_KEY: 'bn-theme',

    init() {
        this.apply(this.getInitialTheme(), { persist: false });
        this.bindToggle();
        this.watchSystemTheme();
    },

    getInitialTheme() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored === 'dark' || stored === 'light') return stored;
        return 'light';
    },

    apply(theme, options = {}) {
        theme = theme === 'dark' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.style.colorScheme = theme;
        if (options.persist !== false) {
            localStorage.setItem(this.STORAGE_KEY, theme);
        }
        document.body?.classList.toggle('bn-theme-dark', theme === 'dark');
        document.body?.classList.toggle('bn-theme-light', theme !== 'dark');
        document.querySelector('meta[name="theme-color"]')?.setAttribute(
            'content',
            theme === 'dark' ? '#121212' : '#F8F7F4',
        );
        document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
            const icon = btn.querySelector('i');
            if (icon) {
                icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
            }
            btn.setAttribute('aria-label', theme === 'dark' ? 'حالت روشن' : 'حالت تاریک');
            btn.setAttribute('title', theme === 'dark' ? 'حالت روشن' : 'حالت تاریک');
            btn.dataset.themeState = theme;
        });
    },

    toggle() {
        const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        this.apply(current === 'dark' ? 'light' : 'dark');
    },

    bindToggle() {
        document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
            btn.addEventListener('click', () => this.toggle());
        });
    },

    watchSystemTheme() {
        // Product default stays light. Users can still switch manually.
    },
};

ThemeManager.apply(ThemeManager.getInitialTheme(), { persist: false });
document.addEventListener('DOMContentLoaded', () => ThemeManager.init());
