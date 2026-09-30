/* Note Cine — Sistema de Temas (Claro/Escuro) */

const ThemeManager = (() => {
    const STORAGE_KEY = 'notecine_theme_preference';
    const TRANSITION_DURATION = 300;

    /**
     * Temas disponíveis
     */
    const THEMES = {
        DARK: 'dark',
        LIGHT: 'light',
        SYSTEM: 'system'
    };

    /**
     * Retorna a preferência do sistema operacional
     */
    function getSystemTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return THEMES.DARK;
        }
        return THEMES.LIGHT;
    }

    /**
     * Obtém o tema atualmente salvo ou o padrão
     */
    function getSavedTheme() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved || THEMES.DARK;
        } catch {
            return THEMES.DARK;
        }
    }

    /**
     * Salva a preferência de tema
     */
    function saveTheme(theme) {
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch {
            console.warn('Não foi possível salvar preferência de tema');
        }
    }

    /**
     * Retorna o tema efetivo (resolvendo SYSTEM para DARK ou LIGHT)
     */
    function getEffectiveTheme(preferredTheme = null) {
        const theme = preferredTheme || getSavedTheme();
        
        if (theme === THEMES.SYSTEM) {
            return getSystemTheme();
        }
        
        return theme;
    }

    /**
     * Aplica o tema ao documento
     */
    function applyTheme(theme) {
        const effective = getEffectiveTheme(theme);
        const isDark = effective === THEMES.DARK;

        // Adiciona classe ao HTML
        document.documentElement.setAttribute('data-theme', effective);

        // Atualiza variáveis CSS
        if (isDark) {
            applyDarkTheme();
        } else {
            applyLightTheme();
        }

        // Atualiza meta theme-color para mobile
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', isDark ? '#0B0F17' : '#FFFFFF');
        }

        // Dispara evento personalizado
        window.dispatchEvent(new CustomEvent('themechange', { 
            detail: { theme: effective } 
        }));
    }

    /**
     * Aplica o tema escuro
     */
    function applyDarkTheme() {
        const root = document.documentElement;

        root.style.setProperty('--nc-bg', '#0B0F17');
        root.style.setProperty('--nc-surface', '#121826');
        root.style.setProperty('--nc-surface-2', '#1a2233');
        root.style.setProperty('--nc-white', '#F5F7FA');
        root.style.setProperty('--nc-grey', '#8C94A3');
        root.style.setProperty('--nc-border', 'rgba(140, 148, 163, 0.22)');
    }

    /**
     * Aplica o tema claro
     */
    function applyLightTheme() {
        const root = document.documentElement;

        // Cores sofisticadas para tema claro (design profissional tipo Figma/Discord Light)
        root.style.setProperty('--nc-bg', '#F9FAFB');           // Muito suave (quase branco)
        root.style.setProperty('--nc-surface', '#FFFFFF');      // Branco puro para cards
        root.style.setProperty('--nc-surface-2', '#F3F4F6');    // Cinza suave para hover
        root.style.setProperty('--nc-white', '#1F2937');        // Texto escuro (cinza escuro)
        root.style.setProperty('--nc-grey', '#6B7280');         // Texto secundário
        root.style.setProperty('--nc-border', 'rgba(209, 213, 219, 0.7)'); // Borders softas
        root.style.setProperty('--nc-blue', '#2563EB');         // Azul vibrante
        root.style.setProperty('--nc-blue-soft', 'rgba(37, 99, 235, 0.1)'); // Fundo azul suave
        root.style.setProperty('--nc-blue-hover', '#1D4ED8');   // Azul mais escuro em hover
    }

    /**
     * Alterna entre temas
     */
    function toggleTheme() {
        const current = getSavedTheme();
        const next = current === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
        
        setTheme(next);
        return next;
    }

    /**
     * Define um tema específico
     */
    function setTheme(theme) {
        if (!Object.values(THEMES).includes(theme)) {
            console.warn(`Tema inválido: ${theme}`);
            return;
        }

        saveTheme(theme);
        applyTheme(theme);
    }

    /**
     * Inicializa o sistema de temas
     */
    function init() {
        const saved = getSavedTheme();
        applyTheme(saved);

        // Monitora mudanças de preferência do sistema
        if (window.matchMedia) {
            const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
            darkModeQuery.addEventListener('change', (e) => {
                if (getSavedTheme() === THEMES.SYSTEM) {
                    applyTheme(THEMES.SYSTEM);
                }
            });
        }
    }

    /**
     * Obtém o tema atual
     */
    function getCurrentTheme() {
        return getSavedTheme();
    }

    return {
        THEMES,
        init,
        setTheme,
        toggleTheme,
        getCurrentTheme,
        getEffectiveTheme,
        getSavedTheme
    };
})();

// Inicializa o tema ao carregar o script
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        ThemeManager.init();
    });
} else {
    ThemeManager.init();
}
