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
    // Lee el cuerpo crudo de la petición y lo decodifica como arreglo asociativo
    $datos = json_decode(file_get_contents("php://input"), true);
    // Comprueba que la decodificación produzca un arreglo y no haya error de sintaxis JSON
    if (!is_array($datos) || json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        throw new Exception("Datos inválidos");
    }
    // Retorna los datos decodificados
    return $datos;
}

// Valida que el identificador del préstamo sea un número entero positivo
function validarIdPrestamo($id)
{
    // Verifica que el ID sea un entero mayor o igual a 1
    $idValido = filter_var($id, FILTER_VALIDATE_INT, ["options" => ["min_range" => 1]]);
    // Lanza excepción HTTP 400 si el identificador es inválido
    if ($idValido === false) {
        http_response_code(400);
        throw new Exception("El identificador del préstamo no es válido");
    }
    // Retorna el ID validado como entero
    return $idValido;
}

// Calcula automáticamente la tasa de interés mensual (%) según el valor del préstamo
function calcularTasaAutomatica(float $valor): float
{
    // Hasta $500.000 aplica tasa del 1.0% mensual
    if ($valor <= 500000) {
        return 1.0;
    }
    // Hasta $2.000.000 aplica tasa del 1.5% mensual
    if ($valor <= 2000000) {
        return 1.5;
    }
    // Hasta $5.000.000 aplica tasa del 2.0% mensual
    if ($valor <= 5000000) {
        return 2.0;
    }
    // Hasta $10.000.000 aplica tasa del 2.5% mensual
    if ($valor <= 10000000) {
        return 2.5;
    }
    // Para montos superiores a $10.000.000 aplica tasa del 3.0% mensual
    return 3.0;
}

