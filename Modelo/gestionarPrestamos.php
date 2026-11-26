<?php
// Reanuda la sesión PHP para verificar autenticación y permisos
session_start();
// Indica que todas las respuestas serán JSON en UTF-8
header("Content-Type: application/json; charset=utf-8");

// Importa el modelo Prestamo
require_once __DIR__ . "/prestamo.php";

// Lee el cuerpo JSON enviado por el navegador y lo convierte en arreglo asociativo
function leerDatosJson()
{
    $datos = json_decode(file_get_contents("php://input"), true);
    if (!is_array($datos) || json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        throw new Exception("Datos inválidos");
    }
    return $datos;
}

// Valida que el identificador del préstamo sea un número entero positivo
function validarIdPrestamo($id)
{
    $idValido = filter_var($id, FILTER_VALIDATE_INT, ["options" => ["min_range" => 1]]);
    if ($idValido === false) {
        http_response_code(400);
        throw new Exception("El identificador del préstamo no es válido");
    }
    return $idValido;
}

// Calcula automáticamente la tasa de interés mensual (%) según el valor del préstamo
function calcularTasaAutomatica(float $valor): float
{
    if ($valor <= 500000) {
        return 1.0;
    }
    if ($valor <= 2000000) {
        return 1.5;
    }
    if ($valor <= 5000000) {
        return 2.0;
    }
    if ($valor <= 10000000) {
        return 2.5;
    }
    return 3.0;
}

// Valida todos los datos requeridos para solicitar la creación o edición de un préstamo por el Asociado
function validarDatosPrestamoAsociado($datos, string $documento, Prestamo $modelo)
{
    $valor = $datos["ValorPrestamo"] ?? null;
    $cuotas = $datos["NumeroCuotas"] ?? null;
    $fecha = trim((string)($datos["FechaPrestamo"] ?? ""));
    $proposito = trim((string)($datos["Proposito"] ?? ""));

    $idAsociado = $modelo->buscarIdAsociadoPorDocumento($documento);
    if ($idAsociado === null) {
        http_response_code(404);
        throw new Exception("No se encontró tu registro de asociado en la base de datos");
    }

    if ($valor === null || $valor === "" || !is_numeric($valor) || (float)$valor <= 0) {
        http_response_code(400);
        throw new Exception("Ingresa un monto solicitado válido mayor a 0");
    }

    $cuotasVal = filter_var($cuotas, FILTER_VALIDATE_INT, ["options" => ["min_range" => 1, "max_range" => 72]]);
    if ($cuotasVal === false) {
        http_response_code(400);
        throw new Exception("El plazo debe estar entre 1 y 72 meses");
    }

    if ($fecha === "") {
        http_response_code(400);
        throw new Exception("Ingresa una fecha de solicitud válida");
    }

    $valorFloat = round((float)$valor, 2);
    $tasaAuto = calcularTasaAutomatica($valorFloat);

    return [
        "idAsociado" => $idAsociado,
        "ValorPrestamo" => $valorFloat,
        "NumeroCuotas" => $cuotasVal,
        "TasaInteres" => $tasaAuto,
        "FechaPrestamo" => $fecha,
        "Proposito" => $proposito !== "" ? substr($proposito, 0, 255) : null
    ];
}

