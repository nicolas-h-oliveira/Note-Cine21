/* Note Cine — Aplicação Principal com Categorias Separadas */

/* ==========================================================================
   PERFIL NO HEADER
   ========================================================================== */

function atualizarLetraDoPerfil() {

    const user =
        typeof Storage !== 'undefined'
            ? Storage.getUser()
            : null;

    if (
        user &&
        (user.username || user.nome)
    ) {

        const nomeUser =
            user.username || user.nome;

        const avatarEl =
            document.getElementById(
                'user-avatar-btn'
            );

        if (avatarEl) {

            avatarEl.textContent =
                nomeUser
                    .charAt(0)
                    .toUpperCase();
        }
    }
}


/* ==========================================================================
   INICIALIZAÇÃO
   ========================================================================== */

document.addEventListener(
    'DOMContentLoaded',
    async () => {

        atualizarLetraDoPerfil();

        const path =
            window.location.pathname;

        if (path.includes('filme.html')) {

            await initMovieDetailsPage();

        } else if (
            path.includes('perfil.html')
        ) {

            await initProfilePage();

        } else if (
            path.includes('favoritos.html')
        ) {

            await initFavoritesPage();

        } else {

            await initHomePage();
        }
    }
);


/* ==========================================================================
   PÁGINA INICIAL (ESTRUTURA NOVA COM CATEGORIAS)
   ========================================================================== */

