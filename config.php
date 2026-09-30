<?php
// Configurações de Sessão e Banco de Dados
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$db_host = 'localhost';
$db_user = 'root';
$db_pass = '';
$db_name = 'cineaura';

$conn = new mysqli($db_host, $db_user, $db_pass, $db_name);

if ($conn->connect_error) {
    // Caso o banco não esteja rodando localmente, não trava o script
    $conn = null;
}

// Chave da API externa (Ex: TMDB caso utilize)
define('TMDB_API_KEY', 'SUA_CHAVE_API_TMDB');
?>