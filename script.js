// ============================================================
// CÓDIGO COMPLETO DE INTEGRAÇÃO COM A API (script.js)
// ============================================================

/**
 * 1. ADICIONAR FILME AO PERFIL
 */
async function adicionarAoPerfil(movieId, title, posterPath, mediaType = 'movie') {
    if (!movieId) {
        alert('Erro: ID do filme não encontrado.');
        return;
    }

    try {
        const formData = new FormData();
        formData.append('action', 'add_top_movie');
        formData.append('movie_id', movieId);
        formData.append('title', title || 'Sem Título');
        formData.append('poster_path', posterPath || '');
        formData.append('media_type', mediaType);

        const response = await fetch('api.php', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message || 'Adicionado ao seu perfil!');
            // Atualiza os botões da tela
            verificarStatusFilme(movieId);
        } else {
            alert('Aviso: ' + data.message);
        }
    } catch (error) {
        console.error('Erro ao adicionar ao perfil:', error);
        alert('Falha na comunicação com o servidor api.php');
    }
}

/**
 * 2. REMOVER FILME DO PERFIL
 */
async function removerDoPerfil(movieId) {
    try {
        const formData = new FormData();
        formData.append('action', 'remove_top_movie');
        formData.append('movie_id', movieId);

        const response = await fetch('api.php', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message || 'Removido do perfil.');
            verificarStatusFilme(movieId);
        } else {
            alert('Erro: ' + data.message);
        }
    } catch (error) {
        console.error('Erro ao remover do perfil:', error);
        alert('Erro ao conectar com o servidor.');
    }
}

/**
 * 3. FAVORITAR / DESFAVORITAR
 */
async function toggleFavorito(movieId, title, posterPath, mediaType = 'movie') {
    try {
        const formData = new FormData();
        formData.append('action', 'toggle_favorite');
        formData.append('movie_id', movieId);
        formData.append('title', title || 'Sem Título');
        formData.append('poster_path', posterPath || '');
        formData.append('media_type', mediaType);

        const response = await fetch('api.php', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message);
            verificarStatusFilme(movieId);
        } else {
            alert('Erro: ' + data.message);
        }
    } catch (error) {
        console.error('Erro ao favoritar:', error);
        alert('Erro ao conectar com o servidor.');
    }
}

/**
 * 4. VERIFICAR STATUS DO FILME (Muda o texto e a função dos botões na tela)
 */
async function verificarStatusFilme(movieId) {
    if (!movieId) return;

    try {
        const response = await fetch(`api.php?action=check_movie_status&movie_id=${movieId}`);
        const data = await response.json();

        if (data.success) {
            const btnPerfil = document.getElementById('btn-perfil');
            const btnFavorito = document.getElementById('btn-favorito');

            // Atualiza Botão de Perfil
            if (btnPerfil) {
                if (data.in_profile) {
                    btnPerfil.innerText = '📌 Remover do Perfil';
                    btnPerfil.onclick = () => removerDoPerfil(movieId);
                    btnPerfil.classList.add('no-perfil');
                } else {
                    btnPerfil.innerText = '➕ Adicionar ao Perfil';
                    btnPerfil.classList.remove('no-perfil');
                }
            }

            // Atualiza Botão de Favorito
            if (btnFavorito) {
                if (data.is_favorite) {
                    btnFavorito.innerText = '❤️ Favoritado';
                    btnFavorito.classList.add('favoritado');
                } else {
                    btnFavorito.innerText = '🤍 Favoritar';
                    btnFavorito.classList.remove('favoritado');
                }
            }
        }
    } catch (error) {
        console.error('Erro ao verificar status:', error);
    }
}