async function initHomePage() {

    try {

        const data =
            await tmdbFetch(
                buildUrl(
                    '/trending/all/week'
                )
            );

        const items =
            data.results || [];


        if (items.length > 0) {

            const destaque =
                items[0];


            /* HERO */

            const titleEl =
                document.getElementById(
                    'hero-title'
                );

            if (titleEl) {

                titleEl.textContent =
                    destaque.title ||
                    destaque.name;
            }


            const descEl =
                document.getElementById(
                    'hero-desc'
                );

            if (descEl) {

                descEl.textContent =
                    destaque.overview ||
                    'Confira este grande sucesso!';
            }


            const heroBanner =
                document.getElementById(
                    'hero-banner'
                );

            if (
                heroBanner &&
                destaque.backdrop_path
            ) {

                heroBanner.style.backgroundImage =
                    `
                    linear-gradient(
                        to top,
                        #0b0e14 10%,
                        rgba(11,14,20,0.6) 90%
                    ),
                    url(
                        'https://image.tmdb.org/t/p/original${destaque.backdrop_path}'
                    )
                    `;

                heroBanner.style.backgroundSize =
                    'cover';

                heroBanner.style.backgroundPosition =
                    'center';
            }


            const mediaType =
                destaque.media_type ||
                'movie';


            const btnPlay =
                document.getElementById(
                    'btn-hero-play'
                );

            if (btnPlay) {

                btnPlay.onclick = () =>
                    openMovieDetails(
                        destaque.id,
                        mediaType
                    );
            }


            const btnInfo =
                document.getElementById(
                    'btn-hero-info'
                );

            if (btnInfo) {

                btnInfo.onclick = () =>
                    openMovieDetails(
                        destaque.id,
                        mediaType
                    );
            }


            /* CARROSSÉIS COM CATEGORIAS */

            const catalogContainer =
                document.getElementById(
                    'catalog-sections'
                );

            if (catalogContainer) {

                catalogContainer.innerHTML =
                    '';

                // ============================================
                // SEÇÃO: FILMES
                // ============================================

                // Filmes em Alta
                const trendingMovies =
                    await tmdbFetch(
                        buildUrl(
                            '/trending/movie/week',
                            { page: 1 }
                        )
                    );

                await criarCarrosselFilmes(
                    catalogContainer,
                    '🎬 Filmes em Alta',
                    trendingMovies.results || [],
                    'movie'
                );


                // Filmes Populares
                const popMovies =
                    await tmdbFetch(
                        buildUrl(
                            '/movie/popular',
                            { page: 1 }
                        )
                    );

                await criarCarrosselFilmes(
                    catalogContainer,
                    '⭐ Filmes Populares',
                    popMovies.results || [],
                    'movie'
                );


                // Filmes Melhor Avaliados
                const topMovies =
                    await tmdbFetch(
                        buildUrl(
                            '/movie/top_rated',
                            { page: 1 }
                        )
                    );

                await criarCarrosselFilmes(
                    catalogContainer,
                    '🏆 Filmes Melhor Avaliados',
                    topMovies.results || [],
                    'movie'
                );


                // ============================================
                // SEÇÃO: SÉRIES
                // ============================================

                // Séries em Alta
                const trendingTV =
                    await tmdbFetch(
                        buildUrl(
                            '/trending/tv/week',
                            { page: 1 }
                        )
                    );

                await criarCarrosselFilmes(
                    catalogContainer,
                    '📺 Séries em Alta',
                    trendingTV.results || [],
                    'tv'
                );


                // Séries Populares
                const popTV =
                    await tmdbFetch(
                        buildUrl(
                            '/tv/popular',
                            { page: 1 }
                        )
                    );

                await criarCarrosselFilmes(
                    catalogContainer,
                    '📺 Séries Populares',
                    popTV.results || [],
                    'tv'
                );


                // Séries Melhor Avaliadas
                const topTV =
                    await tmdbFetch(
                        buildUrl(
                            '/tv/top_rated',
                            { page: 1 }
                        )
                    );

                await criarCarrosselFilmes(
                    catalogContainer,
                    '🏆 Séries Melhor Avaliadas',
                    topTV.results || [],
                    'tv'
                );


                // ============================================
                // SEÇÃO: ANIMES
                // ============================================

                // Animes Populares (Séries animadas japonesas)
                const animeGenreId = 16; // Animação
                const animePopular =
                    await tmdbFetch(
                        buildUrl(
                            '/discover/tv',
                            {
                                page: 1,
                                with_genres: animeGenreId,
                                with_original_language: 'ja',
                                sort_by: 'popularity.desc'
                            }
                        )
                    );

                await criarCarrosselFilmes(
                    catalogContainer,
                    '🍥 Animes Populares',
                    animePopular.results || [],
                    'tv'
                );


                // Animes Melhor Avaliados
                const animeTopRated =
                    await tmdbFetch(
                        buildUrl(
                            '/discover/tv',
                            {
                                page: 1,
                                with_genres: animeGenreId,
                                with_original_language: 'ja',
                                sort_by: 'vote_average.desc',
                                'vote_count.gte': 200
                            }
                        )
                    );

                await criarCarrosselFilmes(
                    catalogContainer,
                    '🏆 Animes Melhor Avaliados',
                    animeTopRated.results || [],
                    'tv'
                );


                if (
                    typeof initCarousels ===
                    'function'
                ) {

                    initCarousels();
                }
            }
        }

    } catch (err) {

        console.error(
            'Erro ao carregar a home:',
            err
        );

        const title =
            document.getElementById(
                'hero-title'
            );

        if (title) {
            title.textContent =
                'Erro de Conexão';
        }
    }
}


/* ==========================================================================
   CRIAÇÃO DOS CARROSSÉIS (COM SUPORTE A TIPO DE MÍDIA)
   ========================================================================== */

