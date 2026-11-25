<?php
// Inicia o reanuda la sesión PHP para validar que el usuario esté autenticado
session_start();
// Define la cabecera de respuesta como JSON en UTF-8
header("Content-Type: application/json; charset=utf-8");

// Importa la clase modelo Asociado
require_once __DIR__ . "/asociado.php";

// Función auxiliar para leer y decodificar el cuerpo JSON de la petición HTTP
function leerDatosJson()
{
    // Convierte el JSON recibido en un arreglo asociativo
    $datos = json_decode(file_get_contents("php://input"), true);
    // Verifica que el JSON sea válido
    if (!is_array($datos) || json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        throw new Exception("Datos inválidos");
    }
    return $datos;
}

// Función auxiliar que valida que el ID del asociado sea un número entero mayor o igual a 1
function validarIdAsociado($id)
{
    $idValido = filter_var($id, FILTER_VALIDATE_INT, ["options" => ["min_range" => 1]]);
    if ($idValido === false) {
        http_response_code(400);
        throw new Exception("El identificador del asociado no es válido");
    }
    return $idValido;
}

// Función que valida y limpia los campos recibidos al crear o editar un asociado
function validarDatosAsociado($datos)
{
    // Campos obligatorios para registrar o actualizar un asociado
    $requeridos = ["documento", "nombres", "apellidos", "email", "telefono", "FechaNacimiento"];
    // Verifica que cada campo requerido exista y no esté vacío
    foreach ($requeridos as $campo) {
        if (!isset($datos[$campo]) || trim((string)$datos[$campo]) === "") {
            http_response_code(400);
            throw new Exception("Falta el campo: " . $campo);
        }
    }

    // Limpia y valida el formato del correo electrónico
    $email = trim((string)$datos["email"]);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        throw new Exception("Correo electrónico inválido");
    }

    // Normaliza el rol para que coincida con el ENUM de MySQL ('Admin' o 'Asociado')
    $rolEntrada = strtolower(trim((string)($datos["rol"] ?? "asociado")));
    $rolNormalizado = $rolEntrada === "admin" ? "Admin" : "Asociado";

    // Retorna el arreglo limpio y listo para enviarse al modelo
    return [
        "documento" => trim((string)$datos["documento"]),
        "nombres" => trim((string)$datos["nombres"]),
        "apellidos" => trim((string)$datos["apellidos"]),
        "FechaNacimiento" => trim((string)$datos["FechaNacimiento"]),
        "genero" => trim((string)($datos["genero"] ?? "Otro")),
        "DireccionResidencia" => trim((string)($datos["DireccionResidencia"] ?? "")),
        "ciudad" => trim((string)($datos["ciudad"] ?? "")),
        "telefono" => trim((string)$datos["telefono"]),
        "email" => $email,
        "rol" => $rolNormalizado
    ];
}

