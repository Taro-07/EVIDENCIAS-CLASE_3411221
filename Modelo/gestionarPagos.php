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
    // Obtiene el cuerpo crudo de la petición HTTP y lo decodifica a arreglo asociativo
    $datos = json_decode(file_get_contents("php://input"), true);
    // Verifica que el JSON decodificado sea un arreglo válido y sin errores de sintaxis
    if (!is_array($datos) || json_last_error() !== JSON_ERROR_NONE) {
        // Responde con HTTP 400 (Bad Request) y lanza excepción si el cuerpo es inválido
        http_response_code(400);
        throw new Exception("Datos inválidos");
    }
    // Retorna el arreglo asociativo con los datos recibidos
    return $datos;
}

// Valida que un identificador (idPago o idPrestamo) sea un entero mayor o igual a 1
function validarIdEntero($id, $etiqueta)
{
    // Filtra el valor verificando que sea un entero >= 1
    $idValido = filter_var($id, FILTER_VALIDATE_INT, ["options" => ["min_range" => 1]]);
    // Si falla la validación, establece HTTP 400 y lanza excepción indicando la etiqueta del campo
    if ($idValido === false) {
        http_response_code(400);
        throw new Exception("El identificador de {$etiqueta} no es válido");
    }
    // Retorna el entero validado
    return $idValido;
}

// Valida los campos de un pago de cuota (ValorCuota, FechaPago, idPrestamo)
function validarDatosPago($datos, Pago $modelo)
{
    // Extrae el valor de la cuota, la fecha saneada y valida el ID del préstamo como entero positivo
    $valorCuota = $datos["ValorCuota"] ?? null;
    $fechaPago = trim((string)($datos["FechaPago"] ?? ""));
    $idPrestamo = validarIdEntero($datos["idPrestamo"] ?? null, "préstamo");

    // Comprueba que ValorCuota exista, sea numérico y estrictamente mayor a cero
    if ($valorCuota === null || $valorCuota === "" || !is_numeric($valorCuota) || (float)$valorCuota <= 0) {
        http_response_code(400);
        throw new Exception("Ingresa un valor de cuota válido mayor a 0");
    }

    // Verifica que la fecha de pago no esté vacía
    if ($fechaPago === "") {
        http_response_code(400);
        throw new Exception("Ingresa una fecha de pago válida");
    }

    // Valida en la base de datos que el préstamo referenciado exista realmente
    if (!$modelo->existePrestamo($idPrestamo)) {
        http_response_code(404);
        throw new Exception("No existe un préstamo registrado con el ID " . $idPrestamo);
    }

    // Retorna los datos del pago validados y con el valor redondeado a 2 decimales
    return [
        "ValorCuota" => round((float)$valorCuota, 2),
        "FechaPago" => $fechaPago,
        "idPrestamo" => $idPrestamo
    ];
}

// Valida y guarda la fotografía del comprobante de pago en Assets/comprobantes/
function guardarArchivoComprobante(string $documento): string
{
    // Comprueba que se haya subido el archivo 'comprobante' sin errores de carga
    if (!isset($_FILES["comprobante"]) || $_FILES["comprobante"]["error"] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        throw new Exception("Debes adjuntar la foto del comprobante de pago");
    }

    // Toma los metadatos del archivo temporal recibido
    $archivo = $_FILES["comprobante"];
    // Límite máximo de 4 MB
    if ($archivo["size"] > 4 * 1024 * 1024) {
        http_response_code(400);
        throw new Exception("La imagen del comprobante supera el tamaño máximo permitido (4 MB)");
    }

    // Inspecciona el contenido real del archivo para obtener su tipo MIME verdadero
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($archivo["tmp_name"]);
    // Lista blanca de tipos MIME de imagen permitidos y sus extensiones seguras
    $extensiones = [
        "image/jpeg" => "jpg",
        "image/png" => "png",
        "image/webp" => "webp",
        "image/gif" => "gif"
    ];

    // Rechaza cualquier archivo cuyo MIME no esté en la lista blanca
    if (!isset($extensiones[$mime])) {
        http_response_code(400);
        throw new Exception("Formato de comprobante no permitido. Sube una foto JPG, PNG, WEBP o GIF");
    }

    // Define la ruta absoluta del directorio destino y la crea si aún no existe
    $directorio = __DIR__ . '/../Assets/comprobantes';
    if (!is_dir($directorio) && !mkdir($directorio, 0775, true)) {
        http_response_code(500);
        throw new Exception("No se pudo crear la carpeta para guardar comprobantes");
    }

    // Sanea el documento dejando solo caracteres alfanuméricos para construir un nombre de archivo seguro
    $docLimpio = preg_replace('/[^0-9A-Za-z]/', '', $documento);
    // Genera un nombre único usando documento, marca de tiempo y número aleatorio de 3 dígitos
    $nombreArchivo = "comprobante_" . $docLimpio . "_" . time() . "_" . random_int(100, 999) . "." . $extensiones[$mime];
    // Construye la ruta absoluta donde se guardará la imagen
    $destino = $directorio . '/' . $nombreArchivo;

    // Mueve el archivo temporal subido a su ubicación definitiva en el servidor
    if (!move_uploaded_file($archivo["tmp_name"], $destino)) {
        http_response_code(500);
        throw new Exception("No fue posible guardar la foto del comprobante en el servidor");
    }

    // Retorna la ruta relativa que se almacenará en la base de datos
    return "../Assets/comprobantes/" . $nombreArchivo;
}

