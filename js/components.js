/* Note Cine — Componentes de UI reutilizáveis */

function createSkeletonCards(count = NOTE_CINE.SKELETON_COUNT) {
    return Array.from({ length: count }, () => `
        <div class="skeleton-card">
            <div class="sk-poster skeleton"></div>
            <div class="sk-body">
                <div class="sk-line skeleton"></div>
                <div class="sk-line skeleton short"></div>
                <div class="sk-btn skeleton"></div>
            </div>
        </div>
    `).join('');
}


/* ==========================================================================
   TRATAMENTO DE CAPAS
   ========================================================================== */

function normalizePosterUrl(item) {
    if (!item) {
        return '';
    }

    /*
     * 1. Se já temos uma URL completa, usamos diretamente.
     */
    const directPoster =
        item.poster ||
        item.poster_url ||
        item.posterUrl ||
        '';

    if (directPoster) {
        const value = String(directPoster).trim();

        if (value.startsWith('http://') || value.startsWith('https://')) {
            return value;
        }

        /*
         * Caso o banco tenha salvo somente:
         * /abc123.jpg
         */
        if (value.startsWith('/')) {
            return `https://image.tmdb.org/t/p/w500${value}`;
        }

        /*
         * Caso tenha salvo:
         * abc123.jpg
         */
        if (value.includes('.jpg') || value.includes('.jpeg') || value.includes('.png')) {
            return `https://image.tmdb.org/t/p/w500/${value}`;
        }
    }

    /*
     * 2. Tenta usar poster_path vindo diretamente do TMDB.
     */
    if (item.poster_path) {
        const path = String(item.poster_path).trim();

        if (path.startsWith('http://') || path.startsWith('https://')) {
            return path;
        }

        if (path.startsWith('/')) {
            return `https://image.tmdb.org/t/p/w500${path}`;
        }

        return `https://image.tmdb.org/t/p/w500/${path}`;
    }

    return '';
}


/* ==========================================================================
   CARD DE FILME
   ========================================================================== */

