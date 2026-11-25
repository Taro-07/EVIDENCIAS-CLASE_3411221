<?php

// Importa la clase de conexión a la base de datos MySQL
require_once __DIR__ . '/../Config/conexion.php';

// Clase Modelo encargada de gestionar las solicitudes de préstamo en la tabla prestamos
class Prestamo
{
    // Conexión PDO activa
    private $conexion;

    // Constructor: establece la conexión PDO y garantiza que exista la columna Proposito
    public function __construct($conexionDB = null)
    {
        if ($conexionDB instanceof PDO) {
            $this->conexion = $conexionDB;
        } else {
            $db = new Conexion();
            $this->conexion = $db->conectar();
        }
        // Verifica automáticamente la estructura de la tabla prestamos
        $this->asegurarColumnaProposito();
    }

    // Revisa en INFORMATION_SCHEMA si existe la columna Proposito y la crea si hace falta
    private function asegurarColumnaProposito()
    {
        $consulta = $this->conexion->prepare(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'prestamos'
               AND COLUMN_NAME = 'Proposito'"
        );
        $consulta->execute();
        // Si el conteo es 0, agrega la columna sin afectar datos existentes
        if ((int)$consulta->fetchColumn() === 0) {
            $this->conexion->exec("ALTER TABLE prestamos ADD COLUMN Proposito VARCHAR(255) DEFAULT NULL");
        }
    }

    // Busca el idAsociado en la tabla asociados a partir de su número de documento
    public function buscarIdAsociadoPorDocumento($documento)
    {
        $consulta = $this->conexion->prepare("SELECT idAsociado FROM asociados WHERE documento = :documento LIMIT 1");
        $consulta->execute([":documento" => $documento]);
        $id = $consulta->fetchColumn();
        // Devuelve el ID como entero o null si no existe ningún asociado con ese documento
        return $id !== false ? (int)$id : null;
    }

    // Obtiene todos los préstamos junto con el documento y nombre completo del asociado titular
    public function obtenerTodos()
    {
        $sql = "SELECT p.idPrestamos, p.idAsociado, a.documento,
                       TRIM(CONCAT(COALESCE(a.nombres, ''), ' ', COALESCE(a.apellidos, ''))) AS nombreAsociado,
                       p.ValorPrestamo, p.NumeroCuotas, p.TasaInteres, p.FechaPrestamo, p.Proposito
                FROM prestamos p
                INNER JOIN asociados a ON a.idAsociado = p.idAsociado
                ORDER BY p.FechaPrestamo DESC, p.idPrestamos DESC";
        $consulta = $this->conexion->prepare($sql);
        $consulta->execute();
        return $consulta->fetchAll();
    }

    // Obtiene únicamente los préstamos pertenecientes al asociado autenticado por su documento
    public function obtenerPorDocumento($documento)
    {
        $sql = "SELECT p.idPrestamos, p.idAsociado, a.documento,
                       TRIM(CONCAT(COALESCE(a.nombres, ''), ' ', COALESCE(a.apellidos, ''))) AS nombreAsociado,
                       p.ValorPrestamo, p.NumeroCuotas, p.TasaInteres, p.FechaPrestamo, p.Proposito
                FROM prestamos p
                INNER JOIN asociados a ON a.idAsociado = p.idAsociado
                WHERE a.documento = :documento
                ORDER BY p.idPrestamos DESC";
        $consulta = $this->conexion->prepare($sql);
        $consulta->execute([":documento" => $documento]);
        return $consulta->fetchAll();
    }

    // Obtiene los datos básicos (documento y nombre) del asociado autenticado para el formulario de préstamos
    public function obtenerResumenAsociado($documento)
    {
        $sql = "SELECT documento,
                       TRIM(CONCAT(COALESCE(nombres, ''), ' ', COALESCE(apellidos, ''))) AS nombreCompleto
                FROM asociados
                WHERE documento = :documento
                LIMIT 1";
        $consulta = $this->conexion->prepare($sql);
        $consulta->execute([":documento" => $documento]);
        $fila = $consulta->fetch();
        return $fila !== false ? $fila : null;
    }

