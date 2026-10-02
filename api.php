<?php
/**
 * API do Note Cine.
 *
 * Regras importantes:
 *  - A resposta SEMPRE sai em JSON (nunca HTML de erro), senão o front cai no
 *    "Erro de conexão" mesmo com o servidor funcionando.
 *  - O sistema precisa funcionar tanto em http://localhost quanto em
 *    http://IP-DO-SERVIDOR (acesso por outra máquina na rede).
 */

// Erros vão para o log do Apache, nunca para o corpo da resposta (quebraria o JSON).
ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

define('APP_ROOT', __DIR__);
define('DB_HOST', '127.0.0.1');
define('DB_NAME', 'filmezim');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_CHARSET', 'utf8mb4');

/**
 * Envia uma resposta JSON e encerra o script.
 */
function apiRespond(array $payload, int $status = 200)
{
    if (!headers_sent()) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
    }
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function apiFail(string $message, int $status = 200, array $extra = [])
{
    apiRespond(array_merge(['success' => false, 'message' => $message], $extra), $status);
}

function apiOk(array $payload = [])
{
    apiRespond(array_merge(['success' => true], $payload));
}

// Qualquer erro não tratado vira JSON (antes virava um HTML 500 e o JS quebrava).
set_exception_handler(function (Throwable $e) {
    error_log('[api.php] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    apiFail('Erro interno no servidor: ' . $e->getMessage(), 500);
});

// ------------------------------------------------------------------
// Cabeçalhos de rede (necessário para acessar via IP de outra máquina)
// ------------------------------------------------------------------
$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (int)($_SERVER['SERVER_PORT'] ?? 0) === 443
    || strtolower($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Referrer-Policy: same-origin');

/**
 * Libera o acesso para a própria origem e para endereços privados/local
 * (192.168.x.x, 10.x.x.x, 172.16-31.x.x, localhost). Origens da internet
 * aberta continuam bloqueadas.
 */
function isLocalOrigin(?string $origin): bool
{
    if (!$origin) {
        return false;
    }
    $host = parse_url($origin, PHP_URL_HOST);
    if (!$host) {
        return false;
    }
    if (in_array(strtolower($host), ['localhost', '127.0.0.1', '::1', '0.0.0.0'], true)) {
        return true;
    }
    if (filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
        return filter_var(
            $host,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
        ) === false;
    }
    return false;
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '') {
    header('Vary: Origin');
    if (isLocalOrigin($origin)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
    }
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With, Accept, Origin, Authorization');
header('Access-Control-Max-Age: 86400');

// Preflight
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ------------------------------------------------------------------
// Sessão (cookie com path "/" para valer em qualquer página do projeto)
// ------------------------------------------------------------------
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'domain'   => '',
    'secure'   => $isHttps,
    'httponly' => true,
    'samesite' => 'Lax',
]);
if (session_status() === PHP_SESSION_NONE) {
    if (!@session_start()) {
        error_log('[api.php] falha ao iniciar a sessão');
        apiFail('Não foi possível iniciar a sessão no servidor.', 500);
    }
}

// ------------------------------------------------------------------
// Banco de dados
// ------------------------------------------------------------------
try {
    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s', DB_HOST, DB_NAME, DB_CHARSET);
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
} catch (PDOException $e) {
    error_log('[api.php] falha de conexão com o banco: ' . $e->getMessage());
    apiFail(
        'Erro crítico: falha ao conectar no banco de dados ' . DB_NAME . '. Detalhe: ' . $e->getMessage(),
        500
    );
}

// Garante que a pasta de uploads exista (usada no avatar/banner do perfil).
if (!is_dir(APP_ROOT . '/uploads')) {
    @mkdir(APP_ROOT . '/uploads', 0755, true);
}

// Suporte para JSON vindo no corpo da requisição (fetch)
$json_input = json_decode(file_get_contents('php://input'), true);
if (is_array($json_input)) {
    $_POST = array_merge($_POST, $json_input);
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';

// --- FUNÇÕES DE AJUDA E SEGURANÇA ---

/**
 * NORMALIZA O IDENTIFICADOR DO FILME PARA O FORMATO COMPOSITE
 * Formatos aceitos:
 *   - "movie:550" (já normalizado)
 *   - "tv:1234" (já normalizado)
 *   - "550" (assume movie)
 *   - "1234" (assume movie)
 * 
 * Retorna sempre: "media_type:id"
 */
function normalizeMovieId($rawId, $mediaType = 'movie') {
    if (empty($rawId)) {
        return null;
    }

    $rawId = trim((string)$rawId);
    
    // Se já tem o formato "type:id", retorna como está
    if (strpos($rawId, ':') !== false) {
        list($type, $id) = explode(':', $rawId, 2);
        $type = strtolower(trim($type));
        $id = trim($id);
        
        if (!empty($id) && in_array($type, ['movie', 'tv', 'anime'])) {
            return "{$type}:{$id}";
        }
    }
    
    // Caso contrário, combina com o media_type fornecido
    $mediaType = strtolower($mediaType ?? 'movie');
    if (!in_array($mediaType, ['movie', 'tv', 'anime'])) {
        $mediaType = 'movie';
    }
    
    return "{$mediaType}:{$rawId}";
}

/**
 * DECODIFICA O COMPOSITE ID
 * Entrada: "movie:550"
 * Saída: ['type' => 'movie', 'id' => '550']
 */
function parseMovieId($compositeId) {
    if (empty($compositeId)) {
        return ['type' => 'movie', 'id' => ''];
    }

    if (strpos($compositeId, ':') !== false) {
        list($type, $id) = explode(':', $compositeId, 2);
        return [
            'type' => strtolower(trim($type)),
            'id' => trim($id)
        ];
    }

    return ['type' => 'movie', 'id' => $compositeId];
}

function getUserId() {
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['success' => false, 'message' => 'Não autenticado. Por favor, faça login.']);
        exit;
    }
    return $_SESSION['user_id'];
}