try {
    // Verifica que exista una sesión activa con documento y rol
    if (!isset($_SESSION["documento"], $_SESSION["rol"])) {
        http_response_code(401);
        throw new Exception("Inicia sesión para consultar los asociados");
    }

    // Obtiene el rol en minúsculas y el método HTTP de la petición
    $rolSesion = strtolower((string)$_SESSION["rol"]);
    $metodo = $_SERVER["REQUEST_METHOD"];

    // Solo permite los métodos CRUD estándar: GET, POST, PUT y DELETE
    if (!in_array($metodo, ["GET", "POST", "PUT", "DELETE"], true)) {
        http_response_code(405);
        throw new Exception("Método HTTP no permitido");
    }

    // Bloquea POST y DELETE para no administradores (el asociado puede hacer GET de su ficha y PUT de su propio perfil)
    if (in_array($metodo, ["POST", "DELETE"], true) && $rolSesion !== "admin") {
        http_response_code(403);
        throw new Exception("No tienes permisos para realizar esta acción");
    }

    // Selecciona la acción a ejecutar según el método HTTP recibido
    switch ($metodo) {
        // GET: Admin obtiene todos los asociados; Asociado obtiene únicamente su ficha personal
        case "GET":
            if ($rolSesion === "admin") {
                echo json_encode([
                    "success" => true,
                    "rol" => $rolSesion,
                    "asociados" => Asociado::obtenerTodos()
                ], JSON_UNESCAPED_UNICODE);
            } else {
                echo json_encode([
                    "success" => true,
                    "rol" => $rolSesion,
                    "perfil" => Asociado::obtenerPorDocumento($_SESSION["documento"])
                ], JSON_UNESCAPED_UNICODE);
            }
            break;

        // POST: crea un nuevo asociado desde el panel de administración
        case "POST":
            $datos = leerDatosJson();
            $validados = validarDatosAsociado($datos);
            // Si no se envió contraseña, asigna el documento como contraseña inicial
            $validados["contraseña"] = (string)($datos["contraseña"] ?? $validados["documento"]);

            // Instancia el modelo y guarda en la base de datos
            $asociado = new Asociado($validados);
            if (!$asociado->guardar()) {
                http_response_code(500);
                throw new Exception("Error al guardar el asociado");
            }

            // Devuelve código 201 confirmando la creación
            http_response_code(201);
            echo json_encode([
                "success" => true,
                "mensaje" => "Asociado registrado con éxito"
            ], JSON_UNESCAPED_UNICODE);
            break;

        // PUT: Admin actualiza cualquier asociado; Asociado actualiza únicamente sus propios datos personales
        case "PUT":
            $datos = leerDatosJson();

            if ($rolSesion === "admin") {
                $idAsociado = validarIdAsociado($datos["idAsociado"] ?? null);
                $validados = validarDatosAsociado($datos);
                $validados["idAsociado"] = $idAsociado;

                if (!Asociado::editar($validados)) {
                    http_response_code(404);
                    throw new Exception("No se encontró el asociado");
                }

                http_response_code(200);
                echo json_encode([
                    "success" => true,
                    "mensaje" => "Asociado actualizado correctamente"
                ], JSON_UNESCAPED_UNICODE);
            } else {
                // Usa siempre el documento de la sesión para impedir que un asociado modifique a otro
                $datos["documento"] = (string)$_SESSION["documento"];
                $validados = validarDatosAsociado($datos);

                if (!Asociado::editarPerfilPropio($_SESSION["documento"], $validados)) {
                    http_response_code(404);
                    throw new Exception("No se encontró tu ficha de asociado");
                }

                http_response_code(200);
                echo json_encode([
                    "success" => true,
                    "mensaje" => "Tus datos personales se actualizaron correctamente",
                    "nombre" => trim($validados["nombres"] . " " . $validados["apellidos"]),
                    "perfil" => Asociado::obtenerPorDocumento($_SESSION["documento"])
                ], JSON_UNESCAPED_UNICODE);
            }
            break;

        // DELETE: elimina un asociado por su ID
        case "DELETE":
            $datos = leerDatosJson();
            $idAsociado = validarIdAsociado($datos["idAsociado"] ?? null);

            // Ejecuta la eliminación y verifica si el registro existía
            if (!Asociado::eliminar($idAsociado)) {
                http_response_code(404);
                throw new Exception("No se encontró el asociado");
            }

            http_response_code(200);
            echo json_encode([
                "success" => true,
                "mensaje" => "Asociado eliminado correctamente"
            ], JSON_UNESCAPED_UNICODE);
            break;
    }
// Captura errores de base de datos PDO
} catch (PDOException $e) {
    // Código 23000: documento duplicado (POST/PUT) o clave foránea referenciada (DELETE)
    if ($e->getCode() == 23000) {
        http_response_code(409);
        $esDelete = ($_SERVER["REQUEST_METHOD"] ?? "") === "DELETE";
        echo json_encode([
            "success" => false,
            "mensaje" => $esDelete
                ? "No se puede eliminar el asociado porque tiene registros relacionados"
                : "El documento ya existe en la base de datos"
        ], JSON_UNESCAPED_UNICODE);
    } else {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "mensaje" => "Error en la base de datos: " . $e->getMessage()
        ], JSON_UNESCAPED_UNICODE);
    }
// Captura cualquier otra excepción de validación o permisos
} catch (Exception $e) {
    if (http_response_code() === 200) {
        http_response_code(400);
    }
    echo json_encode([
        "success" => false,
        "mensaje" => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