async function criarCarrosselFilmes(
    container,
    titulo,
    items,
    mediaType = 'movie'
) {

    if (
        !items ||
        items.length === 0
    ) {
        return;
    }


    const section =
        document.createElement(
            'section'
        );

    section.className =
        'catalog-section';

    section.style.marginBottom =
        '3rem';

    section.dataset.mediaType = mediaType;


    section.innerHTML = `
        <div
            style="
                padding:0 5%;
                display:flex;
                align-items:center;
                justify-content:space-between;
                margin-bottom:15px;
            "
        >
            <h2
                style="
                    color:#fff;
                    font-size:1.5rem;
                    margin:0;
                    font-weight:600;
                "
            >
                ${titulo}
            </h2>
        </div>

        <div
            class="carousel-wrapper"
            style="
                position:relative;
                overflow:visible;
            "
        >

            <button
                class="carousel-arrow carousel-arrow--left"
                style="
                    position:absolute;
                    left:1%;
                    top:50%;
                    transform:translateY(-50%);
                    z-index:10;
                    background:rgba(0,0,0,0.5);
                    border:none;
                    color:#fff;
                    width:40px;
                    height:40px;
                    border-radius:50%;
                    cursor:pointer;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    transition:all 0.2s;
                "
            >
                <i class="fa-solid fa-chevron-left"></i>
            </button>


            <div
                class="carousel-viewport"
                style="
                    overflow:hidden;
                    padding:8px 3%;
                "
            >

                <div
                    class="carousel-track"
                    style="
                        display:flex;
                        gap:15px;
                        transition:transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                    "
                ></div>

            </div>


            <button
                class="carousel-arrow carousel-arrow--right"
                style="
                    position:absolute;
                    right:1%;
                    top:50%;
                    transform:translateY(-50%);
                    z-index:10;
                    background:rgba(0,0,0,0.5);
                    border:none;
                    color:#fff;
                    width:40px;
                    height:40px;
                    border-radius:50%;
                    cursor:pointer;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    transition:all 0.2s;
                "
            >
                <i class="fa-solid fa-chevron-right"></i>
            </button>

        </div>
    `;


    const track =
        section.querySelector(
            '.carousel-track'
        );


    items.forEach(
        (item, index) => {

            // Normaliza o media_type
            const itemType =
                item.media_type ||
                mediaType ||
                'movie';

            const card =
                createMovieCard(
                    {
                        ...item,
                        media_type: itemType
                    },
                    index
                );

            card.style.flex =
                '0 0 auto';

            card.style.width =
                '180px';

            track.appendChild(card);
        }
    );


    container.appendChild(
        section
    );
}


/* ==========================================================================
   DETALHES
   ========================================================================== */

async function initMovieDetailsPage() {

    const urlParams =
        new URLSearchParams(
            window.location.search
        );

    const rawId =
        urlParams.get('id');

    const mediaType =
        urlParams.get('type') ||
        'movie';


    if (!rawId) {

        showDetailsError(
            'Título não especificado.'
        );

        return;
    }


    const id =
        String(rawId).includes(':')
            ? String(rawId).split(':')[1]
            : String(rawId);


    try {

        const item =
            await tmdbFetch(
                buildUrl(
                    `/${mediaType}/${id}`,
                    {
                        append_to_response:
                            'credits,videos'
                    }
                )
            );


        if (
            !item ||
            item.success === false
        ) {

            showDetailsError(
                'Filme ou série não encontrado.'
            );

            return;
        }


        renderMovieDetails(
            item,
            mediaType
        );

        await setupMovieDetailsButtons(
            item,
            mediaType
        );

        await loadMovieReviews(
            id,
            mediaType
        );

    } catch (error) {

        console.error(
            'Erro ao carregar filme:',
            error
        );

        showDetailsError(
            'Tente novamente mais tarde.'
        );
    }
}


/* ==========================================================================
   RENDER DETALHES
   ========================================================================== */

function renderMovieDetails(
    item,
    mediaType
) {

    const title =
        item.title ||
        item.name ||
        'Sem Título';

    const overview =
        item.overview &&
        item.overview.trim() !== ''
            ? item.overview
            : 'Sinopse não disponível.';


    const titleEl =
        document.querySelector('h1') ||
        document.getElementById(
            'movie-title'
        );

    if (titleEl) {
        titleEl.textContent =
            title;
    }


    const sinopseEl =
        document.querySelector(
            '.sinopse-text'
        ) ||
        document.getElementById(
            'movie-overview'
        ) ||
        document.querySelector('p');


    if (sinopseEl) {
        sinopseEl.textContent =
            overview;
    }


    const posterEl =
        document.getElementById(
            'movie-poster'
        );

    if (
        posterEl &&
        item.poster_path
    ) {

        posterEl.src =
            posterUrl(
                item.poster_path,
                'w500'
            );
    }


    const backdropEl =
        document.getElementById(
            'movie-backdrop'
        );

    if (
        backdropEl &&
        item.backdrop_path
    ) {

        backdropEl.style.backgroundImage =
            `url(
                'https://image.tmdb.org/t/p/original${item.backdrop_path}'
            )`;
    }
}


