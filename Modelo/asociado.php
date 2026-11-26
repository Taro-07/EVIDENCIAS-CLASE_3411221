<?php

// Importa la clase Conexion para poder conectarse a la base de datos
require_once __DIR__ . '/../Config/conexion.php';

// Clase Modelo que representa la entidad Asociado y sus operaciones CRUD en la base de datos
class Asociado{
    // Atributos privados que corresponden a las columnas de la tabla asociados
    private $documento;
    private $nombres;
    private $apellidos;
    private $FechaNacimiento;
    private $genero;
    private $DireccionResidencia;
    private $ciudad;
    private $telefono;
    private $email;
    private $contraseña;

    // Almacena la conexión PDO activa
    private $conexion;

    // Constructor: recibe opcionalmente un arreglo con los datos del asociado y prepara la conexión
    public function __construct($datos = null)
    {
        // Instancia la clase de conexión y obtiene el objeto PDO
        $conexionDB = new Conexion();
        $this->conexion = $conexionDB->conectar();

        // Si se recibieron datos en forma de arreglo, los asigna a cada propiedad del objeto
        if (is_array($datos)) {
            $this->documento = $datos['documento'] ?? null;
            $this->nombres = $datos['nombres'] ?? null;
            $this->apellidos = $datos['apellidos'] ?? null;
            $this->FechaNacimiento = $datos['FechaNacimiento'] ?? null;
            $this->genero = $datos['genero'] ?? null;
            $this->DireccionResidencia = $datos['DireccionResidencia'] ?? null;
            $this->ciudad = $datos['ciudad'] ?? null;
            $this->email = $datos['email'] ?? null;
            $this->telefono = $datos['telefono'] ?? null;
            // Toma la contraseña recibida (o usa el documento como clave inicial si no se envió)
            $clave = (string)($datos['contraseña'] ?? $datos['documento'] ?? '');
            // Encripta la contraseña con un hash seguro (bcrypt) antes de guardarla
            $this->contraseña = password_hash($clave, PASSWORD_DEFAULT);
        }
    }

    // Método estático que consulta y devuelve todos los asociados registrados (sin incluir la contraseña)
    public static function obtenerTodos()
    {
        // Abre una conexión con la base de datos
        $conexionDB = new Conexion();
        $conexion = $conexionDB->conectar();
        // Consulta SQL seleccionando todos los campos visibles ordenados por ID ascendente
        $sql = "SELECT idAsociado, documento, nombres, apellidos, FechaNacimiento, genero, DireccionResidencia, ciudad, telefono, email, rol FROM asociados ORDER BY idAsociado ASC";
        // Prepara y ejecuta la consulta
        $consulta = $conexion->prepare($sql);
        $consulta->execute();
        // Retorna todas las filas obtenidas como arreglo de arreglos asociativos
        return $consulta->fetchAll();
    }

    // Método estático que consulta únicamente los datos del asociado autenticado según su documento
    public static function obtenerPorDocumento($documento)
    {
        $conexionDB = new Conexion();
        $conexion = $conexionDB->conectar();
        // Verifica si existe la columna fotoPerfil para devolverla también
        $check = $conexion->prepare(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'asociados'
               AND COLUMN_NAME = 'fotoPerfil'"
        );
        $check->execute();
        $tieneFoto = (int)$check->fetchColumn() > 0;

        $columnas = "idAsociado, documento, nombres, apellidos, FechaNacimiento, genero, DireccionResidencia, ciudad, telefono, email, rol"
            . ($tieneFoto ? ", fotoPerfil" : "");

        $sql = "SELECT {$columnas}
                FROM asociados
                WHERE documento = :documento
                LIMIT 1";
        $consulta = $conexion->prepare($sql);
        $consulta->execute([":documento" => $documento]);
        $fila = $consulta->fetch();
        if ($fila === false) {
            return null;
        }
        // Valida que el archivo de foto exista en disco antes de devolverlo
        if (!empty($fila["fotoPerfil"])) {
            $archivo = basename($fila["fotoPerfil"]);
            $fila["fotoPerfil"] = is_file(__DIR__ . '/../Assets/img/perfiles/' . $archivo)
                ? "../Assets/img/perfiles/" . $archivo
                : null;
        } else {
            $fila["fotoPerfil"] = null;
        }
        return $fila;
    }

