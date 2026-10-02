/* Note Cine — Configurações globais */
const NOTE_CINE = {
    API_KEY: 'b2c9a760010bd140fa43bdc83e269f55',
    BASE_URL: 'https://api.themoviedb.org/3',
    IMG_W500: 'https://image.tmdb.org/t/p/w500',
    IMG_W342: 'https://image.tmdb.org/t/p/w342',
    IMG_W780: 'https://image.tmdb.org/t/p/w780',
    LANG: 'pt-BR',
    DEBOUNCE_MS: 280,
    CACHE_TTL: 5 * 60 * 1000,
    ITEMS_PER_PAGE: 20,
    SKELETON_COUNT: 8,
    STORAGE_USER: 'cineaura_user'
};

const CINEAURA = NOTE_CINE;

function getSessionUser() {
    try {
        return JSON.parse(localStorage.getItem(NOTE_CINE.STORAGE_USER));
    } catch {
        return null;
    }
}

function requireAuth() {
    const user = getSessionUser();
    if (!user) {
        window.location.href = 'login.html';
        return null;
    }
    // Sincroniza em segundo plano com o banco de dados
    syncSession();
    return user;
}

async function syncSession() {
    try {
        const res = await fetch('api.php?action=get_current_user');
        const data = await res.json();
        if (data.success && data.user) {
            const oldUser = getSessionUser();
            localStorage.setItem(NOTE_CINE.STORAGE_USER, JSON.stringify(data.user));
            // Se houve mudança de role (plano) do usuário ativo, atualiza a tela
            if (oldUser && oldUser.role !== data.user.role) {
                const badge = document.getElementById('user-role');
                if (badge) {
                    badge.innerText = NoteCinePlans.roleBadgeText(data.user.role);
                }
                // Dispara evento global se necessário
                window.dispatchEvent(new CustomEvent('userRoleChanged', { detail: data.user.role }));
            }
        } else {
            // Se a sessão expirou no servidor, limpa local
            localStorage.removeItem(NOTE_CINE.STORAGE_USER);
            window.location.href = 'login.html';
        }
    } catch (e) {
        console.warn("Erro ao sincronizar sessão:", e);
    }
}

function logoutUser() {
    localStorage.removeItem(NOTE_CINE.STORAGE_USER);
    window.location.href = 'login.html';
}

function goBack() {
    if (window.history.length > 1) {
        window.history.back();
    } else {
        window.location.href = 'index.html';
    }
}

function openMovieDetails(id, mediaType = 'movie') {
    const type = mediaType === 'tv' ? 'tv' : 'movie';
    window.location.href = `filme.html?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}`;
}