/* ==========================================================================
   BOTÕES DOS DETALHES
   ========================================================================== */

async function setupMovieDetailsButtons(
    item,
    mediaType
) {

    const btnFav =
        document.getElementById(
            'btn-fav'
        ) ||
        document.querySelector(
            '.btn-favorite'
        );


    const btnProfile =
        document.getElementById(
            'btn-profile'
        ) ||
        document.querySelector(
            '.btn-profile'
        );


    const mediaItem = {
        ...item,
        media_type: mediaType
    };


    if (btnFav) {

        const isFav =
            await Storage.isFavorite(
                item.id,
                mediaType
            );

        updateButtonUI(
            btnFav,
            isFav,
            'Remover dos Favoritos',
            'Adicionar aos Favoritos'
        );


        btnFav.onclick =
            async () => {

                const res =
                    await Storage.toggleFavorite(
                        mediaItem
                    );

                if (res.ok) {

                    updateButtonUI(
                        btnFav,
                        res.added,
                        'Remover dos Favoritos',
                        'Adicionar aos Favoritos'
                    );

                } else {

                    showToast(
                        res.msg,
                        'error'
                    );
                }
            };
    }


    if (btnProfile) {

        const inProfile =
            await Storage.isInProfile(
                item.id,
                mediaType
            );

        updateButtonUI(
            btnProfile,
            inProfile,
            'Remover do Perfil',
            'Adicionar ao Perfil'
        );


        btnProfile.onclick =
            async () => {

                const res =
                    await Storage.toggleProfileMovie(
                        mediaItem
                    );

                if (res.ok) {

                    updateButtonUI(
                        btnProfile,
                        res.added,
                        'Remover do Perfil',
                        'Adicionar ao Perfil'
                    );

                } else {

                    showToast(
                        res.msg,
                        'error'
                    );
                }
            };
    }
}


/* ==========================================================================
   UI DOS BOTÕES
   ========================================================================== */

function updateButtonUI(
    btn,
    active,
    activeText,
    inactiveText
) {

    if (!btn) {
        return;
    }


    if (active) {

        btn.classList.add(
            'active'
        );

        btn.innerHTML = `
            <i class="fa-solid fa-check"></i>
            ${activeText}
        `;

    } else {

        btn.classList.remove(
            'active'
        );

        btn.innerHTML = `
            <i class="fa-solid fa-plus"></i>
            ${inactiveText}
        `;
    }
}


/* ==========================================================================
   ERRO
   ========================================================================== */

function showDetailsError(msg) {

    const titleEl =
        document.querySelector(
            'h1'
        );

    if (titleEl) {
        titleEl.textContent =
            'Erro';
    }


    const sinopseEl =
        document.querySelector(
            '.sinopse-text'
        );

    if (sinopseEl) {
        sinopseEl.textContent =
            msg;
    }
}


/* ==========================================================================
   CRÍTICAS
   ========================================================================== */

