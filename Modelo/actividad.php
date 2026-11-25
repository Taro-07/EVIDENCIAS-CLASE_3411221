<?php

// Importa la clase de conexión a la base de datos MySQL
require_once __DIR__ . '/../Config/conexion.php';

// Clase Modelo encargada de las operaciones CRUD sobre la tabla actividades
class Actividad
{
    // Almacena el objeto PDO de conexión a la base de datos
    private $conexion;

    // Constructor: acepta una conexión PDO existente o crea una nueva si no se pasa ninguna
    public function __construct($conexionDB = null)
    {
        if ($conexionDB instanceof PDO) {
            // Reutiliza la conexión PDO entregada
            $this->conexion = $conexionDB;
        } else {
            // Crea una nueva conexión usando la clase Conexion
            $db = new Conexion();
            $this->conexion = $db->conectar();
        }
    }

    // Consulta todas las actividades ordenadas cronológicamente por fecha del evento
    public function obtenerActividades()
    {
        // Sentencia SQL para listar todos los registros de actividades
        $sql = "SELECT * FROM actividades ORDER BY fechaEvento ASC";
        // Prepara y ejecuta la consulta
        $consulta = $this->conexion->prepare($sql);
        $consulta->execute();
        // Retorna todas las filas como un arreglo asociativo
        return $consulta->fetchAll();
    }

    // Inserta una nueva actividad en la tabla actividades
    public function guardar($datos)
    {
        // Sentencia INSERT parametrizada para prevenir inyección SQL
        $sql = "INSERT INTO actividades (nombreActividad, fechaEvento, municipio)
         VALUES (:nombreActividad, :fechaEvento, :municipio)";
        $consulta = $this->conexion->prepare($sql);
        // Ejecuta la consulta asignando los valores recibidos y retorna true/false
        return $consulta->execute([
            ":nombreActividad" => $datos['nombreActividad'],
            ":fechaEvento" => $datos['fechaEvento'],
            ":municipio" => $datos['municipio']
        ]);
    }

    // Elimina una actividad de la base de datos según su idActividad
    public function eliminar($idActividad)
    {
        // Sentencia DELETE parametrizada
        $sql = "DELETE FROM actividades WHERE idActividad = :idActividad";
        $consulta = $this->conexion->prepare($sql);
        // Ejecuta la eliminación
        $consulta->execute([":idActividad" => $idActividad]);
        // Retorna true si se eliminó al menos una fila, false si el ID no existía
        return $consulta->rowCount() > 0;
    }

    // Actualiza los datos de una actividad existente (incluyendo totalRecaudado)
    public function editar($datos)
    {
        // Sentencia UPDATE parametrizada
        $sql = "UPDATE actividades SET nombreActividad = :nombreActividad, fechaEvento = :fechaEvento, municipio = :municipio, totalRecaudado = :totalRecaudado WHERE idActividad = :idActividad";
        $consulta = $this->conexion->prepare($sql);
        // Ejecuta la actualización en MySQL
        $consulta->execute([
            ":nombreActividad" => $datos['nombreActividad'],
            ":fechaEvento" => $datos['fechaEvento'],
            ":municipio" => $datos['municipio'],
            ":totalRecaudado" => $datos['totalRecaudado'] ?? null,
            ":idActividad" => $datos['idActividad']
        ]);

        // Si al menos una fila fue modificada, confirma el éxito
        if ($consulta->rowCount() > 0) {
            return true;
        }

        // Si los datos enviados eran iguales a los guardados, comprueba si el registro existe
        $verificar = $this->conexion->prepare("SELECT 1 FROM actividades WHERE idActividad = :idActividad");
        $verificar->execute([":idActividad" => $datos['idActividad']]);

        // Retorna true si la actividad existe, false si no se encontró
        return (bool)$verificar->fetchColumn();
    }
}
