/* CINEAURA — Busca com debounce, resultados TMDB e busca de usuários */
function setupSearch() {
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    if (!input || !results) return;

    let activeIndex = -1;
    let currentResults = [];
    let currentUsers = [];
    let allResults = []; // movies + users combinados

    const doSearch = debounce(async (query) => {
        if (query.length < 1) {
            results.style.display = 'none';
            results.innerHTML = '';
            return;
        }

        results.style.display = 'block';
        results.innerHTML = `<div class="search-loading"><div class="search-skeleton"><div class="sk-img skeleton"></div><div class="sk-text"><div class="sk-line skeleton" style="height:14px;width:70%"></div><div class="sk-line skeleton" style="height:10px;width:40%"></div></div></div></div>`;

        try {
            // Busca simultânea de filmes/séries e usuários
            const [tmdbData, usersData] = await Promise.all([
                tmdbFetch(buildUrl('/search/multi', { query })).catch(() => ({ results: [] })),
                fetch(`api.php?action=search_users&query=${encodeURIComponent(query)}`)
                    .then(r => r.json())
                    .catch(() => ({ success: false, users: [] }))
            ]);

            currentResults = (tmdbData.results || [])
                .filter(r => r.media_type === 'movie' || r.media_type === 'tv')
                .slice(0, 5); // Reduz para 5 para fazer espaço para usuários

            currentUsers = (usersData.users || []).slice(0, 3); // Mostra até 3 usuários
            allResults = []; // Reset
            activeIndex = -1;

            if (currentResults.length === 0 && currentUsers.length === 0) {
                results.innerHTML = '<div class="search-empty">Nenhum resultado encontrado.</div>';
                return;
            }

            let html = '';

            // Seção de Filmes/Séries
            if (currentResults.length > 0) {
                html += '<div class="search-section"><div class="search-section-title">Filmes e Séries</div>';
                currentResults.forEach(item => {
                    const title = item.title || item.name;
                    const poster = posterUrl(item.poster_path, 'w342');
                    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
                    const year = extractYear(item.release_date || item.first_air_date) || '';
                    const type = item.media_type === 'tv' ? 'Série' : 'Filme';
                    
                    html += `
                        <div class="search-item search-movie-item" data-type="movie" data-id="${item.id}" data-media-type="${item.media_type}">
                            <img src="${poster}" alt="${title}" loading="lazy">
                            <div class="search-item-info">
                                <h5>${escapeHtml(title)}</h5>
                                <span>⭐ ${rating}${year ? ` · ${year}` : ''} · ${type}</span>
                            </div>
                        </div>
                    `;
                    allResults.push({ type: 'movie', id: item.id, media_type: item.media_type, title });
                });
                html += '</div>';
            }

            // Seção de Usuários
            if (currentUsers.length > 0) {
                html += '<div class="search-section"><div class="search-section-title">Usuários</div>';
                currentUsers.forEach(user => {
                    const avatar = user.avatar_url || 'https://via.placeholder.com/44x44?text=' + encodeURIComponent(user.username.charAt(0).toUpperCase());
                    const filmLabel = user.movie_count === 1 ? 'filme' : 'filmes';
                    const favLabel = user.fav_count === 1 ? 'favorito' : 'favoritos';
                    
                    html += `
                        <div class="search-item search-user-item" data-type="user" data-username="${escapeHtml(user.username)}">
                            <img src="${avatar}" alt="${escapeHtml(user.username)}" loading="lazy" class="search-user-avatar">
                            <div class="search-item-info">
                                <h5>@${escapeHtml(user.username)}</h5>
                                <span class="search-user-stats">${user.movie_count} ${filmLabel} · ${user.fav_count} ${favLabel}</span>
                            </div>
                        </div>
                    `;
                    allResults.push({ type: 'user', username: user.username });
                });
                html += '</div>';
            }

            results.innerHTML = html;

            // Adiciona event listeners aos items
            results.querySelectorAll('.search-movie-item').forEach(el => {
                el.addEventListener('click', () => {
                    const id = el.dataset.id;
                    const mediaType = el.dataset.mediaType;
                    results.style.display = 'none';
                    input.value = '';
                    openMovieDetails(id, mediaType);
                });
            });

            results.querySelectorAll('.search-user-item').forEach(el => {
                el.addEventListener('click', () => {
                    const username = el.dataset.username;
                    results.style.display = 'none';
                    input.value = '';
                    window.location.href = `perfil.html?username=${encodeURIComponent(username)}`;
                });
            });
        } catch (err) {
            console.error('Search error:', err);
            results.innerHTML = '<div class="search-empty">Erro ao buscar. Tente novamente.</div>';
        }
    }, CINEAURA.DEBOUNCE_MS);

    input.addEventListener('input', (e) => doSearch(e.target.value.trim()));

    input.addEventListener('keydown', (e) => {
        const items = results.querySelectorAll('.search-item');
        if (!items.length || results.style.display === 'none') return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIndex = Math.min(activeIndex + 1, items.length - 1);
            updateFocus(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIndex = Math.max(activeIndex - 1, 0);
            updateFocus(items);
        } else if (e.key === 'Enter' && activeIndex >= 0) {
            e.preventDefault();
            items[activeIndex].click();
        } else if (e.key === 'Escape') {
            results.style.display = 'none';
            input.blur();
        }
    });

    function updateFocus(items) {
        items.forEach((el, i) => el.classList.toggle('focused', i === activeIndex));
        items[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !results.contains(e.target)) {
            results.style.display = 'none';
        }
    });

    input.addEventListener('focus', () => {
        if ((currentResults.length || currentUsers.length) && input.value.trim()) {
            results.style.display = 'block';
        }
    });
}