async function loadMovieReviews(
    id,
    mediaType
) {

    const container =
        document.getElementById(
            'reviews-list'
        );

    if (!container) {
        return;
    }


    const reviews =
        await Storage.getMovieReviews(
            id,
            mediaType
        );


    const countEl =
        document.getElementById(
            'reviews-count'
        );


    if (countEl) {
        countEl.textContent =
            reviews.length;
    }


    if (
        reviews.length === 0
    ) {

        container.innerHTML = `
            <p
                class="no-reviews"
                style="color:var(--nc-grey);"
            >
                Nenhuma crítica enviada ainda.
            </p>
        `;

        return;
    }


    container.innerHTML =
        reviews
            .map(r => `
                <div
                    class="review-card"
                    style="
                        background:var(--nc-surface-2);
                        padding:15px;
                        border-radius:8px;
                        margin-bottom:10px;
                    "
                >

                    <div
                        style="
                            display:flex;
                            justify-content:space-between;
                            margin-bottom:10px;
                        "
                    >

                        <strong
                            style="
                                color:var(--nc-white);
                            "
                        >
                            @${r.username}
                        </strong>

                        <span
                            style="color:gold;"
                        >
                            ★ ${r.rating}
                        </span>

                    </div>

                    <h5
                        style="
                            color:var(--nc-white);
                            margin-bottom:5px;
                        "
                    >
                        ${r.title}
                    </h5>

                    <p
                        style="
                            color:var(--nc-grey);
                            font-size:0.9rem;
                        "
                    >
                        ${r.text}
                    </p>

                </div>
            `)
            .join('');
}


/* ==========================================================================
   PERFIL
   ========================================================================== */

async function initProfilePage() {

    const urlParams =
        new URLSearchParams(
            window.location.search
        );

    /*
     * Aceita tanto ?user= quanto ?username=
     */
    const targetUser =
        urlParams.get('username') ||
        urlParams.get('user') ||
        '';


    try {

        const movies =
            await Storage.getProfileMovies(
                targetUser
            );

        const favorites =
            await Storage.getFavorites(
                targetUser
            );


        renderProfileGrid(
            'profile-movies-grid',
            movies
        );

        renderProfileGrid(
            'favorites-grid',
            favorites
        );

    } catch (error) {

        console.error(
            'Erro ao carregar perfil:',
            error
        );
    }
}


/* ==========================================================================
   FAVORITOS
   ========================================================================== */

async function initFavoritesPage() {

    try {

        const favorites =
            await Storage.getFavorites();


        renderProfileGrid(
            'favorites-container',
            favorites
        );

    } catch (error) {

        console.error(
            'Erro ao carregar favoritos:',
            error
        );
    }
}


/* ==========================================================================
   GRID DO PERFIL/FAVORITOS
   ========================================================================== */

function renderProfileGrid(
    containerId,
    items
) {

    const container =
        document.getElementById(
            containerId
        );

    if (!container) {
        return;
    }


    container.innerHTML =
        '';

    container.style.display =
        'grid';

    container.style.gridTemplateColumns =
        'repeat(auto-fill, minmax(180px, 1fr))';

    container.style.gap =
        '20px';


    if (
        !items ||
        items.length === 0
    ) {

        container.style.display =
            'block';

        container.innerHTML = `
            <div
                style="
                    color:var(--nc-grey);
                "
            >
                Nenhum título cadastrado.
            </div>
        `;

        return;
    }


    items.forEach(
        (item, index) => {

            /*
             * IMPORTANTE:
             *
             * Antes o código fazia:
             *
             * item.poster.split('w500')[1]
             *
             * Isso podia transformar uma URL válida
             * em uma URL inválida.
             *
             * Agora mantemos a capa original.
             */

            const formattedItem = {

                id: item.id,

                media_type:
                    item.media_type ||
                    'movie',

                title:
                    item.title ||
                    item.name ||
                    'Sem título',

                poster:
                    item.poster ||
                    item.poster_url ||
                    '',

                poster_path:
                    item.poster_path ||
                    null,

                rating:
                    item.rating ||
                    item.vote_average ||
                    null,

                year:
                    item.year ||
                    '',

                runtime:
                    item.runtime ||
                    null,

                genres:
                    item.genres ||
                    []
            };


            const card =
                createMovieCard(
                    formattedItem,
                    index
                );


            container.appendChild(
                card
            );
        }
    );
}