try {
    // Verifica que el usuario tenga una sesión válida iniciada
    if (!isset($_SESSION["documento"], $_SESSION["rol"])) {
        http_response_code(401);
        throw new Exception("Inicia sesión para consultar los préstamos");
    }

    $rolSesion = strtolower((string)$_SESSION["rol"]);
    $metodo = $_SERVER["REQUEST_METHOD"];

    if (!in_array($metodo, ["GET", "POST", "PUT", "DELETE"], true)) {
        http_response_code(405);
        throw new Exception("Método HTTP no permitido");
    }

    $prestamo = new Prestamo();

    switch ($metodo) {
        // GET: Admin ve todas las solicitudes para aprobar; Asociado ve sus préstamos y su estado
        case "GET":
            if ($rolSesion === "admin") {
                echo json_encode([
                    "success" => true,
                    "rol" => $rolSesion,
                    "prestamos" => $prestamo->obtenerTodos()
                ], JSON_UNESCAPED_UNICODE);
            } else {
                echo json_encode([
                    "success" => true,
                    "rol" => $rolSesion,
                    "asociadoActual" => $prestamo->obtenerResumenAsociado($_SESSION["documento"]),
                    "prestamos" => $prestamo->obtenerPorDocumento($_SESSION["documento"])
                ], JSON_UNESCAPED_UNICODE);
            }
            break;

        // POST: Solo el Asociado crea solicitudes de préstamo (quedan pendientes de aprobación del Admin)
        case "POST":
            if ($rolSesion === "admin") {
                http_response_code(403);
                throw new Exception("El administrador solo puede aprobar solicitudes de préstamo enviadas por los asociados");
            }

            $datosEntrada = leerDatosJson();
            $validados = validarDatosPrestamoAsociado($datosEntrada, (string)$_SESSION["documento"], $prestamo);
            if (!$prestamo->guardarSolicitudCreacion($validados)) {
                http_response_code(500);
                throw new Exception("Error al registrar la solicitud de préstamo");
            }

            http_response_code(201);
            echo json_encode([
                "success" => true,
                "mensaje" => "Solicitud de préstamo enviada. Debes esperar a que el administrador la apruebe."
            ], JSON_UNESCAPED_UNICODE);
            break;

        // PUT: Admin aprueba solicitudes pendientes (accion = 'aprobar'); Asociado envía solicitud de edición
        case "PUT":
            $datos = leerDatosJson();
            $idPrestamos = validarIdPrestamo($datos["idPrestamos"] ?? null);

            if ($rolSesion === "admin") {
                $accion = strtolower(trim((string)($datos["accion"] ?? "")));
                if ($accion !== "aprobar") {
                    http_response_code(403);
                    throw new Exception("El administrador solo puede aceptar solicitudes de préstamo");
                }

                $resultadoAprobacion = $prestamo->aprobarSolicitud($idPrestamos);
                if (!$resultadoAprobacion["ok"]) {
                    http_response_code(400);
                    throw new Exception($resultadoAprobacion["mensaje"]);
                }

                http_response_code(200);
                echo json_encode([
                    "success" => true,
                    "mensaje" => $resultadoAprobacion["mensaje"]
                ], JSON_UNESCAPED_UNICODE);
                break;
            }

            // Rol Asociado: guarda solicitud de edición pendiente de aprobación del Admin
            $validados = validarDatosPrestamoAsociado($datos, (string)$_SESSION["documento"], $prestamo);
            if (!$prestamo->solicitarEdicionPropia($idPrestamos, (string)$_SESSION["documento"], $validados)) {
                http_response_code(404);
                throw new Exception("No se encontró el préstamo para solicitar su edición");
            }

            http_response_code(200);
            echo json_encode([
                "success" => true,
                "mensaje" => "Solicitud de edición enviada. Debes esperar a que el administrador apruebe el cambio."
            ], JSON_UNESCAPED_UNICODE);
            break;

        // DELETE: Solo el Asociado envía solicitud de eliminación (queda pendiente hasta que el Admin la apruebe)
        case "DELETE":
            if ($rolSesion === "admin") {
                http_response_code(403);
                throw new Exception("El administrador solo puede aprobar solicitudes enviadas por los asociados");
            }

            $datos = leerDatosJson();
            $idPrestamos = validarIdPrestamo($datos["idPrestamos"] ?? null);

            if (!$prestamo->solicitarEliminacionPropia($idPrestamos, (string)$_SESSION["documento"])) {
                http_response_code(404);
                throw new Exception("No se encontró el préstamo para solicitar su eliminación");
            }

            http_response_code(200);
            echo json_encode([
                "success" => true,
                "mensaje" => "Solicitud de eliminación enviada. Debes esperar a que el administrador apruebe la solicitud."
            ], JSON_UNESCAPED_UNICODE);
            break;
    }
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