try {
    // Exige que el usuario tenga una sesión iniciada con documento y rol
    if (!isset($_SESSION["documento"], $_SESSION["rol"])) {
        http_response_code(401);
        throw new Exception("Inicia sesión para consultar los pagos");
    }

    // Normaliza el rol en sesión a minúsculas y captura el método HTTP de la solicitud
    $rolSesion = strtolower((string)$_SESSION["rol"]);
    $metodo = $_SERVER["REQUEST_METHOD"];

    // Permite únicamente los métodos GET, POST y PUT; cualquier otro retorna 405
    if (!in_array($metodo, ["GET", "POST", "PUT"], true)) {
        http_response_code(405);
        throw new Exception("Método HTTP no permitido");
    }

    // Instancia el modelo Pago para operar sobre pagos_cuotas
    $pago = new Pago();

    // Enruta la lógica según el método HTTP recibido
    switch ($metodo) {
        // GET: Admin visualiza todos los pagos y sus comprobantes; Asociado ve sus comprobantes y saldos
        case "GET":
            // Si es administrador, devuelve todos los pagos del sistema y todos los préstamos disponibles
            if ($rolSesion === "admin") {
                echo json_encode([
                    "success" => true,
                    "rol" => $rolSesion,
                    "pagos" => $pago->obtenerTodos(),
                    "prestamos" => $pago->obtenerPrestamosDisponibles()
                ], JSON_UNESCAPED_UNICODE);
            } else {
                // Si es asociado, devuelve únicamente sus pagos y sus préstamos con el saldo abonado aprobado
                echo json_encode([
                    "success" => true,
                    "rol" => $rolSesion,
                    "pagos" => $pago->obtenerPorDocumento($_SESSION["documento"]),
                    "prestamos" => $pago->obtenerPrestamosConSaldoPorDocumento($_SESSION["documento"])
                ], JSON_UNESCAPED_UNICODE);
            }
            break;

        // POST: Solo el Asociado registra pagos adjuntando foto del comprobante (queda en estado Pendiente)
        case "POST":
            // Impide que el administrador registre pagos directamente
            if ($rolSesion === "admin") {
                http_response_code(403);
                throw new Exception("El administrador solo puede visualizar y verificar los comprobantes enviados por los asociados");
            }

            // Acepta multipart/form-data (con foto del comprobante)
            $datosEntrada = !empty($_POST) ? $_POST : leerDatosJson();
            // Valida valor de cuota, fecha y existencia del préstamo
            $validados = validarDatosPago($datosEntrada, $pago);

            // Verifica que el préstamo al que intenta abonar realmente pertenezca al asociado autenticado
            if (!$pago->prestamoPerteneceADocumento($validados["idPrestamo"], $_SESSION["documento"])) {
                http_response_code(403);
                throw new Exception("Solo puedes registrar pagos en tus propios préstamos");
            }

            // Guarda la imagen del comprobante en disco y adjunta su ruta y estado inicial 'Pendiente'
            $rutaComprobante = guardarArchivoComprobante((string)$_SESSION["documento"]);
            $validados["comprobante"] = $rutaComprobante;
            $validados["estadoPago"] = "Pendiente";

            // Inserta el registro del pago en la base de datos
            if (!$pago->guardar($validados)) {
                http_response_code(500);
                throw new Exception("Error al registrar el comprobante de pago");
            }

            // Responde con HTTP 201 (Created) confirmando el envío del comprobante
            http_response_code(201);
            echo json_encode([
                "success" => true,
                "mensaje" => "Comprobante enviado correctamente. Queda en estado Pendiente hasta que el administrador lo verifique."
            ], JSON_UNESCAPED_UNICODE);
            break;

        // PUT: Solo el Admin verifica y aprueba un comprobante pendiente (accion = 'aprobar')
        case "PUT":
            // Restringe la aprobación de comprobantes exclusivamente al rol admin
            if ($rolSesion !== "admin") {
                http_response_code(403);
                throw new Exception("Solo el administrador puede aprobar comprobantes de pago");
            }

            // Lee el cuerpo JSON y verifica que la acción solicitada sea exactamente 'aprobar'
            $datos = leerDatosJson();
            $accion = strtolower(trim((string)($datos["accion"] ?? "")));
            if ($accion !== "aprobar") {
                http_response_code(403);
                throw new Exception("Acción no permitida para el administrador");
            }

            // Valida el ID del pago y ejecuta su aprobación en el modelo
            $idPago = validarIdEntero($datos["idPago"] ?? null, "pago");
            $resultado = $pago->aprobarPago($idPago);

            // Si la aprobación falló (no existe o ya estaba aprobado), devuelve el código y error correspondiente
            if (!$resultado["ok"]) {
                http_response_code($resultado["codigo"] ?? 400);
                throw new Exception($resultado["mensaje"]);
            }

            // Responde con HTTP 200 confirmando la aprobación del comprobante
            http_response_code(200);
            echo json_encode([
                "success" => true,
                "mensaje" => $resultado["mensaje"]
            ], JSON_UNESCAPED_UNICODE);
            break;
    }
} catch (PDOException $e) {
    // Captura fallos de base de datos y responde con HTTP 500
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "mensaje" => "Error en la base de datos: " . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    // Si aún tiene código 200 por defecto, cambia el estado HTTP a 400 para errores de negocio/validación
    if (http_response_code() === 200) {
        http_response_code(400);
    }
    // Devuelve el mensaje de error en formato JSON UTF-8
    echo json_encode([
        "success" => false,
        "mensaje" => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
