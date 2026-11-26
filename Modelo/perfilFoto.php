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
    // Verifica en INFORMATION_SCHEMA si existe la columna fotoPerfil en asociados
    $consulta = $conexion->prepare(
        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'asociados'
           AND COLUMN_NAME = 'fotoPerfil'"
    );
    $consulta->execute();
    // Si no existe la columna fotoPerfil, la agrega permitiendo NULL por defecto
    if ((int)$consulta->fetchColumn() === 0) {
        $conexion->exec("ALTER TABLE asociados ADD COLUMN fotoPerfil VARCHAR(255) DEFAULT NULL");
    }

    // Verifica en INFORMATION_SCHEMA si existe la columna saldoBilletera en asociados
    $consultaSaldo = $conexion->prepare(
        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'asociados'
           AND COLUMN_NAME = 'saldoBilletera'"
    );
    $consultaSaldo->execute();
    // Si falta la columna saldoBilletera, la crea inicializada en 0.00
    if ((int)$consultaSaldo->fetchColumn() === 0) {
        $conexion->exec("ALTER TABLE asociados ADD COLUMN saldoBilletera DECIMAL(14,2) NOT NULL DEFAULT 0.00");
    }
}

// Elimina de disco una foto anterior guardada dentro de Assets/img/perfiles/
function eliminarArchivoFotoAnterior(?string $rutaRelativa)
{
    // Si no hay ruta previa registrada, finaliza sin hacer nada
    if (!$rutaRelativa) {
        return;
    }
    // Obtiene solo el nombre de archivo para evitar ataques de directory traversal
    $nombreArchivo = basename($rutaRelativa);
    // Construye la ruta absoluta dentro de la carpeta de perfiles
    $rutaAbsoluta = __DIR__ . '/../Assets/img/perfiles/' . $nombreArchivo;
    // Si el archivo físico existe en disco, lo elimina silenciando advertencias
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

    // Recupera el documento, el rol normalizado a minúsculas y el verbo HTTP de la solicitud
    $documento = $_SESSION["documento"];
    $rol = strtolower((string)$_SESSION["rol"]);
    $metodo = $_SERVER["REQUEST_METHOD"];

    // Abre la conexión con la BD y garantiza las columnas fotoPerfil y saldoBilletera
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

    // Si no se encuentra el registro del asociado, responde con HTTP 404
    if (!$usuario) {
        http_response_code(404);
        throw new Exception("No se encontró el usuario en la base de datos");
    }

    // Ejecuta la acción correspondiente según el método HTTP
    switch ($metodo) {
        // GET: devuelve perfil, foto actual, resumen de cuotas pendientes e historial de pagos pendientes del Asociado
        case "GET":
            // Convierte a entero el ID del asociado para consultar sus créditos
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

            // Inicializa acumuladores financieros y la lista de préstamos con saldo pendiente
            $totalPrestado = 0.0;
            $totalPagado = 0.0;
            $totalCuotas = 0;
            $cuotasPagadasTotal = 0;
            $cuotasPendientesTotal = 0;
            $creditosActivos = 0;
            $pagosPendientes = [];

            // Recorre cada préstamo para calcular saldos, cuotas faltantes y totales globales
            foreach ($creditos as $credito) {
                // Convierte y normaliza los campos numéricos del crédito actual
                $valor = (float)($credito["ValorPrestamo"] ?? 0);
                $abonado = (float)($credito["totalAbonado"] ?? 0);
                $numCuotas = max(0, (int)($credito["NumeroCuotas"] ?? 0));
                $pagadas = (int)($credito["cuotasPagadas"] ?? 0);
                // Calcula saldo restante (nunca menor a 0), cuotas pendientes y cuota aproximada
                $saldo = max(0, $valor - $abonado);
                $pendientes = $saldo > 0 ? max(1, $numCuotas - $pagadas) : 0;
                $valorCuotaAprox = $numCuotas > 0 ? round($valor / $numCuotas, 2) : round($saldo, 2);

                // Acumula los totales globales del asociado
                $totalPrestado += $valor;
                $totalPagado += $abonado;
                $totalCuotas += $numCuotas;
                $cuotasPagadasTotal += $pagadas;

                // Si el crédito aún tiene saldo por pagar, lo cuenta como activo y lo agrega al detalle de pagos pendientes
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

            // Calcula el saldo pendiente total global del asociado
            $saldoPendiente = max(0, $totalPrestado - $totalPagado);

            // Verifica que la foto guardada aún exista en disco
            $fotoValida = null;
            if (!empty($usuario["fotoPerfil"])) {
                // Extrae el nombre base del archivo y comprueba su existencia física antes de exponer la ruta
                $archivo = basename($usuario["fotoPerfil"]);
                if (is_file(__DIR__ . '/../Assets/img/perfiles/' . $archivo)) {
                    $fotoValida = "../Assets/img/perfiles/" . $archivo;
                }
            }

            // Devuelve en JSON el perfil del usuario, su billetera, el resumen financiero y los préstamos pendientes
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
            // Verifica que se haya cargado correctamente el archivo en el campo 'foto'
            if (!isset($_FILES["foto"]) || $_FILES["foto"]["error"] !== UPLOAD_ERR_OK) {
                http_response_code(400);
                throw new Exception("Selecciona una imagen válida para tu foto de perfil");
            }

            // Toma los datos del archivo subido
            $archivo = $_FILES["foto"];
            // Límite de 2 MB
            if ($archivo["size"] > 2 * 1024 * 1024) {
                http_response_code(400);
                throw new Exception("La imagen supera el tamaño máximo permitido (2 MB)");
            }

            // Valida el tipo MIME real del archivo
            $finfo = new finfo(FILEINFO_MIME_TYPE);
            $mime = $finfo->file($archivo["tmp_name"]);
            // Lista blanca de tipos de imagen permitidos y sus extensiones correspondientes
            $extensiones = [
                "image/jpeg" => "jpg",
                "image/png" => "png",
                "image/webp" => "webp",
                "image/gif" => "gif"
            ];

            // Rechaza archivos cuyo MIME real no sea una imagen admitida
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

            // Genera un nombre de archivo único basado en el documento saneado y el timestamp actual
            $nombreArchivo = "asociado_" . preg_replace('/[^0-9A-Za-z]/', '', (string)$documento) . "_" . time() . "." . $extensiones[$mime];
            // Ruta absoluta donde se almacenará la nueva foto
            $destino = $directorio . '/' . $nombreArchivo;

            // Mueve la imagen temporal al directorio definitivo de perfiles
            if (!move_uploaded_file($archivo["tmp_name"], $destino)) {
                http_response_code(500);
                throw new Exception("No fue posible guardar la imagen en el servidor");
            }

            // Borra la foto anterior si existía
            eliminarArchivoFotoAnterior($usuario["fotoPerfil"] ?? null);

            // Construye la ruta relativa y la guarda en la columna fotoPerfil de la tabla asociados
            $rutaRelativa = "../Assets/img/perfiles/" . $nombreArchivo;
            $upd = $conexion->prepare("UPDATE asociados SET fotoPerfil = :foto WHERE documento = :documento");
            $upd->execute([":foto" => $rutaRelativa, ":documento" => $documento]);

            // Responde con la confirmación y la nueva ruta de la foto de perfil
            echo json_encode([
                "success" => true,
                "mensaje" => "Foto de perfil actualizada correctamente",
                "fotoPerfil" => $rutaRelativa
            ], JSON_UNESCAPED_UNICODE);
            break;

        // DELETE: quita la foto subida para volver al avatar con la inicial del nombre
        case "DELETE":
            // Borra de disco la imagen actual si existía
            eliminarArchivoFotoAnterior($usuario["fotoPerfil"] ?? null);
            // Restablece fotoPerfil a NULL en la base de datos para mostrar el avatar por inicial
            $upd = $conexion->prepare("UPDATE asociados SET fotoPerfil = NULL WHERE documento = :documento");
            $upd->execute([":documento" => $documento]);

            // Confirma el cambio devolviendo fotoPerfil en null
            echo json_encode([
                "success" => true,
                "mensaje" => "Se activó el avatar con la inicial de tu nombre",
                "fotoPerfil" => null
            ], JSON_UNESCAPED_UNICODE);
            break;

        default:
            // Rechaza cualquier método HTTP no soportado con HTTP 405
            http_response_code(405);
            throw new Exception("Método HTTP no permitido");
    }
} catch (PDOException $e) {
    // Captura errores de PDO y responde con HTTP 500
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "mensaje" => "Error en la base de datos: " . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    // Si el código HTTP aún es 200, lo ajusta a 400 para errores controlados
    if (http_response_code() === 200) {
        http_response_code(400);
    }
    // Devuelve el mensaje de error en JSON UTF-8
    echo json_encode([
        "success" => false,
        "mensaje" => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
