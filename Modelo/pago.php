<?php

// Importa la clase de conexión PDO a la base de datos
require_once __DIR__ . '/../Config/conexion.php';

// Clase Modelo encargada de gestionar los pagos de cuotas en la tabla pagos_cuotas
class Pago
{
    // Conexión PDO con MySQL
    private $conexion;

    // Constructor: recibe una conexión opcional o abre una nueva
    public function __construct($conexionDB = null)
    {
        if ($conexionDB instanceof PDO) {
            $this->conexion = $conexionDB;
        } else {
            $db = new Conexion();
            $this->conexion = $db->conectar();
        }
    }

    // Comprueba si el ID de préstamo indicado existe en la tabla prestamos (clave foránea)
    public function existePrestamo($idPrestamo)
    {
        $consulta = $this->conexion->prepare("SELECT 1 FROM prestamos WHERE idPrestamos = :idPrestamo LIMIT 1");
        $consulta->execute([":idPrestamo" => $idPrestamo]);
        // Retorna true si existe, false si no se encontró
        return (bool)$consulta->fetchColumn();
    }

    // Verifica que el préstamo pertenezca al asociado autenticado (seguridad para rol Asociado)
    public function prestamoPerteneceADocumento($idPrestamo, $documento)
    {
        $sql = "SELECT 1
                FROM prestamos p
                INNER JOIN asociados a ON a.idAsociado = p.idAsociado
                WHERE p.idPrestamos = :idPrestamo AND a.documento = :documento
                LIMIT 1";
        $consulta = $this->conexion->prepare($sql);
        $consulta->execute([
            ":idPrestamo" => $idPrestamo,
            ":documento" => $documento
        ]);
        return (bool)$consulta->fetchColumn();
    }

    // Lista los préstamos del asociado junto con el total abonado en cuotas para calcular saldo y progreso
    public function obtenerPrestamosConSaldoPorDocumento($documento)
    {
        $sql = "SELECT p.idPrestamos,
                       p.ValorPrestamo,
                       p.TasaInteres,
                       p.NumeroCuotas,
                       p.FechaPrestamo,
                       COALESCE(SUM(pc.ValorCuota), 0) AS totalAbonado
                FROM prestamos p
                INNER JOIN asociados a ON a.idAsociado = p.idAsociado
                LEFT JOIN pagos_cuotas pc ON pc.idPrestamo = p.idPrestamos
                WHERE a.documento = :documento
                GROUP BY p.idPrestamos, p.ValorPrestamo, p.TasaInteres, p.NumeroCuotas, p.FechaPrestamo
                ORDER BY p.idPrestamos DESC";
        $consulta = $this->conexion->prepare($sql);
        $consulta->execute([":documento" => $documento]);
        return $consulta->fetchAll();
    }

    // Obtiene únicamente los comprobantes de pago pertenecientes a los préstamos del asociado autenticado
    public function obtenerPorDocumento($documento)
    {
        $sql = "SELECT pc.idPago, pc.ValorCuota, pc.FechaPago, pc.idPrestamo,
                       p.ValorPrestamo, a.documento,
                       TRIM(CONCAT(COALESCE(a.nombres, ''), ' ', COALESCE(a.apellidos, ''))) AS nombreAsociado
                FROM pagos_cuotas pc
                INNER JOIN prestamos p ON p.idPrestamos = pc.idPrestamo
                INNER JOIN asociados a ON a.idAsociado = p.idAsociado
                WHERE a.documento = :documento
                ORDER BY pc.idPago DESC";
        $consulta = $this->conexion->prepare($sql);
        $consulta->execute([":documento" => $documento]);
        return $consulta->fetchAll();
    }

    // Lista los préstamos registrados junto al nombre y documento del asociado para el desplegable del formulario
    public function obtenerPrestamosDisponibles()
    {
        $sql = "SELECT p.idPrestamos, p.ValorPrestamo, p.FechaPrestamo,
                       a.documento,
                       TRIM(CONCAT(COALESCE(a.nombres, ''), ' ', COALESCE(a.apellidos, ''))) AS nombreAsociado
                FROM prestamos p
                INNER JOIN asociados a ON a.idAsociado = p.idAsociado
                ORDER BY p.idPrestamos DESC";
        $consulta = $this->conexion->prepare($sql);
        $consulta->execute();
        return $consulta->fetchAll();
    }

    // Obtiene todos los pagos de cuotas enlazados con su préstamo y el asociado correspondiente
    public function obtenerTodos()
    {
        $sql = "SELECT pc.idPago, pc.ValorCuota, pc.FechaPago, pc.idPrestamo,
                       p.ValorPrestamo, a.documento,
                       TRIM(CONCAT(COALESCE(a.nombres, ''), ' ', COALESCE(a.apellidos, ''))) AS nombreAsociado
                FROM pagos_cuotas pc
                INNER JOIN prestamos p ON p.idPrestamos = pc.idPrestamo
                INNER JOIN asociados a ON a.idAsociado = p.idAsociado
                ORDER BY pc.FechaPago DESC, pc.idPago DESC";
        $consulta = $this->conexion->prepare($sql);
        $consulta->execute();
        return $consulta->fetchAll();
    }

    // Registra un nuevo pago de cuota en la tabla pagos_cuotas
    public function guardar($datos)
    {
        $sql = "INSERT INTO pagos_cuotas (ValorCuota, FechaPago, idPrestamo)
                VALUES (:ValorCuota, :FechaPago, :idPrestamo)";
        $consulta = $this->conexion->prepare($sql);
        return $consulta->execute([
            ":ValorCuota" => $datos['ValorCuota'],
            ":FechaPago" => $datos['FechaPago'],
            ":idPrestamo" => $datos['idPrestamo']
        ]);
    }

    // Actualiza el valor de la cuota, fecha o préstamo asociado de un pago existente
    public function editar($datos)
    {
        $sql = "UPDATE pagos_cuotas
                SET ValorCuota = :ValorCuota,
                    FechaPago = :FechaPago,
                    idPrestamo = :idPrestamo
                WHERE idPago = :idPago";
        $consulta = $this->conexion->prepare($sql);
        $consulta->execute([
            ":ValorCuota" => $datos['ValorCuota'],
            ":FechaPago" => $datos['FechaPago'],
            ":idPrestamo" => $datos['idPrestamo'],
            ":idPago" => $datos['idPago']
        ]);

        // Si modificó filas, retorna true inmediatamente
        if ($consulta->rowCount() > 0) {
            return true;
        }

        // Verifica si el registro existía aunque los valores enviados fueran iguales
        $verificar = $this->conexion->prepare("SELECT 1 FROM pagos_cuotas WHERE idPago = :idPago");
        $verificar->execute([":idPago" => $datos['idPago']]);
        return (bool)$verificar->fetchColumn();
    }

    // Elimina un pago de cuota según su idPago
    public function eliminar($idPago)
    {
        $sql = "DELETE FROM pagos_cuotas WHERE idPago = :idPago";
        $consulta = $this->conexion->prepare($sql);
        $consulta->execute([":idPago" => $idPago]);
        // Devuelve true si eliminó al menos una fila
        return $consulta->rowCount() > 0;
    }
}