function requireAdmin($pdo) {
    $userId = getUserId();
    $stmt = $pdo->prepare("SELECT role FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $role = $stmt->fetchColumn();

    if ($role !== 'admin') {
        echo json_encode(['success' => false, 'message' => 'Acesso negado. Apenas administradores podem realizar esta ação.']);
        exit;
    }
    return $userId;
}

function validateAndUploadFile($fileInput, $prefix, $userId) {
    if (!isset($_FILES[$fileInput]) || $_FILES[$fileInput]['error'] !== UPLOAD_ERR_OK) {
        return null;
    }

    $ext = strtolower(pathinfo($_FILES[$fileInput]['name'], PATHINFO_EXTENSION));
    $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

    if (!in_array($ext, $allowedExtensions)) {
        echo json_encode(['success' => false, 'message' => 'Extensão de arquivo não permitida. Use apenas JPG, PNG, GIF ou WEBP.']);
        exit;
    }

    $fileName = $prefix . '_' . $userId . '_' . time() . '.' . $ext;
    $destPath = __DIR__ . '/uploads/' . $fileName;

    if (!is_dir(__DIR__ . '/uploads')) {
        mkdir(__DIR__ . '/uploads', 0755, true);
    }

    if (move_uploaded_file($_FILES[$fileInput]['tmp_name'], $destPath)) {
        return ['url' => 'uploads/' . $fileName, 'ext' => $ext];
    }

    return null;
}

// 1. SISTEMA DE LOGIN (COM MIGRAÇÃO AUTOMÁTICA DE SENHA)
if ($action === 'login') {
    $login_input = $_POST['login'] ?? '';
    $password_input = $_POST['password'] ?? '';

    if (empty($login_input) || empty($password_input)) {
        echo json_encode(['success' => false, 'message' => 'Preencha todos os campos.']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ? OR email = ?");
    $stmt->execute([$login_input, $login_input]);
    $user_data = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user_data) {
        $isAuthenticated = false;

        // 1. Tenta verificar por Hash Criptografada
        if (password_verify($password_input, $user_data['password_hash'])) {
            $isAuthenticated = true;
        } 
        // 2. Compatibilidade temporária com senhas antigas em texto puro
        else if ($password_input === $user_data['password_hash']) {
            $isAuthenticated = true;

            // Criptografa e atualiza no banco automaticamente no login
            $newHash = password_hash($password_input, PASSWORD_DEFAULT);
            $updateStmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
            $updateStmt->execute([$newHash, $user_data['id']]);
        }

        if ($isAuthenticated) {
            if ($user_data['status'] !== 'approved') {
                echo json_encode(['success' => false, 'message' => 'Sua conta ainda está aguardando aprovação.']);
                exit;
            }
            
            $_SESSION['user_id'] = $user_data['id'];
            $_SESSION['username'] = $user_data['username'];
            $_SESSION['user_role'] = $user_data['role'];

            echo json_encode([
                'success' => true, 
                'message' => 'Login realizado com sucesso!',
                'user' => [
                    'id' => $user_data['id'],
                    'username' => $user_data['username'],
                    'role' => $user_data['role']
                ]
            ]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Senha incorreta.']);
        }
    } else {
        echo json_encode(['success' => false, 'message' => 'Usuário não encontrado.']);
    }
    exit;
}

// 2. SISTEMA DE REGISTRO
if ($action === 'register') {
    $username = trim($_POST['username'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';

    if (empty($username) || empty($email) || empty($password)) {
        echo json_encode(['success' => false, 'message' => 'Preencha todos os campos para criar a conta.']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT username, email FROM users WHERE username = ? OR email = ?");
    $stmt->execute([$username, $email]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($existing) {
        if (strcasecmp($existing['email'], $email) === 0) {
            echo json_encode(['success' => false, 'message' => 'Este e-mail já está cadastrado.']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Este nome de usuário já está em uso.']);
        }
        exit;
    }

    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

    $stmt = $pdo->prepare("INSERT INTO users (username, email, password_hash, role, status) VALUES (?, ?, ?, 'user', 'approved')");
    if ($stmt->execute([$username, $email, $hashedPassword])) {
        echo json_encode(['success' => true, 'message' => 'Conta criada com sucesso! Faça login.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Erro interno ao tentar criar a conta.']);
    }
    exit;
}

// 3. RETORNAR USUÁRIOS (ADMIN APENAS)
if ($action === 'get_users') {
    requireAdmin($pdo);
    $stmt = $pdo->query("SELECT id, username, email, role, status FROM users ORDER BY id DESC");
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['success' => true, 'users' => $users]);
    exit;
}

// 4. ATUALIZAR USUÁRIO (ADMIN APENAS)
if ($action === 'update_user') {
    requireAdmin($pdo);
    $id = $_POST['id'] ?? '';
    $role = $_POST['role'] ?? '';
    $status = $_POST['status'] ?? '';

    $stmt = $pdo->prepare("UPDATE users SET role = ?, status = ? WHERE id = ?");
    if ($stmt->execute([$role, $status, $id])) {
        if (isset($_SESSION['user_id']) && (int)$_SESSION['user_id'] === (int)$id) {
            $_SESSION['user_role'] = $role;
        }
        echo json_encode(['success' => true, 'message' => 'Usuário atualizado com sucesso.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Erro ao atualizar.']);
    }
    exit;
}

// 5. OBTER USUÁRIO ATUAL
if ($action === 'get_current_user') {
    $userId = getUserId();
    $stmt = $pdo->prepare("SELECT id, username, email, role, status, bio, avatar_url, banner_url, banner_type, profile_effect, avatar_frame, accent_color FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user_data = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user_data) {
        $_SESSION['user_role'] = $user_data['role'];
        $_SESSION['username'] = $user_data['username'];
        echo json_encode(['success' => true, 'user' => $user_data]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Usuário não encontrado.']);
    }
    exit;
}

// 6. BUSCA DE USUÁRIOS
if ($action === 'search_users') {
    $query = trim($_GET['query'] ?? '');
    if (strlen($query) < 1) {
        echo json_encode(['success' => true, 'users' => []]);
        exit;
    }

    $stmt = $pdo->prepare("
        SELECT u.id, u.username, u.role, u.avatar_url, u.banner_url,
               (SELECT COUNT(*) FROM favorites f WHERE f.user_id = u.id) as fav_count,
               (SELECT COUNT(*) FROM top_movies tm WHERE tm.user_id = u.id) as movie_count,
               (SELECT COUNT(*) FROM reviews r WHERE r.user_id = u.id) as review_count
        FROM users u 
        WHERE u.username LIKE ? OR u.email LIKE ?
        LIMIT 10
    ");
    $stmt->execute(["%$query%", "%$query%"]);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['success' => true, 'users' => $users]);
    exit;
}

// 7. DADOS DE PERFIL DE QUALQUER USUÁRIO
if ($action === 'get_profile_data') {
    $username = trim($_GET['username'] ?? '');

    if (empty($username)) {
        if (!isset($_SESSION['user_id'])) {
            echo json_encode(['success' => false, 'message' => 'Não autenticado.']);
            exit;
        }
        $userId = $_SESSION['user_id'];
        $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
        $stmt->execute([$userId]);
    } else {
        $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ?");
        $stmt->execute([$username]);
    }

    $user_data = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user_data) {
        echo json_encode(['success' => false, 'message' => 'Usuário não encontrado.']);
        exit;
    }

    $profileUserId = $user_data['id'];

    $stmt = $pdo->prepare("SELECT movie_id, title, poster_url, media_type FROM favorites WHERE user_id = ? ORDER BY id DESC");
    $stmt->execute([$profileUserId]);
    $favorites = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $stmt = $pdo->prepare("SELECT movie_id, slot_position, title, poster_url, media_type FROM top_movies WHERE user_id = ? ORDER BY slot_position ASC");
    $stmt->execute([$profileUserId]);
    $top_movies = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $stmt = $pdo->prepare("SELECT slot_position, character_name, work_origin, image_url FROM top_characters WHERE user_id = ? ORDER BY slot_position ASC");
    $stmt->execute([$profileUserId]);
    $top_characters = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $stmt = $pdo->prepare("SELECT id, movie_id, rating, title, review_text, created_at FROM reviews WHERE user_id = ? ORDER BY id DESC");
    $stmt->execute([$profileUserId]);
    $reviews = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'user' => [
            'id' => $user_data['id'],
            'username' => $user_data['username'],
            'role' => $user_data['role'],
            'bio' => $user_data['bio'],
            'avatar_url' => $user_data['avatar_url'],
            'banner_url' => $user_data['banner_url'],
            'banner_type' => $user_data['banner_type'],
            'profile_effect' => $user_data['profile_effect'],
            'avatar_frame' => $user_data['avatar_frame'],
            'accent_color' => $user_data['accent_color'],
            'created_at' => $user_data['created_at']
        ],
        'favorites' => $favorites,
        'top_movies' => $top_movies,
        'top_characters' => $top_characters,
        'reviews' => $reviews
    ]);
    exit;
}

// 8. SALVAR BIO E FOTO DE PERFIL
if ($action === 'save_profile') {
    $userId = getUserId();
    $bio = trim($_POST['bio'] ?? '');
    
    $uploadResult = validateAndUploadFile('avatar', 'avatar', $userId);
    $avatar_url = $uploadResult ? $uploadResult['url'] : null;

    if ($avatar_url !== null) {
        $stmt = $pdo->prepare("UPDATE users SET bio = ?, avatar_url = ? WHERE id = ?");
        $stmt->execute([$bio, $avatar_url, $userId]);
    } else {
        $stmt = $pdo->prepare("UPDATE users SET bio = ? WHERE id = ?");
        $stmt->execute([$bio, $userId]);
    }

    echo json_encode(['success' => true, 'message' => 'Perfil salvo com sucesso.']);
    exit;
}

// 9. SALVAR DECORAÇÃO DE PERFIL
if ($action === 'save_decor') {
    $userId = getUserId();

    $stmt = $pdo->prepare("SELECT role FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $role = $stmt->fetchColumn();
    
    $isPremium = in_array($role, ['cinefilo', 'vip', 'admin', 'nitro']);
    if (!$isPremium) {
        echo json_encode(['success' => false, 'message' => 'Acesso negado. Apenas membros premium podem decorar o perfil.']);
        exit;
    }

    $frame = $_POST['frame'] ?? 'none';
    $effect = $_POST['effect'] ?? 'none';
    $accent = $_POST['accent'] ?? '#3B82F6';

    $uploadResult = validateAndUploadFile('banner', 'banner', $userId);
    $banner_url = $uploadResult ? $uploadResult['url'] : null;
    $banner_type = ($uploadResult && $uploadResult['ext'] === 'gif') ? 'gif' : 'image';

    // O modal de decoração também permite trocar a foto de perfil.
    $avatarResult = validateAndUploadFile('avatar', 'avatar', $userId);
    $avatar_url = $avatarResult ? $avatarResult['url'] : null;

    $sets = ['avatar_frame = ?', 'profile_effect = ?', 'accent_color = ?'];
    $values = [$frame, $effect, $accent];

    if ($banner_url !== null) {
        $sets[] = 'banner_url = ?';
        $sets[] = 'banner_type = ?';
        $values[] = $banner_url;
        $values[] = $banner_type;
    }

    if ($avatar_url !== null) {
        $sets[] = 'avatar_url = ?';
        $values[] = $avatar_url;
    }

    $values[] = $userId;

    $stmt = $pdo->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?');
    $stmt->execute($values);

    $response = ['success' => true, 'message' => 'Decorações salvas com sucesso.'];
    if ($avatar_url !== null) {
        $response['avatar'] = $avatar_url;
    }
    echo json_encode($response);
    exit;
}

// 10. REMOVER DECORAÇÕES
if ($action === 'remove_decor') {
    $userId = getUserId();
    $stmt = $pdo->prepare("UPDATE users SET avatar_frame = 'none', profile_effect = 'none', accent_color = '#3B82F6', banner_url = NULL, banner_type = 'image' WHERE id = ?");
    $stmt->execute([$userId]);
    echo json_encode(['success' => true, 'message' => 'Decorações removidas.']);
    exit;
}

// 10.5. CHECAR ESTADO INICIAL DOS BOTÕES
if ($action === 'check_movie_status') {
    $userId = getUserId();
    $movieId = $_GET['movie_id'] ?? $_GET['movieId'] ?? '';
    $mediaType = $_GET['media_type'] ?? $_GET['type'] ?? 'movie';

    if (empty($movieId)) {
        echo json_encode(['success' => true, 'is_favorite' => false, 'in_profile' => false]);
        exit;
    }

    // Normaliza para composite ID
    $compositeId = normalizeMovieId($movieId, $mediaType);

    $stmt = $pdo->prepare("SELECT id FROM favorites WHERE user_id = ? AND movie_id = ?");
    $stmt->execute([$userId, $compositeId]);
    $isFav = (bool)$stmt->fetch();

    $stmt = $pdo->prepare("SELECT id FROM top_movies WHERE user_id = ? AND movie_id = ?");
    $stmt->execute([$userId, $compositeId]);
    $inProfile = (bool)$stmt->fetch();

    echo json_encode(['success' => true, 'is_favorite' => $isFav, 'in_profile' => $inProfile]);
    exit;
}

// 11. FAVORITAR / DESFAVORITAR
if ($action === 'toggle_favorite') {
    $userId = getUserId();
    $movieId = $_POST['movie_id'] ?? $_POST['movieId'] ?? '';
    $mediaType = $_POST['media_type'] ?? 'movie';
    $title = $_POST['title'] ?? 'Sem Título';
    $poster_url = $_POST['poster_path'] ?? $_POST['poster_url'] ?? '';

    if (empty($movieId)) {
        echo json_encode(['success' => false, 'message' => 'ID do filme inválido.']);
        exit;
    }

    // Normaliza para composite ID
    $compositeId = normalizeMovieId($movieId, $mediaType);
    $parsed = parseMovieId($compositeId);

    $stmt = $pdo->prepare("SELECT id FROM favorites WHERE user_id = ? AND movie_id = ?");
    $stmt->execute([$userId, $compositeId]);
    $fav = $stmt->fetch();

    if ($fav) {
        $stmt = $pdo->prepare("DELETE FROM favorites WHERE user_id = ? AND movie_id = ?");
        $stmt->execute([$userId, $compositeId]);
        echo json_encode(['success' => true, 'is_favorite' => false, 'message' => 'Removido dos favoritos.']);
    } else {
        $stmt = $pdo->prepare("INSERT INTO favorites (user_id, movie_id, title, poster_url, media_type) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$userId, $compositeId, $title, $poster_url, $parsed['type']]);
        echo json_encode(['success' => true, 'is_favorite' => true, 'message' => 'Adicionado aos favoritos.']);
    }
    exit;
}

// 12. ADICIONAR AO PERFIL (Slot Automático de 1 a 5)
if ($action === 'add_top_movie') {
    $userId = getUserId();
    $movieId = $_POST['movie_id'] ?? $_POST['movieId'] ?? '';
    $mediaType = $_POST['media_type'] ?? 'movie';
    $title = $_POST['title'] ?? 'Sem Título';
    $poster_url = $_POST['poster_path'] ?? $_POST['poster_url'] ?? '';

    if (empty($movieId)) {
        echo json_encode(['success' => false, 'message' => 'ID do filme inválido ou não enviado.']);
        exit;
    }

    // NORMALIZA O ID PARA O FORMATO COMPOSITE: "media_type:id"
    $compositeId = normalizeMovieId($movieId, $mediaType);

    if (empty($compositeId)) {
        echo json_encode(['success' => false, 'message' => 'ID do filme inválido.']);
        exit;
    }

    // Verifica se já existe
    $stmt = $pdo->prepare("SELECT id FROM top_movies WHERE user_id = ? AND movie_id = ?");
    $stmt->execute([$userId, $compositeId]);
    if ($stmt->fetch()) {
        echo json_encode(['success' => true, 'message' => 'Este filme já está no seu perfil.']);
        exit;
    }

    // Identifica o plano do usuário
    $stmt = $pdo->prepare("SELECT role FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $role = strtolower($stmt->fetchColumn() ?: 'user');

    $unlimited = false;
    $maxSlots = 5;

    if ($role === 'admin') {
        $unlimited = true;
    } elseif ($role === 'nitro') {
        $maxSlots = 7;
    } elseif ($role === 'cinefilo' || $role === 'vip') {
        $maxSlots = 10;
    }

    // Encontra um slot livre
    $stmt = $pdo->prepare("SELECT slot_position FROM top_movies WHERE user_id = ?");
    $stmt->execute([$userId]);
    $slots = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    $freeSlot = null;
    $searchLimit = $unlimited ? max(1000, count($slots) + 1) : $maxSlots;

    for ($i = 1; $i <= $searchLimit; $i++) {
        if (!in_array((string)$i, array_map('strval', $slots))) {
            $freeSlot = $i;
            break;
        }
    }

    if ($freeSlot === null && !$unlimited) {
        echo json_encode(['success' => false, 'message' => "Seu perfil atingiu o limite de {$maxSlots} filmes. Remova algum antes."]);
        exit;
    }
    
    if ($freeSlot === null && $unlimited) {
        $freeSlot = count($slots) + 1;
    }

    // Insere com o composite ID
    $parsed = parseMovieId($compositeId);
    $stmt = $pdo->prepare("INSERT INTO top_movies (user_id, movie_id, slot_position, title, poster_url, media_type) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([$userId, $compositeId, $freeSlot, $title, $poster_url, $parsed['type']]);
    
    echo json_encode(['success' => true, 'message' => 'Adicionado ao seu perfil com sucesso!']);
    exit;
}

// 12.5. REMOVER DO PERFIL
if ($action === 'remove_top_movie') {
    $userId = getUserId();
    $movieId = $_POST['movie_id'] ?? $_POST['movieId'] ?? '';
    $mediaType = $_POST['media_type'] ?? 'movie';

    if (empty($movieId)) {
        echo json_encode(['success' => false, 'message' => 'ID do filme inválido.']);
        exit;
    }

    // Normaliza para composite ID
    $compositeId = normalizeMovieId($movieId, $mediaType);

    $stmt = $pdo->prepare("DELETE FROM top_movies WHERE user_id = ? AND movie_id = ?");
    $stmt->execute([$userId, $compositeId]);
    
    echo json_encode(['success' => true, 'message' => 'Removido do perfil.']);
    exit;
}

// 12.9 ADICIONAR / REMOVER ESPECIFICANDO SLOT
if ($action === 'toggle_top_movie') {
    $userId = getUserId();
    $movieId = $_POST['movie_id'] ?? $_POST['movieId'] ?? '';
    $mediaType = $_POST['media_type'] ?? 'movie';
    $slotPosition = (int)($_POST['slot_position'] ?? $_POST['slot'] ?? 1);
    $title = $_POST['title'] ?? 'Sem Título';
    $poster_url = $_POST['poster_path'] ?? $_POST['poster_url'] ?? '';

    if (empty($movieId)) {
        echo json_encode(['success' => false, 'message' => 'ID do filme inválido.']);
        exit;
    }

    // Normaliza para composite ID
    $compositeId = normalizeMovieId($movieId, $mediaType);
    $parsed = parseMovieId($compositeId);

    $stmt = $pdo->prepare("SELECT id FROM top_movies WHERE user_id = ? AND movie_id = ?");
    $stmt->execute([$userId, $compositeId]);
    $exists = $stmt->fetch();

    if ($exists) {
        $stmt = $pdo->prepare("DELETE FROM top_movies WHERE user_id = ? AND movie_id = ?");
        $stmt->execute([$userId, $compositeId]);
        echo json_encode(['success' => true, 'added' => false, 'message' => 'Removido do seu perfil.']);
    } else {
        $stmt = $pdo->prepare("DELETE FROM top_movies WHERE user_id = ? AND slot_position = ?");
        $stmt->execute([$userId, $slotPosition]);

        $stmt = $pdo->prepare("INSERT INTO top_movies (user_id, movie_id, slot_position, title, poster_url, media_type) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$userId, $compositeId, $slotPosition, $title, $poster_url, $parsed['type']]);
        echo json_encode(['success' => true, 'added' => true, 'message' => 'Adicionado ao seu perfil.']);
    }
    exit;
}

// 12.10 LIMPAR TODO O PERFIL
if ($action === 'clear_profile') {
    $userId = getUserId();
    
    $stmt = $pdo->prepare("DELETE FROM top_movies WHERE user_id = ?");
    $stmt->execute([$userId]);
    
    echo json_encode(['success' => true, 'message' => 'Perfil limpo com sucesso. Todos os filmes foram removidos.']);
    exit;
}

// 13. PERSONAGEM FAVORITO
if ($action === 'save_character') {
    $userId = getUserId();
    $slotPosition = (int)($_POST['slot_position'] ?? 0);
    $name = trim($_POST['name'] ?? '');
    $work = trim($_POST['work'] ?? '');

    if (empty($name)) {
        echo json_encode(['success' => false, 'message' => 'Dê um nome ao personagem.']);
        exit;
    }

    $uploadResult = validateAndUploadFile('char_image', 'char', $userId);
    $image_url = $uploadResult ? $uploadResult['url'] : null;

    $stmt = $pdo->prepare("SELECT id, image_url FROM top_characters WHERE user_id = ? AND slot_position = ?");
    $stmt->execute([$userId, $slotPosition]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($existing) {
        if ($image_url === null) {
            $image_url = $existing['image_url'];
        }
        $stmt = $pdo->prepare("UPDATE top_characters SET character_name = ?, work_origin = ?, image_url = ? WHERE user_id = ? AND slot_position = ?");
        $stmt->execute([$name, $work, $image_url, $userId, $slotPosition]);
    } else {
        $stmt = $pdo->prepare("INSERT INTO top_characters (user_id, slot_position, character_name, work_origin, image_url) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$userId, $slotPosition, $name, $work, $image_url]);
    }

    echo json_encode(['success' => true, 'message' => 'Personagem salvo com sucesso.', 'image' => $image_url]);
    exit;
}

// 14. REMOVER PERSONAGEM
if ($action === 'delete_character') {
    $userId = getUserId();
    $slotPosition = (int)($_POST['slot_position'] ?? 0);

    $stmt = $pdo->prepare("DELETE FROM top_characters WHERE user_id = ? AND slot_position = ?");
    $stmt->execute([$userId, $slotPosition]);
    echo json_encode(['success' => true, 'message' => 'Personagem removido.']);
    exit;
}

// 15. CRÍTICAS
if ($action === 'add_review') {
    $userId = getUserId();
    $movieId = $_POST['movie_id'] ?? $_POST['movieId'] ?? '';
    $mediaType = $_POST['media_type'] ?? 'movie';
    $rating = (float)($_POST['rating'] ?? 0);
    $title = trim($_POST['title'] ?? '');
    $text = trim($_POST['text'] ?? '');

    if (empty($movieId) || empty($title) || empty($text)) {
        echo json_encode(['success' => false, 'message' => 'Preencha todos os campos da crítica.']);
        exit;
    }

    // Normaliza para composite ID
    $compositeId = normalizeMovieId($movieId, $mediaType);

    $stmt = $pdo->prepare("INSERT INTO reviews (user_id, movie_id, rating, title, review_text) VALUES (?, ?, ?, ?, ?)");
    if ($stmt->execute([$userId, $compositeId, $rating, $title, $text])) {
        echo json_encode(['success' => true, 'message' => 'Crítica publicada com sucesso.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Erro ao publicar crítica.']);
    }
    exit;
}

if ($action === 'update_review') {
    $userId = getUserId();
    $reviewId = $_POST['id'] ?? '';
    $rating = (float)($_POST['rating'] ?? 0);
    $title = trim($_POST['title'] ?? '');
    $text = trim($_POST['text'] ?? '');

    if (empty($reviewId) || empty($title) || empty($text)) {
        echo json_encode(['success' => false, 'message' => 'Preencha todos os campos.']);
        exit;
    }

    $stmt = $pdo->prepare("UPDATE reviews SET rating = ?, title = ?, review_text = ? WHERE id = ? AND user_id = ?");
    if ($stmt->execute([$rating, $title, $text, $reviewId, $userId])) {
        echo json_encode(['success' => true, 'message' => 'Crítica atualizada com sucesso.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Erro ao atualizar crítica.']);
    }
    exit;
}

if ($action === 'delete_review') {
    $userId = getUserId();
    $reviewId = $_POST['id'] ?? '';

    $stmt = $pdo->prepare("DELETE FROM reviews WHERE id = ? AND user_id = ?");
    if ($stmt->execute([$reviewId, $userId])) {
        echo json_encode(['success' => true, 'message' => 'Crítica excluída com sucesso.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Erro ao excluir crítica.']);
    }
    exit;
}

if ($action === 'get_movie_reviews') {
    $movieId = $_GET['movie_id'] ?? $_GET['movieId'] ?? '';
    if (empty($movieId)) {
        echo json_encode(['success' => false, 'message' => 'ID do filme inválido.']);
        exit;
    }

    $stmt = $pdo->prepare("
        SELECT r.id, r.movie_id, r.rating, r.title, r.review_text as text, r.created_at as date, u.username 
        FROM reviews r 
        JOIN users u ON r.user_id = u.id 
        WHERE r.movie_id = ? 
        ORDER BY r.id DESC
    ");
    $stmt->execute([$movieId]);
    $reviews = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'reviews' => $reviews]);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Ação inválida no servidor.']);
exit;