<?php
// Reanuda la sesión PHP para identificar al asociado autenticado
session_start();
// Responde en formato JSON UTF-8
header("Content-Type: application/json; charset=utf-8");

// Importa la conexión PDO
require_once __DIR__ . '/../Config/conexion.php';

// Garantiza que existan las columnas fotoPerfil y saldoBilletera en la tabla asociados sin alterar datos previos
function asegurarColumnaFotoPerfil(PDO $conexion)
{
    $consulta = $conexion->prepare(
        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'asociados'
           AND COLUMN_NAME = 'fotoPerfil'"
    );
    $consulta->execute();
    if ((int)$consulta->fetchColumn() === 0) {
        $conexion->exec("ALTER TABLE asociados ADD COLUMN fotoPerfil VARCHAR(255) DEFAULT NULL");
    }

    $consultaSaldo = $conexion->prepare(
        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'asociados'
           AND COLUMN_NAME = 'saldoBilletera'"
    );
    $consultaSaldo->execute();
    if ((int)$consultaSaldo->fetchColumn() === 0) {
        $conexion->exec("ALTER TABLE asociados ADD COLUMN saldoBilletera DECIMAL(14,2) NOT NULL DEFAULT 0.00");
    }
}

// Elimina de disco una foto anterior guardada dentro de Assets/img/perfiles/
function eliminarArchivoFotoAnterior(?string $rutaRelativa)
{
    if (!$rutaRelativa) {
        return;
    }
    $nombreArchivo = basename($rutaRelativa);
    $rutaAbsoluta = __DIR__ . '/../Assets/img/perfiles/' . $nombreArchivo;
    if (is_file($rutaAbsoluta)) {
        @unlink($rutaAbsoluta);
    }
}