function createMovieCard(item, index = 0) {
    const title = item.title || item.name || 'Sem título';

    /*
     * Agora a capa passa por um tratamento único.
     */
    const poster = normalizePosterUrl(item);

    const rating = item.vote_average
        ? Number(item.vote_average).toFixed(1)
        : (item.rating || 'N/A');

    const year =
        item.year ||
        extractYear(item.release_date || item.first_air_date);

    const runtime = formatRuntime(item.runtime);

    const mediaType = item.media_type || 'movie';

    const quality = getQualityBadge(parseFloat(rating) || 0);

    const genres = (item.genre_ids && item.genre_ids.length)
        ? item.genre_ids
            .slice(0, 2)
            .map(id => `
                <span class="meta-badge genre">
                    ${genreName(id)}
                </span>
            `)
            .join('')
        : (item.genres || [])
            .slice(0, 2)
            .map(g => `
                <span class="meta-badge genre">
                    ${typeof g === 'string' ? g : g.name}
                </span>
            `)
            .join('');

    const card = document.createElement('div');

    card.className = 'movie-card';

    card.style.animationDelay =
        `${Math.min(index * 0.04, 0.4)}s`;

    card.dataset.id = item.id;
    card.dataset.type = mediaType;

    /*
     * Se não houver capa, usamos uma imagem neutra.
     * Isso evita aquele ícone de imagem quebrada.
     */
    const fallbackPoster =
        'data:image/svg+xml;charset=UTF-8,' +
        encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg"
                 width="500"
                 height="750"
                 viewBox="0 0 500 750">
                <rect width="500"
                      height="750"
                      fill="#161b29"/>
                <text x="250"
                      y="350"
                      text-anchor="middle"
                      fill="#8b93a7"
                      font-size="28"
                      font-family="Arial">
                    Sem capa
                </text>
                <text x="250"
                      y="390"
                      text-anchor="middle"
                      fill="#5f6677"
                      font-size="18"
                      font-family="Arial">
                    Note Cine
                </text>
            </svg>
        `);

    card.innerHTML = `
        <div class="movie-card__poster-wrap" data-action="open">

            <img
                class="movie-card__poster"
                src="${fallbackPoster}"
                ${poster ? `data-src="${escapeHtmlAttribute(poster)}"` : ''}
                alt="${escapeHtmlAttribute(title)}"
                loading="lazy"
                decoding="async"
            >

            <div class="movie-card__overlay"></div>

            <span class="movie-card__quality ${quality.cls}">
                ${quality.label}
            </span>

            <span class="movie-card__rating">
                <i class="fa-solid fa-star"></i>
                ${rating}
            </span>

            <button
                class="movie-card__heart"
                data-action="favorite"
                aria-label="Favoritar">
                🤍
            </button>
        </div>

        <div class="movie-card__body">

            <h3
                class="movie-card__title"
                title="${escapeHtmlAttribute(title)}">
                ${escapeHtml(title)}
            </h3>

            <div class="movie-card__meta">
                ${year ? `
                    <span class="meta-badge">
                        ${year}
                    </span>
                ` : ''}

                ${runtime ? `
                    <span class="meta-badge">
                        ${runtime}
                    </span>
                ` : ''}

                ${genres}
            </div>

            <div class="movie-card__actions">
                <button
                    class="btn-mylist"
                    data-action="mylist">

                    <i class="fa-solid fa-plus"></i>
                    Minha Lista
                </button>
            </div>
        </div>
    `;


    /* ==========================================================================
       FALLBACK PARA CAPA QUE NÃO CARREGAR
       ========================================================================== */

    const posterEl =
        card.querySelector('.movie-card__poster');

    if (posterEl) {
        posterEl.addEventListener('error', async () => {

            /*
             * Evita loop infinito caso o fallback também falhe.
             */
            if (posterEl.dataset.fallbackApplied === 'true') {
                return;
            }

            posterEl.dataset.fallbackApplied = 'true';

            /*
             * Se a capa salva estiver errada, tenta buscar novamente
             * os detalhes diretamente no TMDB.
             */
            try {
                if (item.id && typeof tmdbFetch === 'function') {

                    const url = buildUrl(
                        `/${mediaType}/${item.id}`
                    );

                    const data = await tmdbFetch(url);

                    if (data && data.poster_path) {

                        const newPoster =
                            `https://image.tmdb.org/t/p/w500${data.poster_path}`;

                        posterEl.src = newPoster;

                        /*
                         * Também atualiza o objeto em memória.
                         */
                        item.poster = newPoster;
                        item.poster_path = data.poster_path;

                        return;
                    }
                }
            } catch (error) {
                console.warn(
                    'Não foi possível recuperar a capa:',
                    error
                );
            }

            posterEl.src = fallbackPoster;
        });
    }


    /* ==========================================================================
       STATUS DE FAVORITO
       ========================================================================== */

    if (
        typeof Storage !== 'undefined' &&
        Storage.isFavorite
    ) {
        Storage.isFavorite(item.id, mediaType)
            .then(isFav => {

                if (isFav) {

                    const btnFav =
                        card.querySelector(
                            '[data-action="favorite"]'
                        );

                    if (btnFav) {
                        btnFav.classList.add('is-favorite');
                        btnFav.textContent = '❤️';
                    }
                }

            })
            .catch(error => {
                console.warn(
                    'Erro ao verificar favorito:',
                    error
                );
            });
    }


    /* ==========================================================================
       STATUS DE MINHA LISTA
       ========================================================================== */

    if (
        typeof Storage !== 'undefined' &&
        Storage.isInProfile
    ) {
        Storage.isInProfile(item.id, mediaType)
            .then(inList => {
                if (inList) {
                    const btnList = card.querySelector('[data-action="mylist"]');
                    if (btnList) {
                        btnList.classList.add('is-added');
                        // Alterado de "Adicionado" para "Remover"
                        btnList.innerHTML = `
                            <i class="fa-solid fa-trash"></i>
                            Remover
                        `;
                    }
                }
            })
            .catch(error => {
                console.warn('Erro ao verificar Minha Lista:', error);
            });
    }


    /*
     * Carregamento lazy da imagem.
     */
    if (posterEl && poster) {
        lazyLoadImage(posterEl);
    }


    bindCardEvents(card, item);

    return card;
}


