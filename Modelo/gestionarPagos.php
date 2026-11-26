<?php
// Inicia la sesión PHP para comprobar identidad y permisos del usuario
session_start();
// Configura la respuesta HTTP como JSON en UTF-8
header("Content-Type: application/json; charset=utf-8");

// Importa el modelo Pago
require_once __DIR__ . "/pago.php";

// Lee y decodifica el cuerpo JSON recibido en la solicitud
function leerDatosJson()
{
    $datos = json_decode(file_get_contents("php://input"), true);
    if (!is_array($datos) || json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        throw new Exception("Datos inválidos");
    }
    return $datos;
}

// Valida que un identificador (idPago o idPrestamo) sea un entero mayor o igual a 1
function validarIdEntero($id, $etiqueta)
{
    $idValido = filter_var($id, FILTER_VALIDATE_INT, ["options" => ["min_range" => 1]]);
    if ($idValido === false) {
        http_response_code(400);
        throw new Exception("El identificador de {$etiqueta} no es válido");
    }
    return $idValido;
}

// Valida los campos propios de la tabla pagos_cuotas (ValorCuota, FechaPago, idPrestamo)
function validarDatosPago($datos, Pago $modelo)
{
    $valorCuota = $datos["ValorCuota"] ?? null;
    $fechaPago = trim((string)($datos["FechaPago"] ?? ""));
    // Valida que idPrestamo sea un entero positivo
    $idPrestamo = validarIdEntero($datos["idPrestamo"] ?? null, "préstamo");

    // Verifica que ValorCuota sea un número mayor que cero
    if ($valorCuota === null || $valorCuota === "" || !is_numeric($valorCuota) || (float)$valorCuota <= 0) {
        http_response_code(400);
        throw new Exception("Ingresa un valor de cuota válido mayor a 0");
    }

    // Verifica que se haya seleccionado una fecha de pago
    if ($fechaPago === "") {
        http_response_code(400);
        throw new Exception("Ingresa una fecha de pago válida");
    }

    // Comprueba en la base de datos que el préstamo exista antes de guardar la clave foránea
    if (!$modelo->existePrestamo($idPrestamo)) {
        http_response_code(404);
        throw new Exception("No existe un préstamo registrado con el ID " . $idPrestamo);
    }

    // Retorna el arreglo validado y redondeado a 2 decimales
    return [
        "ValorCuota" => round((float)$valorCuota, 2),
        "FechaPago" => $fechaPago,
        "idPrestamo" => $idPrestamo
    ];
}

try {
    // Exige sesión iniciada
    if (!isset($_SESSION["documento"], $_SESSION["rol"])) {
        http_response_code(401);
        throw new Exception("Inicia sesión para consultar los pagos");
    }

    // Obtiene el rol del usuario en minúsculas y el método HTTP
    $rolSesion = strtolower((string)$_SESSION["rol"]);
    $metodo = $_SERVER["REQUEST_METHOD"];

    // Verifica que el método HTTP esté permitido
    if (!in_array($metodo, ["GET", "POST", "PUT", "DELETE"], true)) {
        http_response_code(405);
        throw new Exception("Método HTTP no permitido");
    }

    // El administrador solo visualiza la lista de pagos (GET); el asociado consulta (GET) y registra sus propios pagos (POST)
    if ($rolSesion === "admin" && $metodo !== "GET") {
        http_response_code(403);
        throw new Exception("El administrador solo puede visualizar la lista de pagos registrados");
    }

    if (in_array($metodo, ["PUT", "DELETE"], true)) {
        http_response_code(403);
        throw new Exception("No tienes permisos para realizar esta acción");
    }

    // Crea la instancia del modelo Pago
    $pago = new Pago();

    // Atiende la petición según el método HTTP
    switch ($metodo) {
        // GET: Admin ve todos los pagos; Asociado ve sus comprobantes y el saldo pendiente de cada préstamo propio
        case "GET":
            if ($rolSesion === "admin") {
                echo json_encode([
                    "success" => true,
                    "rol" => $rolSesion,
                    "pagos" => $pago->obtenerTodos(),
                    "prestamos" => $pago->obtenerPrestamosDisponibles()
                ], JSON_UNESCAPED_UNICODE);
            } else {
                echo json_encode([
                    "success" => true,
                    "rol" => $rolSesion,
                    "pagos" => $pago->obtenerPorDocumento($_SESSION["documento"]),
                    "prestamos" => $pago->obtenerPrestamosConSaldoPorDocumento($_SESSION["documento"])
                ], JSON_UNESCAPED_UNICODE);
            }
            break;

        // POST: registra un nuevo pago de cuota (el asociado solo puede abonar a sus propios préstamos)
        case "POST":
            $validados = validarDatosPago(leerDatosJson(), $pago);
            if ($rolSesion !== "admin" && !$pago->prestamoPerteneceADocumento($validados["idPrestamo"], $_SESSION["documento"])) {
                http_response_code(403);
                throw new Exception("Solo puedes registrar pagos en tus propios préstamos");
            }
            if (!$pago->guardar($validados)) {
                http_response_code(500);
                throw new Exception("Error al registrar el pago");
            }

            http_response_code(201);
            echo json_encode([
                "success" => true,
                "mensaje" => "Comprobante de pago registrado con éxito"
            ], JSON_UNESCAPED_UNICODE);
            break;

        // PUT: actualiza un pago existente identificado por idPago
        case "PUT":
            $datos = leerDatosJson();
            $idPago = validarIdEntero($datos["idPago"] ?? null, "pago");
            $validados = validarDatosPago($datos, $pago);
            $validados["idPago"] = $idPago;

            if (!$pago->editar($validados)) {
                http_response_code(404);
                throw new Exception("No se encontró el pago");
            }

            http_response_code(200);
            echo json_encode([
                "success" => true,
                "mensaje" => "Pago actualizado correctamente"
            ], JSON_UNESCAPED_UNICODE);
            break;

        // DELETE: elimina un pago de cuota según su idPago
        case "DELETE":
            $datos = leerDatosJson();
            $idPago = validarIdEntero($datos["idPago"] ?? null, "pago");

            if (!$pago->eliminar($idPago)) {
                http_response_code(404);
                throw new Exception("No se encontró el pago");
            }

            http_response_code(200);
            echo json_encode([
                "success" => true,
                "mensaje" => "Pago eliminado correctamente"
            ], JSON_UNESCAPED_UNICODE);
            break;
    }
// Maneja errores de base de datos PDO
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "mensaje" => "Error en la base de datos: " . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
// Maneja errores de validación, sesión o permisos
} catch (Exception $e) {
    if (http_response_code() === 200) {
        http_response_code(400);
    }
    echo json_encode([
        "success" => false,
        "mensaje" => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