    // Método estático que permite a un asociado actualizar únicamente sus propios datos personales (sin cambiar rol ni documento)
    public static function editarPerfilPropio($documentoSesion, $datos)
    {
        $conexionDB = new Conexion();
        $conexion = $conexionDB->conectar();
        $sql = "UPDATE asociados
                SET nombres = :nombres,
                    apellidos = :apellidos,
                    FechaNacimiento = :FechaNacimiento,
                    genero = :genero,
                    DireccionResidencia = :DireccionResidencia,
                    ciudad = :ciudad,
                    telefono = :telefono,
                    email = :email
                WHERE documento = :documentoSesion";
        $consulta = $conexion->prepare($sql);
        $consulta->execute([
            ":nombres" => $datos['nombres'],
            ":apellidos" => $datos['apellidos'],
            ":FechaNacimiento" => $datos['FechaNacimiento'],
            ":genero" => $datos['genero'],
            ":DireccionResidencia" => $datos['DireccionResidencia'],
            ":ciudad" => $datos['ciudad'],
            ":telefono" => $datos['telefono'],
            ":email" => $datos['email'],
            ":documentoSesion" => $documentoSesion
        ]);

        if ($consulta->rowCount() > 0) {
            return true;
        }

        $verificar = $conexion->prepare("SELECT 1 FROM asociados WHERE documento = :documentoSesion LIMIT 1");
        $verificar->execute([":documentoSesion" => $documentoSesion]);
        return (bool)$verificar->fetchColumn();
    }

    // Método estático que actualiza los datos individuales de un asociado existente por su idAsociado
    public static function editar($datos)
    {
        // Abre la conexión con MySQL
        $conexionDB = new Conexion();
        $conexion = $conexionDB->conectar();
        // Sentencia SQL parametrizada para modificar todos los datos del asociado
        $sql = "UPDATE asociados
                SET documento = :documento,
                    nombres = :nombres,
                    apellidos = :apellidos,
                    FechaNacimiento = :FechaNacimiento,
                    genero = :genero,
                    DireccionResidencia = :DireccionResidencia,
                    ciudad = :ciudad,
                    telefono = :telefono,
                    email = :email,
                    rol = :rol
                WHERE idAsociado = :idAsociado";
        // Prepara la consulta y la ejecuta reemplazando cada parámetro por su valor seguro
        $consulta = $conexion->prepare($sql);
        $consulta->execute([
            ":documento" => $datos['documento'],
            ":nombres" => $datos['nombres'],
            ":apellidos" => $datos['apellidos'],
            ":FechaNacimiento" => $datos['FechaNacimiento'],
            ":genero" => $datos['genero'],
            ":DireccionResidencia" => $datos['DireccionResidencia'],
            ":ciudad" => $datos['ciudad'],
            ":telefono" => $datos['telefono'],
            ":email" => $datos['email'],
            ":rol" => $datos['rol'],
            ":idAsociado" => $datos['idAsociado']
        ]);

        // Si se modificó al menos una fila, retorna verdadero
        if ($consulta->rowCount() > 0) {
            return true;
        }

        // Si no hubo cambios en los valores, verifica si el registro realmente existe en la tabla
        $verificar = $conexion->prepare("SELECT 1 FROM asociados WHERE idAsociado = :idAsociado");
        $verificar->execute([":idAsociado" => $datos['idAsociado']]);
        // Retorna true si existe, o false si el ID no fue encontrado
        return (bool)$verificar->fetchColumn();
    }

    // Método estático que elimina un asociado según su identificador único
    public static function eliminar($idAsociado)
    {
        // Abre la conexión a la base de datos
        $conexionDB = new Conexion();
        $conexion = $conexionDB->conectar();
        // Prepara la sentencia DELETE parametrizada
        $sql = "DELETE FROM asociados WHERE idAsociado = :idAsociado";
        $consulta = $conexion->prepare($sql);
        // Ejecuta la eliminación
        $consulta->execute([":idAsociado" => $idAsociado]);
        // Devuelve true si se eliminó al menos un registro
        return $consulta->rowCount() > 0;
    }

    // Inserta el nuevo asociado (con los datos cargados en el constructor) dentro de la tabla asociados
    public function guardar(){
        // Sentencia SQL INSERT con marcadores de posición para evitar inyección SQL
        $sql = "INSERT INTO asociados (documento, nombres, apellidos, FechaNacimiento, genero, DireccionResidencia, ciudad, email, telefono, contraseña) VALUES (:documento, :nombres, :apellidos, :FechaNacimiento, :genero, :DireccionResidencia, :ciudad, :email, :telefono, :contrasena)";
        // Prepara la consulta en PDO
        $consulta = $this->conexion->prepare($sql);
        // Ejecuta la inserción y retorna true si se guardó correctamente
        return $consulta->execute([
            ":documento" => $this->documento,
            ":nombres" => $this->nombres,
            ":apellidos" => $this->apellidos,
            ":FechaNacimiento" => $this->FechaNacimiento,
            ":genero" => $this->genero,
            ":DireccionResidencia" => $this->DireccionResidencia,
            ":ciudad" => $this->ciudad,
            ":email" => $this->email,
            ":telefono" => $this->telefono,
            ":contrasena" => $this->contraseña
        ]);
    }
}
