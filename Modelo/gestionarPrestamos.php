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

// Valida todos los datos requeridos para crear o actualizar una solicitud de préstamo
function validarDatosPrestamo($datos, Prestamo $modelo)
{
    // Extrae y limpia los campos recibidos
    $documento = trim((string)($datos["documento"] ?? ""));
    $valor = $datos["ValorPrestamo"] ?? null;
    $cuotas = $datos["NumeroCuotas"] ?? null;
    $tasa = $datos["TasaInteres"] ?? null;
    $fecha = trim((string)($datos["FechaPrestamo"] ?? ""));
    $proposito = trim((string)($datos["Proposito"] ?? ""));

    // Verifica que el documento contenga solo dígitos
    if ($documento === "" || !ctype_digit($documento)) {
        http_response_code(400);
        throw new Exception("Ingresa un documento de asociado válido");
    }

    // Busca el asociado por documento para obtener su clave foránea idAsociado
    $idAsociado = $modelo->buscarIdAsociadoPorDocumento($documento);
    if ($idAsociado === null) {
        http_response_code(404);
        throw new Exception("No existe un asociado registrado con el documento " . $documento);
    }

    // Verifica que el monto solicitado sea numérico y mayor a 0
    if ($valor === null || $valor === "" || !is_numeric($valor) || (float)$valor <= 0) {
        http_response_code(400);
        throw new Exception("Ingresa un monto solicitado válido mayor a 0");
    }

    // Verifica que el plazo esté entre 1 y 72 meses
    $cuotasVal = filter_var($cuotas, FILTER_VALIDATE_INT, ["options" => ["min_range" => 1, "max_range" => 72]]);
    if ($cuotasVal === false) {
        http_response_code(400);
        throw new Exception("El plazo debe estar entre 1 y 72 meses");
    }

    // Verifica que la tasa de interés sea un número mayor o igual a 0
    if ($tasa === null || $tasa === "" || !is_numeric($tasa) || (float)$tasa < 0) {
        http_response_code(400);
        throw new Exception("Ingresa una tasa de interés válida");
    }

    // Verifica que se haya ingresado una fecha de solicitud
    if ($fecha === "") {
        http_response_code(400);
        throw new Exception("Ingresa una fecha de solicitud válida");
    }

    // Devuelve los datos validados listos para guardarse en MySQL
    return [
        "idAsociado" => $idAsociado,
        "ValorPrestamo" => round((float)$valor, 2),
        "NumeroCuotas" => $cuotasVal,
        "TasaInteres" => round((float)$tasa, 2),
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

    // Normaliza el rol y lee el método HTTP
    $rolSesion = strtolower((string)$_SESSION["rol"]);
    $metodo = $_SERVER["REQUEST_METHOD"];

    // Rechaza métodos distintos de GET, POST, PUT y DELETE
    if (!in_array($metodo, ["GET", "POST", "PUT", "DELETE"], true)) {
        http_response_code(405);
        throw new Exception("Método HTTP no permitido");
    }

    // Solo los administradores pueden editar (PUT) préstamos; el asociado puede consultar, solicitar y cancelar los suyos
    if ($metodo === "PUT" && $rolSesion !== "admin") {
        http_response_code(403);
        throw new Exception("No tienes permisos para realizar esta acción");
    }

    // Instancia el modelo Prestamo
    $prestamo = new Prestamo();

    // Ejecuta la operación CRUD solicitada
    switch ($metodo) {
        // GET: Admin ve todos los préstamos; Asociado ve solo su historial de créditos y su resumen
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

        // POST: Admin crea para cualquier documento; Asociado solo puede solicitar para su propio documento
        case "POST":
            $datosEntrada = leerDatosJson();
            if ($rolSesion !== "admin") {
                $datosEntrada["documento"] = (string)$_SESSION["documento"];
            }
            $validados = validarDatosPrestamo($datosEntrada, $prestamo);
            if (!$prestamo->guardar($validados)) {
                http_response_code(500);
                throw new Exception("Error al registrar la solicitud de préstamo");
            }

            http_response_code(201);
            echo json_encode([
                "success" => true,
                "mensaje" => "Solicitud de préstamo registrada con éxito"
            ], JSON_UNESCAPED_UNICODE);
            break;

        // PUT: actualiza un préstamo existente por su idPrestamos (solo Admin)
        case "PUT":
            $datos = leerDatosJson();
            $idPrestamos = validarIdPrestamo($datos["idPrestamos"] ?? null);
            $validados = validarDatosPrestamo($datos, $prestamo);
            $validados["idPrestamos"] = $idPrestamos;

            if (!$prestamo->editar($validados)) {
                http_response_code(404);
                throw new Exception("No se encontró el préstamo");
            }

            http_response_code(200);
            echo json_encode([
                "success" => true,
                "mensaje" => "Préstamo actualizado correctamente"
            ], JSON_UNESCAPED_UNICODE);
            break;

        // DELETE: Admin elimina cualquier préstamo; Asociado solo puede eliminar sus propios préstamos
        case "DELETE":
            $datos = leerDatosJson();
            $idPrestamos = validarIdPrestamo($datos["idPrestamos"] ?? null);

            $eliminado = $rolSesion === "admin"
                ? $prestamo->eliminar($idPrestamos)
                : $prestamo->eliminarPropio($idPrestamos, $_SESSION["documento"]);

            if (!$eliminado) {
                http_response_code(404);
                throw new Exception("No se encontró el préstamo");
            }

            http_response_code(200);
            echo json_encode([
                "success" => true,
                "mensaje" => "Préstamo eliminado correctamente"
            ], JSON_UNESCAPED_UNICODE);
            break;
    }
// Captura errores de PDO (por ejemplo si el préstamo ya tiene pagos de cuotas asociados)
} catch (PDOException $e) {
    if ($e->getCode() == 23000) {
        http_response_code(409);
        echo json_encode([
            "success" => false,
            "mensaje" => "No se puede eliminar el préstamo porque tiene pagos de cuotas relacionados"
        ], JSON_UNESCAPED_UNICODE);
    } else {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "mensaje" => "Error en la base de datos: " . $e->getMessage()
        ], JSON_UNESCAPED_UNICODE);
    }
// Captura errores de validación, sesión o permisos
} catch (Exception $e) {
    if (http_response_code() === 200) {
        http_response_code(400);
    }
    echo json_encode([
        "success" => false,
        "mensaje" => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
