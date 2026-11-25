<?php
// Inicia o reanuda la sesión PHP para poder guardar datos del usuario autenticado
session_start();
// Define que la respuesta del servidor será en formato JSON con codificación UTF-8
header("Content-Type: application/json; charset=utf-8");

// Bloque try para capturar errores de validación o de base de datos de forma controlada
try {
    // Verifica que la petición HTTP sea estrictamente de tipo POST
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        // Responde con código 405 (Método no permitido)
        http_response_code(405);
        // Lanza una excepción que será capturada en el bloque catch
        throw new Exception("Método HTTP no permitido");
    }

    // Obtiene la cabecera Content-Type enviada por el cliente (o cadena vacía si no existe)
    $tipoContenido = $_SERVER['CONTENT_TYPE'] ?? '';
    // Comprueba si el cliente envió los datos en formato JSON
    if (stripos($tipoContenido, 'application/json') !== false) {
        // Lee el cuerpo crudo de la petición y lo decodifica a un arreglo asociativo PHP
        $datos = json_decode(file_get_contents('php://input'), true);
        // Verifica que el JSON sea válido y se haya convertido correctamente en arreglo
        if (!is_array($datos) || json_last_error() !== JSON_ERROR_NONE) {
            // Responde con código 400 (Petición incorrecta)
            http_response_code(400);
            throw new Exception("Datos inválidos");
        }
    } else {
        // Si no llegó como JSON, toma los datos enviados por formulario tradicional ($_POST)
        $datos = $_POST;
    }

    // Extrae el correo eliminando espacios al inicio y al final
    $email = trim((string)($datos['email'] ?? ""));
    // Extrae la contraseña admitiendo las claves 'contraseña', 'contrasena' o 'password'
    $contraseña = (string)($datos['contraseña'] ?? $datos['contrasena'] ?? $datos['password'] ?? "");

    // Comprueba que ni el correo ni la contraseña estén vacíos
    if ($email === "" || $contraseña === "") {
        http_response_code(400);
        throw new Exception("Email o contraseña inválidos");
    }

    // Incluye el archivo de conexión a la base de datos
    require_once __DIR__ . '/../Config/conexion.php';
    // Crea una instancia de la clase Conexion
    $conexionObj = new Conexion();
    // Abre la conexión PDO con MySQL
    $conexion = $conexionObj->conectar();

    // Prepara una consulta parametrizada para buscar el asociado por su correo (evita inyección SQL)
    $consulta = $conexion->prepare("SELECT * FROM asociados WHERE email = :email");
    // Ejecuta la consulta pasando el valor del parámetro :email
    $consulta->execute([':email' => $email]);
    // Obtiene el primer registro encontrado (o false si no existe)
    $asociado = $consulta->fetch();

    // Si no se encontró ningún usuario con ese correo, devuelve error 401 (No autorizado)
    if (!$asociado) {
        http_response_code(401);
        throw new Exception("No existe un asociado registrado con ese correo electrónico");
    }

    // Verifica que exista un hash de contraseña y que coincida con la contraseña ingresada
    if (empty($asociado['contraseña']) || !password_verify($contraseña, $asociado['contraseña'])) {
        http_response_code(401);
        throw new Exception("Contraseña incorrecta");
    }

    // Guarda el rol del usuario en minúsculas dentro de la sesión del servidor
    $_SESSION["rol"] = strtolower($asociado['rol'] ?? 'asociado');
    // Guarda el documento del usuario autenticado dentro de la sesión del servidor
    $_SESSION["documento"] = $asociado['documento'];

    // Devuelve una respuesta JSON exitosa con el rol y el nombre completo del usuario
    echo json_encode([
        "success" => true,
        "rol" => $_SESSION["rol"],
        "nombre" => trim(($asociado["nombres"] ?? "") . " " . ($asociado["apellidos"] ?? "")),
    ], JSON_UNESCAPED_UNICODE);

// Captura errores propios de PDO / base de datos
} catch (PDOException $e) {
    // Código 500 indica error interno del servidor
    http_response_code(500);
    // Envía el error en formato JSON
    echo json_encode([
        "success" => false,
        "mensaje" => "Error en la base de datos: " . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
// Captura cualquier otra excepción de validación o autenticación
} catch (Exception $e) {
    // Si el código HTTP aún es 200, lo cambia a 400 para reflejar que hubo error
    if (http_response_code() === 200) {
        http_response_code(400);
    }
    // Devuelve el mensaje de error en JSON conservando tildes y ñ
    echo json_encode([
        "success" => false, 
        "mensaje" => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>
