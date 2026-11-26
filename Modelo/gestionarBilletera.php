<?php
// Reanuda la sesión PHP para autenticar al asociado y conocer su documento
session_start();
// Responde siempre en JSON UTF-8
header("Content-Type: application/json; charset=utf-8");

// Importa la conexión PDO a la base de datos mr_club
require_once __DIR__ . '/../Config/conexion.php';

// Garantiza que la tabla asociados tenga la columna saldoBilletera sin afectar datos previos
function asegurarEstructuraBilletera(PDO $conexion)
{
    // Consulta INFORMATION_SCHEMA para verificar si existe la columna saldoBilletera en asociados
    $consultaCol = $conexion->prepare(
        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'asociados'
           AND COLUMN_NAME = 'saldoBilletera'"
    );
    // Ejecuta la verificación de existencia de la columna
    $consultaCol->execute();
    // Si no existe la columna, la agrega con valor inicial 0.00
    if ((int)$consultaCol->fetchColumn() === 0) {
        $conexion->exec("ALTER TABLE asociados ADD COLUMN saldoBilletera DECIMAL(14,2) NOT NULL DEFAULT 0.00");
    }

    // Crea la tabla de historial de movimientos de billetera si aún no existe
    $conexion->exec(
        "CREATE TABLE IF NOT EXISTS movimientos_billetera (
            idMovimiento INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            idAsociado INT UNSIGNED NOT NULL,
            tipo ENUM('recarga', 'retiro') NOT NULL,
            monto DECIMAL(14,2) NOT NULL,
            descripcion VARCHAR(255) DEFAULT NULL,
            saldoResultante DECIMAL(14,2) NOT NULL,
            fechaMovimiento DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_mov_asociado_fecha (idAsociado, fechaMovimiento),
            CONSTRAINT fk_mov_billetera_asociado
                FOREIGN KEY (idAsociado) REFERENCES asociados(idAsociado)
                ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
}

// Consulta el saldo actual, totales acumulados y últimos 50 movimientos del asociado
function obtenerResumenBilletera(PDO $conexion, int $idAsociado)
{
    // Obtiene datos básicos del asociado y su saldo actual de billetera
    $stmtSaldo = $conexion->prepare(
        "SELECT documento, nombres, apellidos, saldoBilletera
         FROM asociados
         WHERE idAsociado = :idAsociado
         LIMIT 1"
    );
    $stmtSaldo->execute([":idAsociado" => $idAsociado]);
    $asociado = $stmtSaldo->fetch();

    // Calcula sumatorias históricas de recargas, retiros y total de movimientos registrados
    $stmtTotales = $conexion->prepare(
        "SELECT
            COALESCE(SUM(CASE WHEN tipo = 'recarga' THEN monto ELSE 0 END), 0) AS totalRecargado,
            COALESCE(SUM(CASE WHEN tipo = 'retiro' THEN monto ELSE 0 END), 0) AS totalRetirado,
            COUNT(*) AS cantidadMovimientos
         FROM movimientos_billetera
         WHERE idAsociado = :idAsociado"
    );
    $stmtTotales->execute([":idAsociado" => $idAsociado]);
    $totales = $stmtTotales->fetch();

    // Consulta los 50 movimientos más recientes del asociado ordenados del más nuevo al más antiguo
    $stmtMovs = $conexion->prepare(
        "SELECT idMovimiento, tipo, monto, descripcion, saldoResultante, fechaMovimiento
         FROM movimientos_billetera
         WHERE idAsociado = :idAsociado
         ORDER BY idMovimiento DESC
         LIMIT 50"
    );
    $stmtMovs->execute([":idAsociado" => $idAsociado]);
    $movimientos = $stmtMovs->fetchAll();

    // Retorna el resumen consolidado con valores numéricos normalizados a 2 decimales y la lista de movimientos
    return [
        "documento" => $asociado["documento"] ?? "",
        "nombre" => trim(($asociado["nombres"] ?? "") . " " . ($asociado["apellidos"] ?? "")),
        "saldoBilletera" => round((float)($asociado["saldoBilletera"] ?? 0), 2),
        "totalRecargado" => round((float)($totales["totalRecargado"] ?? 0), 2),
        "totalRetirado" => round((float)($totales["totalRetirado"] ?? 0), 2),
        "cantidadMovimientos" => (int)($totales["cantidadMovimientos"] ?? 0),
        "movimientos" => $movimientos
    ];
}

try {
    // Verifica que exista una sesión activa
    if (!isset($_SESSION["documento"], $_SESSION["rol"])) {
        http_response_code(401);
        throw new Exception("Inicia sesión para acceder a tu billetera");
    }

    // Obtiene el documento del usuario en sesión y el método HTTP de la solicitud
    $documento = $_SESSION["documento"];
    $metodo = $_SERVER["REQUEST_METHOD"];

    // Abre la conexión PDO y garantiza que existan la columna saldoBilletera y la tabla movimientos_billetera
    $conexion = (new Conexion())->conectar();
    asegurarEstructuraBilletera($conexion);

    // Localiza el idAsociado del usuario autenticado
    $stmtUser = $conexion->prepare(
        "SELECT idAsociado FROM asociados WHERE documento = :documento LIMIT 1"
    );
    $stmtUser->execute([":documento" => $documento]);
    $usuario = $stmtUser->fetch();

    // Si el asociado no existe en la tabla asociados, devuelve error 404
    if (!$usuario) {
        http_response_code(404);
        throw new Exception("No se encontró el asociado en la base de datos");
    }

    // Convierte el identificador del asociado a entero para las consultas posteriores
    $idAsociado = (int)$usuario["idAsociado"];

    // Despacha la operación según el método HTTP recibido
    switch ($metodo) {
        // GET: devuelve el monto total de la billetera y su historial de movimientos
        case "GET":
            // Consulta el resumen completo y lo serializa agregando success=true
            $resumen = obtenerResumenBilletera($conexion, $idAsociado);
            echo json_encode(array_merge(["success" => true], $resumen), JSON_UNESCAPED_UNICODE);
            break;

        // POST: procesa una recarga (añadir dinero) o un retiro de la billetera
        case "POST":
            // Decodifica el cuerpo JSON enviado por el cliente
            $datos = json_decode(file_get_contents("php://input"), true);
            if (!is_array($datos)) {
                http_response_code(400);
                throw new Exception("Los datos enviados no son válidos");
            }

            // Extrae y normaliza el tipo de movimiento, monto numérico y descripción opcional
            $tipo = strtolower(trim((string)($datos["tipo"] ?? "")));
            $monto = isset($datos["monto"]) ? (float)$datos["monto"] : 0;
            $descripcion = trim((string)($datos["descripcion"] ?? ""));

            // Valida que el tipo de operación sea estrictamente 'recarga' o 'retiro'
            if ($tipo !== "recarga" && $tipo !== "retiro") {
                http_response_code(400);
                throw new Exception("Tipo de movimiento inválido. Usa 'recarga' o 'retiro'");
            }

            // Valida que el monto sea un número finito y mayor a cero
            if (!is_finite($monto) || $monto <= 0) {
                http_response_code(400);
                throw new Exception("Ingresa un monto mayor a cero");
            }

            // Impone un tope máximo razonable por operación para prevenir desbordamientos
            if ($monto > 999999999) {
                http_response_code(400);
                throw new Exception("El monto ingresado supera el límite permitido");
            }

            // Recorta la descripción a un máximo de 255 caracteres respetando UTF-8
            if (mb_strlen($descripcion) > 255) {
                $descripcion = mb_substr($descripcion, 0, 255);
            }

            // Asigna una descripción predeterminada según el tipo si el usuario dejó el campo vacío
            if ($descripcion === "") {
                $descripcion = $tipo === "recarga" ? "Recarga a billetera" : "Retiro desde billetera";
            }

            // Ejecuta la actualización de saldo y registro del movimiento dentro de una transacción
            $conexion->beginTransaction();
            try {
                // Bloquea la fila del asociado con FOR UPDATE para evitar inconsistencias por operaciones simultáneas
                $stmtLock = $conexion->prepare(
                    "SELECT saldoBilletera FROM asociados WHERE idAsociado = :idAsociado FOR UPDATE"
                );
                $stmtLock->execute([":idAsociado" => $idAsociado]);
                $saldoActual = round((float)$stmtLock->fetchColumn(), 2);

                // Si se trata de un retiro, valida que exista saldo suficiente antes de descontar
                if ($tipo === "retiro" && $monto > $saldoActual) {
                    $conexion->rollBack();
                    http_response_code(400);
                    throw new Exception("Saldo insuficiente en tu billetera para realizar este retiro");
                }

                // Calcula el nuevo saldo sumando en recargas o restando en retiros
                $nuevoSaldo = $tipo === "recarga"
                    ? round($saldoActual + $monto, 2)
                    : round($saldoActual - $monto, 2);

                // Actualiza el saldoBilletera en la tabla asociados
                $stmtUpd = $conexion->prepare(
                    "UPDATE asociados SET saldoBilletera = :saldo WHERE idAsociado = :idAsociado"
                );
                $stmtUpd->execute([
                    ":saldo" => $nuevoSaldo,
                    ":idAsociado" => $idAsociado
                ]);

                // Registra el movimiento en la tabla movimientos_billetera con el saldo resultante
                $stmtIns = $conexion->prepare(
                    "INSERT INTO movimientos_billetera (idAsociado, tipo, monto, descripcion, saldoResultante)
                     VALUES (:idAsociado, :tipo, :monto, :descripcion, :saldoResultante)"
                );
                $stmtIns->execute([
                    ":idAsociado" => $idAsociado,
                    ":tipo" => $tipo,
                    ":monto" => round($monto, 2),
                    ":descripcion" => $descripcion,
                    ":saldoResultante" => $nuevoSaldo
                ]);

                // Confirma la transacción completa en MySQL
                $conexion->commit();
            } catch (Exception $ex) {
                // Revierte la transacción ante cualquier error durante el movimiento
                if ($conexion->inTransaction()) {
                    $conexion->rollBack();
                }
                // Relanza la excepción para que la capture el manejador principal
                throw $ex;
            }

            // Consulta el resumen actualizado de la billetera y define el mensaje de confirmación
            $resumen = obtenerResumenBilletera($conexion, $idAsociado);
            $mensaje = $tipo === "recarga"
                ? "Dinero añadido a tu billetera correctamente."
                : "Retiro realizado correctamente.";

            // Envía la respuesta JSON combinando el estado de éxito, mensaje y resumen actualizado
            echo json_encode(
                array_merge(["success" => true, "mensaje" => $mensaje], $resumen),
                JSON_UNESCAPED_UNICODE
            );
            break;

        default:
            // Rechaza cualquier método HTTP distinto de GET o POST con HTTP 405
            http_response_code(405);
            throw new Exception("Método HTTP no permitido");
    }
} catch (PDOException $e) {
    // Maneja errores de base de datos devolviendo HTTP 500
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "mensaje" => "Error en la base de datos: " . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    // Cambia el código HTTP a 400 si aún estaba en 200
    if (http_response_code() === 200) {
        http_response_code(400);
    }
    // Responde con el detalle de la excepción en formato JSON UTF-8
    echo json_encode([
        "success" => false,
        "mensaje" => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
