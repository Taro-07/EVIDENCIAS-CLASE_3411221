<?php
// Reanuda la sesión PHP para verificar autenticación y rol administrador
session_start();
// Responde siempre en formato JSON UTF-8
header("Content-Type: application/json; charset=utf-8");

// Importa el modelo Reporte
require_once __DIR__ . "/reporte.php";

try {
    // Solo admite consultas GET
    if ($_SERVER["REQUEST_METHOD"] !== "GET") {
        http_response_code(405);
        throw new Exception("Método HTTP no permitido");
    }

    // Exige sesión iniciada
    if (!isset($_SESSION["documento"], $_SESSION["rol"])) {
        http_response_code(401);
        throw new Exception("Inicia sesión para consultar los reportes");
    }

    // Restringe los reportes financieros globales exclusivamente al rol Admin
    $rolSesion = strtolower((string)$_SESSION["rol"]);
    if ($rolSesion !== "admin") {
        http_response_code(403);
        throw new Exception("Solo los administradores pueden acceder a los reportes financieros");
    }

    // Genera el resumen global, la cartera por asociado y el balance de actividades
    $reporte = new Reporte();
    echo json_encode([
        "success" => true,
        "rol" => $rolSesion,
        "resumen" => $reporte->obtenerResumenGlobal(),
        "cartera" => $reporte->obtenerCarteraPorAsociado(),
        "actividades" => $reporte->obtenerBalanceActividades()
    ], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "mensaje" => "Error en la base de datos: " . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    if (http_response_code() === 200) {
        http_response_code(400);
    }
    echo json_encode([
        "success" => false,
        "mensaje" => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
