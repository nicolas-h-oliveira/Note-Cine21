/* CINEAURA — API TMDB com cache inteligente */
const ApiCache = (() => {
    const store = new Map();

    function get(key) {
        const entry = store.get(key);
        if (!entry) return null;
        if (Date.now() - entry.time > CINEAURA.CACHE_TTL) {
            store.delete(key);
            return null;
        }
        return entry.data;
    }

    function set(key, data) {
        store.set(key, { data, time: Date.now() });
    }

    return { get, set };
})();

async function tmdbFetch(url) {
    const cached = ApiCache.get(url);
    if (cached) return cached;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`TMDB ${res.status}`);
    const data = await res.json();
    ApiCache.set(url, data);
    return data;
}

function buildUrl(path, params = {}) {
    const qs = new URLSearchParams({
        api_key: CINEAURA.API_KEY,
        language: CINEAURA.LANG,
        ...params
    });
    return `${CINEAURA.BASE_URL}${path}?${qs}`;
}

function posterUrl(path, size = 'w500') {
    if (!path) return 'https://via.placeholder.com/300x450/1a1a26/666?text=Sem+Capa';
    const base = size === 'w342' ? CINEAURA.IMG_W342 : size === 'w780' ? CINEAURA.IMG_W780 : CINEAURA.IMG_W500;
    return base + path;
}

function getQualityBadge(voteAverage) {
    if (voteAverage >= 8) return { label: '4K', cls: 'quality-4k' };
    if (voteAverage >= 6.5) return { label: 'Full HD', cls: '' };
    return { label: 'HD', cls: '' };
}

function formatRuntime(minutes) {
    if (!minutes) return null;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function extractYear(dateStr) {
    if (!dateStr) return null;
    return dateStr.split('-')[0];
}

function debounce(fn, ms) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}