/* ==========================================================================
   SEGURANÇA — ESCAPE DE TEXTO
   ========================================================================== */

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return '';
    }

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


function escapeHtmlAttribute(value) {
    return escapeHtml(value);
}


/* ==========================================================================
   GÊNEROS
   ========================================================================== */

const GENRE_MAP = {
    28: 'Ação',
    12: 'Aventura',
    16: 'Animação',
    35: 'Comédia',
    80: 'Crime',
    99: 'Doc',
    18: 'Drama',
    10751: 'Família',
    14: 'Fantasia',
    36: 'História',
    27: 'Terror',
    10402: 'Música',
    9648: 'Mistério',
    10749: 'Romance',
    878: 'Ficção',
    10770: 'TV',
    53: 'Suspense',
    10752: 'Guerra',
    37: 'Western',

    /* Séries */
    10759: 'Ação',
    10765: 'Ficção',
    10768: 'Guerra'
};


function genreName(id) {
    return GENRE_MAP[id] || 'Gênero';
}


/* ==========================================================================
   LAZY LOAD
   ========================================================================== */

function lazyLoadImage(img) {

    if (!img || !img.dataset.src) {
        return;
    }

    /*
     * Caso o navegador não suporte IntersectionObserver,
     * carrega imediatamente.
     */
    if (!('IntersectionObserver' in window)) {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        img.classList.add('loaded');
        return;
    }

    const observer =
        new IntersectionObserver(
            entries => {

                entries.forEach(entry => {

                    if (entry.isIntersecting) {

                        const el =
                            entry.target;

                        const src =
                            el.dataset.src;

                        if (src) {
                            el.src = src;
                        }

                        el.removeAttribute(
                            'data-src'
                        );

                        el.onload = () => {
                            el.classList.add('loaded');
                        };

                        observer.unobserve(el);
                    }
                });

            },
            {
                rootMargin: '150px'
            }
        );

    observer.observe(img);
}


/* ==========================================================================
   EVENTOS DOS CARDS
   ========================================================================== */

function bindCardEvents(card, item) {

    const mediaType =
        item.media_type || 'movie';


    /* Abrir detalhes */

    card
        .querySelector('[data-action="open"]')
        ?.addEventListener('click', e => {

            if (
                e.target.closest(
                    '[data-action="favorite"]'
                )
            ) {
                return;
            }

            openMovieDetails(
                item.id,
                mediaType
            );
        });


    /* Favorito */

    card
        .querySelector('[data-action="favorite"]')
        ?.addEventListener(
            'click',
            async e => {

                e.stopPropagation();

                rippleEffect(
                    e.currentTarget,
                    e
                );

                const result =
                    await Storage.toggleFavorite(
                        item
                    );

                if (!result.ok) {

                    showToast(
                        result.msg,
                        'error'
                    );

                    return;
                }

                const btn =
                    e.currentTarget;

                btn.classList.toggle(
                    'is-favorite',
                    result.added
                );

                btn.textContent =
                    result.added
                        ? '❤️'
                        : '🤍';

                showToast(
                    result.msg
                );
            }
        );


    /* Minha Lista */

    card
        .querySelector('[data-action="mylist"]')
        ?.addEventListener(
            'click',
            async e => {

                e.stopPropagation();

                rippleEffect(
                    e.currentTarget,
                    e
                );

                const result =
                    await Storage.toggleProfileMovie(
                        item
                    );

                if (!result.ok) {

                    showToast(
                        result.msg,
                        'error'
                    );

                    return;
                }

                const btn =
                    e.currentTarget;

                btn.classList.toggle(
                    'is-added',
                    result.added
                );

                btn.innerHTML =
                    result.added
                        ? `
                            <i class="fa-solid fa-trash"></i>
                            Remover
                        `
                        : `
                            <i class="fa-solid fa-plus"></i>
                            Minha Lista
                        `;

                showToast(
                    result.msg
                );
            }
        );
}


/* ==========================================================================
   RIPPLE
   ========================================================================== */