    // Elimina un préstamo solo si pertenece al asociado autenticado (borrando primero sus cuotas relacionadas)
    public function eliminarPropio($idPrestamos, $documento)
    {
        $verificar = $this->conexion->prepare(
            "SELECT p.idPrestamos
             FROM prestamos p
             INNER JOIN asociados a ON a.idAsociado = p.idAsociado
             WHERE p.idPrestamos = :idPrestamos AND a.documento = :documento
             LIMIT 1"
        );
        $verificar->execute([
            ":idPrestamos" => $idPrestamos,
            ":documento" => $documento
        ]);
        if (!$verificar->fetchColumn()) {
            return false;
        }

        return $this->eliminar($idPrestamos);
    }

    // Inserta una nueva solicitud de préstamo en la tabla prestamos
    public function guardar($datos)
    {
        $sql = "INSERT INTO prestamos (ValorPrestamo, TasaInteres, NumeroCuotas, FechaPrestamo, idAsociado, Proposito)
                VALUES (:ValorPrestamo, :TasaInteres, :NumeroCuotas, :FechaPrestamo, :idAsociado, :Proposito)";
        $consulta = $this->conexion->prepare($sql);
        return $consulta->execute([
            ":ValorPrestamo" => $datos['ValorPrestamo'],
            ":TasaInteres" => $datos['TasaInteres'],
            ":NumeroCuotas" => $datos['NumeroCuotas'],
            ":FechaPrestamo" => $datos['FechaPrestamo'],
            ":idAsociado" => $datos['idAsociado'],
            ":Proposito" => $datos['Proposito']
        ]);
    }

    // Actualiza todos los datos individuales de un préstamo existente por su idPrestamos
    public function editar($datos)
    {
        $sql = "UPDATE prestamos
                SET ValorPrestamo = :ValorPrestamo,
                    TasaInteres = :TasaInteres,
                    NumeroCuotas = :NumeroCuotas,
                    FechaPrestamo = :FechaPrestamo,
                    idAsociado = :idAsociado,
                    Proposito = :Proposito
                WHERE idPrestamos = :idPrestamos";
        $consulta = $this->conexion->prepare($sql);
        $consulta->execute([
            ":ValorPrestamo" => $datos['ValorPrestamo'],
            ":TasaInteres" => $datos['TasaInteres'],
            ":NumeroCuotas" => $datos['NumeroCuotas'],
            ":FechaPrestamo" => $datos['FechaPrestamo'],
            ":idAsociado" => $datos['idAsociado'],
            ":Proposito" => $datos['Proposito'],
            ":idPrestamos" => $datos['idPrestamos']
        ]);

        // Si hubo filas modificadas, retorna true
        if ($consulta->rowCount() > 0) {
            return true;
        }

        // Si los datos no cambiaron, verifica si el registro realmente existe
        $verificar = $this->conexion->prepare("SELECT 1 FROM prestamos WHERE idPrestamos = :idPrestamos");
        $verificar->execute([":idPrestamos" => $datos['idPrestamos']]);
        return (bool)$verificar->fetchColumn();
    }

    // Elimina un préstamo según su idPrestamos (eliminando antes sus pagos de cuotas en una transacción segura)
    public function eliminar($idPrestamos)
    {
        try {
            $this->conexion->beginTransaction();

            $eliminarCuotas = $this->conexion->prepare("DELETE FROM pagos_cuotas WHERE idPrestamo = :idPrestamos");
            $eliminarCuotas->execute([":idPrestamos" => $idPrestamos]);

            $eliminarPrestamo = $this->conexion->prepare("DELETE FROM prestamos WHERE idPrestamos = :idPrestamos");
            $eliminarPrestamo->execute([":idPrestamos" => $idPrestamos]);
            $eliminado = $eliminarPrestamo->rowCount() > 0;

            $this->conexion->commit();
            return $eliminado;
        } catch (Throwable $e) {
            if ($this->conexion->inTransaction()) {
                $this->conexion->rollBack();
            }
            throw $e;
        }
    }
}