try {
    // Exige sesión activa
    if (!isset($_SESSION["documento"], $_SESSION["rol"])) {
        http_response_code(401);
        throw new Exception("Inicia sesión para gestionar tu perfil");
    }

    $documento = $_SESSION["documento"];
    $rol = strtolower((string)$_SESSION["rol"]);
    $metodo = $_SERVER["REQUEST_METHOD"];

    $conexion = (new Conexion())->conectar();
    asegurarColumnaFotoPerfil($conexion);

    // Obtiene los datos actuales del usuario autenticado
    $stmtUser = $conexion->prepare(
        "SELECT idAsociado, documento, nombres, apellidos, fotoPerfil, saldoBilletera, rol
         FROM asociados
         WHERE documento = :documento
         LIMIT 1"
    );
    $stmtUser->execute([":documento" => $documento]);
    $usuario = $stmtUser->fetch();

    if (!$usuario) {
        http_response_code(404);
        throw new Exception("No se encontró el usuario en la base de datos");
    }

    switch ($metodo) {
        // GET: devuelve perfil, foto actual, resumen de cuotas pendientes e historial de pagos pendientes del Asociado
        case "GET":
            $idAsociado = (int)$usuario["idAsociado"];

            // Consulta cada préstamo del asociado con sus cuotas pagadas y monto abonado para calcular cuotas pendientes
            $stmtDetalle = $conexion->prepare(
                "SELECT p.idPrestamos,
                        p.ValorPrestamo,
                        p.TasaInteres,
                        p.NumeroCuotas,
                        p.FechaPrestamo,
                        COUNT(pc.idPago) AS cuotasPagadas,
                        COALESCE(SUM(pc.ValorCuota), 0) AS totalAbonado
                 FROM prestamos p
                 LEFT JOIN pagos_cuotas pc ON pc.idPrestamo = p.idPrestamos
                 WHERE p.idAsociado = :idAsociado
                 GROUP BY p.idPrestamos, p.ValorPrestamo, p.TasaInteres, p.NumeroCuotas, p.FechaPrestamo
                 ORDER BY p.idPrestamos DESC"
            );
            $stmtDetalle->execute([":idAsociado" => $idAsociado]);
            $creditos = $stmtDetalle->fetchAll();

            $totalPrestado = 0.0;
            $totalPagado = 0.0;
            $totalCuotas = 0;
            $cuotasPagadasTotal = 0;
            $cuotasPendientesTotal = 0;
            $creditosActivos = 0;
            $pagosPendientes = [];

            foreach ($creditos as $credito) {
                $valor = (float)($credito["ValorPrestamo"] ?? 0);
                $abonado = (float)($credito["totalAbonado"] ?? 0);
                $numCuotas = max(0, (int)($credito["NumeroCuotas"] ?? 0));
                $pagadas = (int)($credito["cuotasPagadas"] ?? 0);
                $saldo = max(0, $valor - $abonado);
                $pendientes = $saldo > 0 ? max(1, $numCuotas - $pagadas) : 0;
                $valorCuotaAprox = $numCuotas > 0 ? round($valor / $numCuotas, 2) : round($saldo, 2);

                $totalPrestado += $valor;
                $totalPagado += $abonado;
                $totalCuotas += $numCuotas;
                $cuotasPagadasTotal += $pagadas;

                if ($saldo > 0) {
                    $creditosActivos++;
                    $cuotasPendientesTotal += $pendientes;
                    $pagosPendientes[] = [
                        "idPrestamos" => (int)$credito["idPrestamos"],
                        "fechaPrestamo" => $credito["FechaPrestamo"],
                        "valorPrestamo" => round($valor, 2),
                        "totalAbonado" => round($abonado, 2),
                        "saldoPendiente" => round($saldo, 2),
                        "numeroCuotas" => $numCuotas,
                        "cuotasPagadas" => $pagadas,
                        "cuotasPendientes" => $pendientes,
                        "valorCuotaAprox" => $valorCuotaAprox
                    ];
                }
            }

            $saldoPendiente = max(0, $totalPrestado - $totalPagado);

            // Verifica que la foto guardada aún exista en disco
            $fotoValida = null;
            if (!empty($usuario["fotoPerfil"])) {
                $archivo = basename($usuario["fotoPerfil"]);
                if (is_file(__DIR__ . '/../Assets/img/perfiles/' . $archivo)) {
                    $fotoValida = "../Assets/img/perfiles/" . $archivo;
                }
            }

            echo json_encode([
                "success" => true,
                "rol" => $rol,
                "documento" => $usuario["documento"],
                "nombre" => trim(($usuario["nombres"] ?? "") . " " . ($usuario["apellidos"] ?? "")),
                "fotoPerfil" => $fotoValida,
                "saldoBilletera" => round((float)($usuario["saldoBilletera"] ?? 0), 2),
                "resumen" => [
                    "totalCreditos" => count($creditos),
                    "creditosActivos" => $creditosActivos,
                    "totalCuotas" => $totalCuotas,
                    "cuotasPagadas" => $cuotasPagadasTotal,
                    "cuotasPendientes" => $cuotasPendientesTotal,
                    "totalPrestado" => round($totalPrestado, 2),
                    "totalPagado" => round($totalPagado, 2),
                    "saldoPendiente" => round($saldoPendiente, 2)
                ],
                "pagosPendientes" => $pagosPendientes
            ], JSON_UNESCAPED_UNICODE);
            break;

        // POST: recibe una imagen subida por el usuario, la valida, guarda en Assets/img/perfiles y actualiza la BD
        case "POST":
            if (!isset($_FILES["foto"]) || $_FILES["foto"]["error"] !== UPLOAD_ERR_OK) {
                http_response_code(400);
                throw new Exception("Selecciona una imagen válida para tu foto de perfil");
            }

            $archivo = $_FILES["foto"];
            // Límite de 2 MB
            if ($archivo["size"] > 2 * 1024 * 1024) {
                http_response_code(400);
                throw new Exception("La imagen supera el tamaño máximo permitido (2 MB)");
            }

            // Valida el tipo MIME real del archivo
            $finfo = new finfo(FILEINFO_MIME_TYPE);
            $mime = $finfo->file($archivo["tmp_name"]);
            $extensiones = [
                "image/jpeg" => "jpg",
                "image/png" => "png",
                "image/webp" => "webp",
                "image/gif" => "gif"
            ];

            if (!isset($extensiones[$mime])) {
                http_response_code(400);
                throw new Exception("Formato no permitido. Usa JPG, PNG, WEBP o GIF");
            }

            // Crea la carpeta Assets/img/perfiles si no existe
            $directorio = __DIR__ . '/../Assets/img/perfiles';
            if (!is_dir($directorio) && !mkdir($directorio, 0775, true)) {
                http_response_code(500);
                throw new Exception("No se pudo crear la carpeta de imágenes de perfil");
            }

            $nombreArchivo = "asociado_" . preg_replace('/[^0-9A-Za-z]/', '', (string)$documento) . "_" . time() . "." . $extensiones[$mime];
            $destino = $directorio . '/' . $nombreArchivo;

            if (!move_uploaded_file($archivo["tmp_name"], $destino)) {
                http_response_code(500);
                throw new Exception("No fue posible guardar la imagen en el servidor");
            }

            // Borra la foto anterior si existía
            eliminarArchivoFotoAnterior($usuario["fotoPerfil"] ?? null);

            $rutaRelativa = "../Assets/img/perfiles/" . $nombreArchivo;
            $upd = $conexion->prepare("UPDATE asociados SET fotoPerfil = :foto WHERE documento = :documento");
            $upd->execute([":foto" => $rutaRelativa, ":documento" => $documento]);

            echo json_encode([
                "success" => true,
                "mensaje" => "Foto de perfil actualizada correctamente",
                "fotoPerfil" => $rutaRelativa
            ], JSON_UNESCAPED_UNICODE);
            break;

        // DELETE: quita la foto subida para volver al avatar con la inicial del nombre
        case "DELETE":
            eliminarArchivoFotoAnterior($usuario["fotoPerfil"] ?? null);
            $upd = $conexion->prepare("UPDATE asociados SET fotoPerfil = NULL WHERE documento = :documento");
            $upd->execute([":documento" => $documento]);

            echo json_encode([
                "success" => true,
                "mensaje" => "Se activó el avatar con la inicial de tu nombre",
                "fotoPerfil" => null
            ], JSON_UNESCAPED_UNICODE);
            break;

        default:
            http_response_code(405);
            throw new Exception("Método HTTP no permitido");
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
