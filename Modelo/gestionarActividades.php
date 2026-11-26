<?php
// Reanuda la sesión PHP para verificar autenticación y rol del usuario
session_start();

// Define que toda respuesta del endpoint será en formato JSON UTF-8
header("Content-Type: application/json; charset=utf-8");

// Función auxiliar que lee el cuerpo JSON de la petición y lo convierte en arreglo
function leerDatos()
{
    // Lee el flujo crudo de entrada HTTP y lo decodifica en arreglo asociativo
    $datos = json_decode(file_get_contents("php://input"), true);
    // Verifica que el JSON esté bien formado
    if (!is_array($datos) || json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        throw new Exception("Error al decodificar JSON: " . json_last_error_msg());
    }
    // Retorna el arreglo decodificado
    return $datos;
}

// Función que valida nombre, fecha, municipio y tope de monto (metaRecaudo) de una actividad
function validarActividad($datos)
{
    // Extrae los campos requeridos y opcionales del arreglo de entrada
    $nombre = $datos['nombreActividad'] ?? null;
    $fecha = $datos['fechaEvento'] ?? null;
    $municipio = $datos['municipio'] ?? null;
    $metaRecaudo = $datos['metaRecaudo'] ?? null;

    // Comprueba que nombre, fecha y municipio sean cadenas no vacías y dentro del límite de 50 caracteres
    if (
        !is_string($nombre) || trim($nombre) === "" || strlen(trim($nombre)) > 50 ||
        !is_string($fecha) || trim($fecha) === "" ||
        !is_string($municipio) || trim($municipio) === "" || strlen(trim($municipio)) > 50
    ) {
        http_response_code(400);
        throw new Exception("Ingresa un nombre, fecha y municipio válidos");
    }

    // Valida metaRecaudo: puede omitirse (null) o debe ser un número estrictamente mayor a 0
    if ($metaRecaudo === "" || $metaRecaudo === null) {
        $metaValida = null;
    } elseif (!is_numeric($metaRecaudo) || (float)$metaRecaudo <= 0) {
        http_response_code(400);
        throw new Exception("El tope de monto debe ser un valor numérico mayor a 0");
    } else {
        // Redondea el tope de monto válido a 2 decimales
        $metaValida = round((float)$metaRecaudo, 2);
    }

    // Retorna los campos limpios y listos para guardar o actualizar en base de datos
    return [
        "nombreActividad" => trim($nombre),
        "fechaEvento" => trim($fecha),
        "municipio" => trim($municipio),
        "metaRecaudo" => $metaValida
    ];
}

// Función que valida que el identificador de la actividad sea un entero positivo
function validarId($id)
{
    // Valida que el parámetro sea un entero >= 1
    $idActividad = filter_var($id, FILTER_VALIDATE_INT, ["options" => ["min_range" => 1]]);
    // Lanza excepción HTTP 400 si el ID no es un entero positivo válido
    if ($idActividad === false) {
        http_response_code(400);
        throw new Exception("El identificador de la actividad no es válido");
    }
    // Retorna el identificador validado
    return $idActividad;
}