function rippleEffect(el, e) {

    if (!el) {
        return;
    }

    const rect =
        el.getBoundingClientRect();

    const ripple =
        document.createElement('span');

    ripple.style.cssText = `
        position:absolute;
        border-radius:50%;
        background:rgba(255,255,255,0.35);
        width:40px;
        height:40px;
        left:${e.clientX - rect.left - 20}px;
        top:${e.clientY - rect.top - 20}px;
        transform:scale(0);
        animation:rippleAnim 0.5s ease;
        pointer-events:none;
        z-index:99;
    `;

    el.style.position = 'relative';
    el.style.overflow = 'hidden';

    el.appendChild(ripple);

    setTimeout(
        () => ripple.remove(),
        500
    );
}


if (!document.getElementById('ripple-style')) {

    const s =
        document.createElement('style');

    s.id = 'ripple-style';

    s.textContent = `
        @keyframes rippleAnim {
            to {
                transform:scale(4);
                opacity:0;
            }
        }
    `;

    document.head.appendChild(s);
}


/* ==========================================================================
   TOAST
   ========================================================================== */

function showToast(
    msg,
    type = 'success'
) {

    const toast =
        document.getElementById(
            'toast-notification'
        );

    if (!toast) {
        return;
    }

    const icon =
        type === 'error'
            ? 'fa-circle-exclamation'
            : 'fa-circle-check';

    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span id="toast-msg">
            ${escapeHtml(msg || '')}
        </span>
    `;

    toast.style.display = 'flex';

    toast.classList.remove(
        'toast-out'
    );

    clearTimeout(
        toast._timer
    );

    toast._timer =
        setTimeout(() => {

            toast.classList.add(
                'toast-out'
            );

            setTimeout(() => {

                toast.style.display =
                    'none';

            }, 300);

        }, 3200);
}


/* ==========================================================================
   PESQUISA DE USUÁRIOS DINÂMICA
   ========================================================================== */

document.addEventListener(
    'DOMContentLoaded',
    () => {

        if (
            !document.getElementById(
                'modal-user-search'
            )
        ) {

            const modalDiv =
                document.createElement('div');

            modalDiv.className =
                'modal-overlay';

            modalDiv.id =
                'modal-user-search';

            modalDiv.innerHTML = `
                <div
                    class="modal-content user-search-modal-content"
                    style="
                        max-width:600px;
                        width:90%;
                        position:relative;
                    "
                >

                    <button
                        type="button"
                        class="btn-close-modal"
                        id="btn-close-user-search"
                        onclick="closeUserSearch()"
                    >
                        <i class="fa-solid fa-xmark"></i>
                    </button>

                    <h3
                        style="
                            color:var(--nc-white);
                            margin-bottom:12px;
                            display:flex;
                            align-items:center;
                            gap:8px;
                        "
                    >
                        <i
                            class="fa-solid fa-users"
                            style="color:var(--nc-blue);"
                        ></i>

                        Pesquisar Usuários
                    </h3>

                    <div
                        class="search-box user-search-input-box"
                        style="
                            margin-bottom:20px;
                            position:relative;
                            width:100%;
                        "
                    >

                        <i
                            class="fa-solid fa-magnifying-glass"
                            style="
                                position:absolute;
                                left:14px;
                                top:50%;
                                transform:translateY(-50%);
                                color:var(--nc-grey);
                                pointer-events:none;
                            "
                        ></i>

                        <input
                            type="search"
                            id="user-search-input"
                            placeholder="Buscar por nome ou username..."
                            autocomplete="off"
                            style="
                                width:100% !important;
                                padding:10px 14px 10px 40px;
                                background:var(--nc-surface-2);
                                border:1px solid var(--nc-border);
                                border-radius:999px;
                                height:42px;
                                color:var(--nc-white);
                                font-size:14px;
                                outline:none;
                                transition:var(--nc-transition);
                            "
                        >
                    </div>

                    <div
                        class="user-search-results-list"
                        id="user-search-results"
                        style="
                            display:flex;
                            flex-direction:column;
                            gap:12px;
                            max-height:400px;
                            overflow-y:auto;
                            padding-right:6px;
                        "
                    >
                        <p
                            style="
                                color:var(--nc-grey);
                                text-align:center;
                                padding:20px;
                            "
                        >
                            Digite algo para começar a pesquisar...
                        </p>
                    </div>

                </div>
            `;

            document.body.appendChild(
                modalDiv
            );

            modalDiv.addEventListener(
                'click',
                e => {

                    if (
                        e.target === modalDiv
                    ) {
                        closeUserSearch();
                    }
                }
            );
        }


        const navUl =
            document.querySelector(
                '.site-nav ul'
            );

        if (
            navUl &&
            !document.getElementById(
                'nav-search-users-li'
            )
        ) {

            const li =
                document.createElement('li');

            li.id =
                'nav-search-users-li';

            li.innerHTML = `
                <a
                    href="#"
                    id="nav-search-users-link-item"
                >
                    <i class="fa-solid fa-users"></i>
                    Pesquisar Usuários
                </a>
            `;

            navUl.appendChild(li);

            document
                .getElementById(
                    'nav-search-users-link-item'
                )
                .addEventListener(
                    'click',
                    e => {

                        e.preventDefault();

                        openUserSearch();
                    }
                );
        }


        const input =
            document.getElementById(
                'user-search-input'
            );

        if (input) {

            input.addEventListener(
                'input',
                debounce(
                    async e => {

                        const query =
                            e.target.value.trim();

                        const resultsContainer =
                            document.getElementById(
                                'user-search-results'
                            );

                        if (!resultsContainer) {
                            return;
                        }

                        if (query.length < 1) {

                            resultsContainer.innerHTML = `
                                <p
                                    style="
                                        color:var(--nc-grey);
                                        text-align:center;
                                        padding:20px;
                                    "
                                >
                                    Digite algo para começar a pesquisar...
                                </p>
                            `;

                            return;
                        }

                        resultsContainer.innerHTML = `
                            <div
                                style="
                                    color:var(--nc-grey);
                                    text-align:center;
                                    padding:20px;
                                "
                            >
                                <i class="fa-solid fa-spinner fa-spin"></i>
                                Buscando...
                            </div>
                        `;

                        try {

                            const res =
                                await fetch(
                                    `api.php?action=search_users&query=${encodeURIComponent(query)}`
                                );

                            const data =
                                await res.json();

                            if (
                                data.success &&
                                data.users
                            ) {

                                if (
                                    data.users.length === 0
                                ) {

                                    resultsContainer.innerHTML = `
                                        <p
                                            style="
                                                color:var(--nc-grey);
                                                text-align:center;
                                                padding:20px;
                                            "
                                        >
                                            Nenhum usuário encontrado.
                                        </p>
                                    `;

                                    return;
                                }

                                resultsContainer.innerHTML =
                                    data.users
                                        .map(u => {

                                            const avatarHtml =
                                                u.avatar_url
                                                    ? `
                                                        <div
                                                            class="user-search-avatar"
                                                            style="
                                                                width:50px;
                                                                height:50px;
                                                                border-radius:50%;
                                                                background-image:url('${escapeHtmlAttribute(u.avatar_url)}');
                                                                background-size:cover;
                                                                background-position:center;
                                                                border:2px solid var(--accent,var(--nc-blue));
                                                            "
                                                        ></div>
                                                    `
                                                    : `
                                                        <div
                                                            class="user-search-avatar-text"
                                                            style="
                                                                width:50px;
                                                                height:50px;
                                                                border-radius:50%;
                                                                background:var(--nc-surface-2);
                                                                color:var(--nc-white);
                                                                display:flex;
                                                                align-items:center;
                                                                justify-content:center;
                                                                font-weight:800;
                                                                font-size:18px;
                                                                border:2px solid var(--accent,var(--nc-blue));
                                                            "
                                                        >
                                                            ${escapeHtml(
                                                                (u.username || '?')
                                                                    .charAt(0)
                                                                    .toUpperCase()
                                                            )}
                                                        </div>
                                                    `;

                                            const bannerStyle =
                                                u.banner_url
                                                    ? `
                                                        background-image:url('${escapeHtmlAttribute(u.banner_url)}');
                                                        background-size:cover;
                                                        background-position:center;
                                                    `
                                                    : `
                                                        background:linear-gradient(
                                                            135deg,
                                                            var(--nc-surface-2),
                                                            var(--nc-surface)
                                                        );
                                                    `;

                                            const planLabel =
                                                typeof NoteCinePlans !== 'undefined'
                                                    ? NoteCinePlans
                                                        .roleBadgeText(u.role)
                                                        .split(' · ')[0]
                                                    : '';

                                            return `
                                                <div
                                                    class="user-search-result-card"
                                                    onclick="goToUserProfile('${escapeHtmlAttribute(u.username)}')"
                                                    style="
                                                        position:relative;
                                                        overflow:hidden;
                                                        border-radius:12px;
                                                        border:1px solid var(--nc-border);
                                                        cursor:pointer;
                                                        background:var(--nc-surface);
                                                        transition:var(--nc-transition);
                                                    "
                                                >

                                                    <div
                                                        class="user-search-banner-pre"
                                                        style="
                                                            height:55px;
                                                            ${bannerStyle}
                                                        "
                                                    ></div>

                                                    <div
                                                        class="user-search-card-body"
                                                        style="
                                                            padding:12px;
                                                            display:flex;
                                                            align-items:center;
                                                            gap:12px;
                                                            position:relative;
                                                            margin-top:-25px;
                                                            z-index:2;
                                                        "
                                                    >

                                                        ${avatarHtml}

                                                        <div
                                                            class="user-search-card-info"
                                                            style="flex:1;"
                                                        >

                                                            <h5
                                                                style="
                                                                    color:var(--nc-white);
                                                                    font-size:15px;
                                                                    font-weight:700;
                                                                    margin:0;
                                                                "
                                                            >
                                                                ${escapeHtml(u.username)}
                                                            </h5>

                                                            <span
                                                                class="user-search-role-badge"
                                                                style="
                                                                    font-size:10px;
                                                                    padding:2px 6px;
                                                                    border-radius:4px;
                                                                    background:rgba(255,255,255,0.08);
                                                                    color:var(--nc-grey);
                                                                "
                                                            >
                                                                ${escapeHtml(planLabel)}
                                                            </span>

                                                        </div>

                                                        <div
                                                            class="user-search-stats"
                                                            style="
                                                                display:flex;
                                                                gap:10px;
                                                                text-align:right;
                                                                font-size:11px;
                                                                color:var(--nc-grey);
                                                            "
                                                        >

                                                            <div>
                                                                <strong>
                                                                    ${u.movie_count || 0}
                                                                </strong>

                                                                <span
                                                                    style="
                                                                        display:block;
                                                                        font-size:9px;
                                                                    "
                                                                >
                                                                    filmes
                                                                </span>
                                                            </div>

                                                            <div>
                                                                <strong>
                                                                    ${u.review_count || 0}
                                                                </strong>

                                                                <span
                                                                    style="
                                                                        display:block;
                                                                        font-size:9px;
                                                                    "
                                                                >
                                                                    críticas
                                                                </span>
                                                            </div>

                                                        </div>

                                                    </div>
                                                </div>
                                            `;
                                        })
                                        .join('');
                            }

                        } catch (e) {

                            resultsContainer.innerHTML = `
                                <p
                                    style="
                                        color:var(--nc-danger);
                                        text-align:center;
                                        padding:20px;
                                    "
                                >
                                    Erro ao pesquisar.
                                </p>
                            `;
                        }

                    },
                    300
                )
            );
        }
    }
);


/* ==========================================================================
   PESQUISA DE USUÁRIOS
   ========================================================================== */

function openUserSearch() {

    const modal =
        document.getElementById(
            'modal-user-search'
        );

    if (modal) {

        modal.style.display = 'flex';

        const input =
            document.getElementById(
                'user-search-input'
            );

        if (input) {

            input.value = '';

            input.focus();
        }

        const results =
            document.getElementById(
                'user-search-results'
            );

        if (results) {

            results.innerHTML = `
                <p
                    style="
                        color:var(--nc-grey);
                        text-align:center;
                        padding:20px;
                    "
                >
                    Digite algo para começar a pesquisar...
                </p>
            `;
        }
    }
}


function closeUserSearch() {

    const modal =
        document.getElementById(
            'modal-user-search'
        );

    if (modal) {
        modal.style.display = 'none';
    }
}


function goToUserProfile(username) {

    closeUserSearch();

    window.location.href =
        `perfil.html?username=${encodeURIComponent(username)}`;
}