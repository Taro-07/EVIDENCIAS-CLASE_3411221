<?php

// Indica al navegador que la respuesta será JSON codificado en UTF-8
header("Content-Type: application/json; charset=utf-8");

// Verifica que la solicitud de cierre de sesión llegue por método POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    // Responde con estado 405 (Método no permitido)
    http_response_code(405);
    // Envía respuesta JSON con el motivo del error
    echo json_encode([
        "success" => false,
        "mensaje" => "Método HTTP no permitido"
    ]);
    // Detiene la ejecución del script
    exit;
}

// Reanuda la sesión actual para poder limpiarla y destruirla
session_start();
// Vacía todas las variables almacenadas en el arreglo $_SESSION
$_SESSION = [];

// Comprueba si PHP utiliza cookies para identificar la sesión
if (ini_get("session.use_cookies")) {
    // Obtiene los parámetros actuales de la cookie de sesión (ruta, dominio, etc.)
    $params = session_get_cookie_params();

    // Sobrescribe la cookie de sesión con una fecha expirada en el pasado para eliminarla del navegador
    setcookie(
        session_name(),
        '',
        time() - 42000,
        $params["path"],
        $params["domain"],
        $params["secure"],
        $params["httponly"]
    );
}

// Destruye por completo la sesión en el servidor
session_destroy();

// Devuelve una respuesta JSON confirmando el cierre de sesión
echo json_encode([
    "success" => true,
    "mensaje" => "Sesión cerrada correctamente"
]);