// Valida todos los datos requeridos para solicitar la creación o edición de un préstamo por el Asociado
function validarDatosPrestamoAsociado($datos, string $documento, Prestamo $modelo)
{
    // Extrae los campos del cuerpo JSON aplicando trim a cadenas de texto
    $valor = $datos["ValorPrestamo"] ?? null;
    $cuotas = $datos["NumeroCuotas"] ?? null;
    $fecha = trim((string)($datos["FechaPrestamo"] ?? ""));
    $proposito = trim((string)($datos["Proposito"] ?? ""));

    // Busca el idAsociado correspondiente al documento autenticado en sesión
    $idAsociado = $modelo->buscarIdAsociadoPorDocumento($documento);
    if ($idAsociado === null) {
        http_response_code(404);
        throw new Exception("No se encontró tu registro de asociado en la base de datos");
    }

    // Valida que el monto solicitado sea numérico y mayor a 0
    if ($valor === null || $valor === "" || !is_numeric($valor) || (float)$valor <= 0) {
        http_response_code(400);
        throw new Exception("Ingresa un monto solicitado válido mayor a 0");
    }

    // Valida que el número de cuotas sea un entero entre 1 y 72 meses
    $cuotasVal = filter_var($cuotas, FILTER_VALIDATE_INT, ["options" => ["min_range" => 1, "max_range" => 72]]);
    if ($cuotasVal === false) {
        http_response_code(400);
        throw new Exception("El plazo debe estar entre 1 y 72 meses");
    }

    // Comprueba que se haya suministrado una fecha de solicitud
    if ($fecha === "") {
        http_response_code(400);
        throw new Exception("Ingresa una fecha de solicitud válida");
    }

    // Redondea el monto a 2 decimales y determina automáticamente la tasa de interés aplicable
    $valorFloat = round((float)$valor, 2);
    $tasaAuto = calcularTasaAutomatica($valorFloat);

    // Retorna el arreglo completo de datos validados (recortando propósito a 255 caracteres o null si está vacío)
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

    // Normaliza el rol a minúsculas y obtiene el verbo HTTP de la petición
    $rolSesion = strtolower((string)$_SESSION["rol"]);
    $metodo = $_SERVER["REQUEST_METHOD"];

    // Rechaza métodos HTTP distintos a GET, POST, PUT o DELETE
    if (!in_array($metodo, ["GET", "POST", "PUT", "DELETE"], true)) {
        http_response_code(405);
        throw new Exception("Método HTTP no permitido");
    }

    // Instancia el modelo Prestamo para interactuar con la base de datos
    $prestamo = new Prestamo();

    // Despacha la operación según el método HTTP
    switch ($metodo) {
        // GET: Admin ve todas las solicitudes para aprobar; Asociado ve sus préstamos y su estado
        case "GET":
            // Si es administrador, devuelve el listado completo de préstamos
            if ($rolSesion === "admin") {
                echo json_encode([
                    "success" => true,
                    "rol" => $rolSesion,
                    "prestamos" => $prestamo->obtenerTodos()
                ], JSON_UNESCAPED_UNICODE);
            } else {
                // Si es asociado, devuelve su resumen de datos y únicamente sus préstamos
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
            // Bloquea al administrador de crear solicitudes de préstamo directamente
            if ($rolSesion === "admin") {
                http_response_code(403);
                throw new Exception("El administrador solo puede aprobar solicitudes de préstamo enviadas por los asociados");
            }

            // Lee y valida los datos de la nueva solicitud del asociado
            $datosEntrada = leerDatosJson();
            $validados = validarDatosPrestamoAsociado($datosEntrada, (string)$_SESSION["documento"], $prestamo);
            // Guarda la solicitud en estado 'Pendiente' en la tabla prestamos
            if (!$prestamo->guardarSolicitudCreacion($validados)) {
                http_response_code(500);
                throw new Exception("Error al registrar la solicitud de préstamo");
            }

            // Responde con HTTP 201 (Created) informando que la solicitud espera aprobación
            http_response_code(201);
            echo json_encode([
                "success" => true,
                "mensaje" => "Solicitud de préstamo enviada. Debes esperar a que el administrador la apruebe."
            ], JSON_UNESCAPED_UNICODE);
            break;

        // PUT: Admin aprueba solicitudes pendientes (accion = 'aprobar'); Asociado envía solicitud de edición
        case "PUT":
            // Lee el cuerpo JSON y valida el ID del préstamo objetivo
            $datos = leerDatosJson();
            $idPrestamos = validarIdPrestamo($datos["idPrestamos"] ?? null);

            // Rama exclusiva del Administrador para aprobar solicitudes pendientes
            if ($rolSesion === "admin") {
                // Verifica que la acción enviada sea específicamente 'aprobar'
                $accion = strtolower(trim((string)($datos["accion"] ?? "")));
                if ($accion !== "aprobar") {
                    http_response_code(403);
                    throw new Exception("El administrador solo puede aceptar solicitudes de préstamo");
                }

                // Ejecuta la aprobación de creación, edición o eliminación en el modelo
                $resultadoAprobacion = $prestamo->aprobarSolicitud($idPrestamos);
                if (!$resultadoAprobacion["ok"]) {
                    http_response_code(400);
                    throw new Exception($resultadoAprobacion["mensaje"]);
                }

                // Responde con HTTP 200 y el mensaje de aprobación correspondiente
                http_response_code(200);
                echo json_encode([
                    "success" => true,
                    "mensaje" => $resultadoAprobacion["mensaje"]
                ], JSON_UNESCAPED_UNICODE);
                break;
            }

            // Rol Asociado: guarda solicitud de edición pendiente de aprobación del Admin
            $validados = validarDatosPrestamoAsociado($datos, (string)$_SESSION["documento"], $prestamo);
            // Registra los cambios propuestos verificando que el préstamo pertenezca al asociado
            if (!$prestamo->solicitarEdicionPropia($idPrestamos, (string)$_SESSION["documento"], $validados)) {
                http_response_code(404);
                throw new Exception("No se encontró el préstamo para solicitar su edición");
            }

            // Responde con HTTP 200 confirmando que la solicitud de edición quedó registrada
            http_response_code(200);
            echo json_encode([
                "success" => true,
                "mensaje" => "Solicitud de edición enviada. Debes esperar a que el administrador apruebe el cambio."
            ], JSON_UNESCAPED_UNICODE);
            break;

        // DELETE: Solo el Asociado envía solicitud de eliminación (queda pendiente hasta que el Admin la apruebe)
        case "DELETE":
            // Impide que el administrador elimine préstamos directamente sin una solicitud previa
            if ($rolSesion === "admin") {
                http_response_code(403);
                throw new Exception("El administrador solo puede aprobar solicitudes enviadas por los asociados");
            }

            // Lee el JSON recibido y valida el ID del préstamo a solicitar para eliminación
            $datos = leerDatosJson();
            $idPrestamos = validarIdPrestamo($datos["idPrestamos"] ?? null);

            // Marca la solicitud de eliminación validando propiedad del préstamo
            if (!$prestamo->solicitarEliminacionPropia($idPrestamos, (string)$_SESSION["documento"])) {
                http_response_code(404);
                throw new Exception("No se encontró el préstamo para solicitar su eliminación");
            }

            // Responde con HTTP 200 confirmando el registro de la solicitud de eliminación
            http_response_code(200);
            echo json_encode([
                "success" => true,
                "mensaje" => "Solicitud de eliminación enviada. Debes esperar a que el administrador apruebe la solicitud."
            ], JSON_UNESCAPED_UNICODE);
            break;
    }
} catch (PDOException $e) {
    // Maneja excepciones de base de datos respondiendo con HTTP 500
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "mensaje" => "Error en la base de datos: " . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    // Garantiza un código HTTP de error (400) si aún permanecía en 200
    if (http_response_code() === 200) {
        http_response_code(400);
    }
    // Envía la respuesta de error en JSON UTF-8
    echo json_encode([
        "success" => false,
        "mensaje" => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
