<?php
// Establece que la respuesta se devolverá en formato JSON UTF-8
header("Content-Type: application/json; charset=utf-8");
// Importa el modelo Asociado para poder crear y guardar el registro
require_once __DIR__.'/../Modelo/asociado.php';

try {
    // Valida que el registro se envíe únicamente mediante el método HTTP POST
    if($_SERVER['REQUEST_METHOD']!=='POST'){
        // Devuelve estado 405 (Método no permitido)
        http_response_code(405);
        // Lanza una excepción para salir hacia el bloque catch y responder con el error
        throw new Exception("Método HTTP no permitido");
    }

    // Verifica el tipo de contenido de la petición entrante
    $tipoContenido = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($tipoContenido, 'application/json') !== false) {
        // Decodifica el cuerpo JSON enviado por fetch() a un arreglo PHP
        $datos = json_decode(file_get_contents('php://input'), true);
        // Comprueba que la decodificación haya sido exitosa
        if (!is_array($datos) || json_last_error() !== JSON_ERROR_NONE) {
            http_response_code(400);
            throw new Exception("Datos inválidos");
        }
    } else {
        // Si se envió como formulario HTML normal, lee los datos desde $_POST
        $datos = $_POST;
    }

    // Lista de todos los campos obligatorios requeridos para el registro público
    $campos=["documento","nombres","apellidos","FechaNacimiento","genero","DireccionResidencia","ciudad","telefono","email","contraseña"];
    // Recorre cada campo obligatorio y verifica que esté presente en los datos recibidos
    foreach($campos as $campo){ 
        if (!isset($datos[$campo])) {
            http_response_code(400);
            throw new Exception("Falta el campo: " . $campo);
        }
    }

    // Valida que el correo tenga un formato válido (usuario@dominio.ext)
    if(!filter_var($datos['email'], FILTER_VALIDATE_EMAIL)){
        http_response_code(400);
        throw new Exception("Email invalido");
    }

    // Crea la instancia del modelo Asociado con los datos validados
    $asociado = new Asociado($datos);
    // Ejecuta la inserción en la base de datos
    $resultado = $asociado->guardar();

    // Si se guardó correctamente, responde con código 201 (Creado) y la ruta de redirección al Login
    if($resultado){
        http_response_code(201);
        echo json_encode(["success" => true, "mensaje" => "Asociado guardado con exito", "redirect" => "../Vista/Login.html"]);
    } else {
        // Si falló el guardado, responde con código 500 (Error interno)
        http_response_code(500);
        echo json_encode(["success" => false, "mensaje" => "Error al guardar el asociado"]);
    }
    
// Captura errores de base de datos PDO
}catch (PDOException $e) {
    // El código SQLSTATE 23000 indica violación de restricción única (documento duplicado)
    if($e->getCode() == 23000){
        // Código 409 (Conflicto)
        http_response_code(409);
        echo json_encode(["success" => false, "mensaje" => "El documento ya existe en la base de datos"]);
    }else{  
        // Cualquier otro error de base de datos devuelve código 500
        http_response_code(500);
        echo json_encode(["success" => false, "mensaje" => "Error en la base de datos: " . $e->getMessage()]);
    }
// Captura excepciones de validación general
}catch (Exception $e) {
    echo json_encode(["success" => false, "mensaje" => $e->getMessage()]);
}