try {
    // Exige que el usuario haya iniciado sesión (documento y rol presentes en $_SESSION)
    if (!isset($_SESSION["documento"], $_SESSION["rol"])) {
        http_response_code(401);
        throw new Exception("Inicia sesión para consultar las actividades");
    }

    // Normaliza el rol a minúsculas y obtiene el método HTTP (GET, POST, PUT o DELETE)
    $rol = strtolower((string)$_SESSION["rol"]);
    $metodo = $_SERVER["REQUEST_METHOD"];
    // Rechaza métodos HTTP no soportados
    if (!in_array($metodo, ["GET", "POST", "PUT", "DELETE"], true)) {
        http_response_code(405);
        throw new Exception("Método HTTP no permitido");
    }

    // Solo los administradores pueden crear, editar o eliminar actividades; el asociado puede consultar (GET) y abonar (POST accion='abonar')
    if ($metodo !== "GET" && $metodo !== "POST" && $rol !== "admin") {
        http_response_code(403);
        throw new Exception("No tienes permisos para realizar esta acción");
    }

    // Importa el modelo Actividad e instancia el objeto para operar en la BD
    require_once __DIR__ . "/actividad.php";
    $actividad = new Actividad();

    // Ejecuta la operación CRUD correspondiente según el método HTTP
    switch ($metodo) {
        // GET: devuelve el listado de actividades y el rol actual
        case "GET":
            // Construye la respuesta con el rol del usuario y todas las actividades ordenadas por fecha
            $resultado = [
                "success" => true,
                "rol" => $rol,
                "actividades" => $actividad->obtenerActividades()
            ];
            http_response_code(200);
            break;
        // POST: Admin crea nueva actividad; Asociado registra un abono a una actividad existente
        case "POST":
            // Lee el JSON de entrada y normaliza la acción opcional enviada
            $datosEntrada = leerDatos();
            $accion = strtolower(trim((string)($datosEntrada["accion"] ?? "")));

            // Si la acción es 'abonar', valida ID y monto y ejecuta el abono respetando la meta de recaudo
            if ($accion === "abonar") {
                // Valida el ID de la actividad destino
                $idActividad = validarId($datosEntrada["idActividad"] ?? null);
                // Extrae y valida que el monto del abono sea numérico y mayor a 0
                $monto = $datosEntrada["monto"] ?? null;
                if ($monto === null || $monto === "" || !is_numeric($monto) || (float)$monto <= 0) {
                    http_response_code(400);
                    throw new Exception("Ingresa un monto de abono válido mayor a 0");
                }

                // Ejecuta el abono transaccional en el modelo Actividad
                $respAbono = $actividad->abonarActividad(
                    $idActividad,
                    (string)$_SESSION["documento"],
                    round((float)$monto, 2)
                );
                // Si el modelo rechaza el abono (no existe o excede el tope), retorna el error correspondiente
                if (!$respAbono["ok"]) {
                    http_response_code($respAbono["codigo"] ?? 400);
                    throw new Exception($respAbono["mensaje"] ?? "No se pudo registrar el abono");
                }

                // Prepara la respuesta de éxito con el nuevo totalRecaudado acumulado
                $resultado = [
                    "success" => true,
                    "mensaje" => "Abono registrado correctamente en la actividad.",
                    "totalRecaudado" => $respAbono["totalRecaudado"]
                ];
                http_response_code(200);
                break;
            }

            // Si no es un abono, se trata de crear una actividad: restringido solo a administradores
            if ($rol !== "admin") {
                http_response_code(403);
                throw new Exception("No tienes permisos para crear actividades");
            }

            // Valida los campos de la nueva actividad y la inserta en la base de datos
            $datos = validarActividad($datosEntrada);
            $actividad->guardar($datos);
            // Prepara respuesta HTTP 201 (Created)
            $resultado = [
                "success" => true,
                "mensaje" => "Actividad creada exitosamente"
            ];
            http_response_code(201);
            break;
        // PUT: valida el ID, los campos y el total recaudado para actualizar una actividad
        case "PUT":
            // Lee el JSON, valida idActividad y valida nombre, fecha, municipio y metaRecaudo
            $datos = leerDatos();
            $datos["idActividad"] = validarId($datos["idActividad"] ?? null);
            $validados = validarActividad($datos);
            // Permite que totalRecaudado sea nulo o un valor numérico
            $totalRecaudado = $datos["totalRecaudado"] ?? null;
            if ($totalRecaudado === "" || $totalRecaudado === null) {
                $totalRecaudado = null;
            } elseif (!is_numeric($totalRecaudado)) {
                http_response_code(400);
                throw new Exception("El total recaudado debe ser un valor numérico");
            }

            // Completa el arreglo con el ID y el total recaudado validado
            $validados["idActividad"] = $datos["idActividad"];
            $validados["totalRecaudado"] = $totalRecaudado;

            // Ejecuta la actualización y devuelve 404 si el ID no existe
            if (!$actividad->editar($validados)) {
                http_response_code(404);
                throw new Exception("No se encontró la actividad");
            }
            // Prepara la respuesta de confirmación con HTTP 200
            $resultado = [
                "success" => true,
                "mensaje" => "Actividad actualizada correctamente"
            ];
            http_response_code(200);
            break;
        // DELETE: elimina una actividad según su idActividad
        case "DELETE":
            // Lee el JSON de la petición y valida el identificador de la actividad a borrar
            $datos = leerDatos();
            $idActividad = validarId($datos["idActividad"] ?? null);

            // Intenta eliminar la actividad; si no existe responde con HTTP 404
            if (!$actividad->eliminar($idActividad)) {
                http_response_code(404);
                throw new Exception("No se encontró la actividad");
            }

            // Prepara la respuesta de eliminación exitosa
            $resultado = [
                "success" => true,
                "mensaje" => "Actividad eliminada correctamente"
            ];
            http_response_code(200);
            break;
    }

    // Imprime la respuesta JSON final conservando caracteres en español
    echo json_encode($resultado, JSON_UNESCAPED_UNICODE);
// Captura errores de base de datos PDO
} catch (PDOException $e) {
    // Establece código 500 y devuelve el detalle del error de base de datos
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "mensaje" => "Error en la base de datos: " . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
// Captura errores de validación, sesión o permisos
} catch (Exception $e) {
    // Asegura un código HTTP 400 si aún estaba en 200
    if (http_response_code() === 200) {
        http_response_code(400);
    }
    // Devuelve el mensaje de error en formato JSON UTF-8
    echo json_encode([
        "success" => false,
        "mensaje" => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
