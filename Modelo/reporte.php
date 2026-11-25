<?php

// Importa la clase de conexión PDO a MySQL
require_once __DIR__ . '/../Config/conexion.php';

// Clase Modelo encargada de calcular los reportes financieros, saldos y balance de actividades
class Reporte
{
    // Conexión PDO activa
    private $conexion;

    // Constructor: acepta una conexión PDO o abre una nueva
    public function __construct($conexionDB = null)
    {
        if ($conexionDB instanceof PDO) {
            $this->conexion = $conexionDB;
        } else {
            $db = new Conexion();
            $this->conexion = $db->conectar();
        }
    }

    // Calcula los 4 indicadores globales del club (prestado, pagado, cartera pendiente y recaudo actividades)
    public function obtenerResumenGlobal()
    {
        $totalPrestado = (float)$this->conexion
            ->query("SELECT COALESCE(SUM(ValorPrestamo), 0) FROM prestamos")
            ->fetchColumn();

        $totalPagadoCuotas = (float)$this->conexion
            ->query("SELECT COALESCE(SUM(ValorCuota), 0) FROM pagos_cuotas")
            ->fetchColumn();

        $recaudoActividades = (float)$this->conexion
            ->query("SELECT COALESCE(SUM(COALESCE(totalRecaudado, 0)), 0) FROM actividades")
            ->fetchColumn();

        $carteraPendiente = max(0, $totalPrestado - $totalPagadoCuotas);

        return [
            "totalPrestado" => round($totalPrestado, 2),
            "totalPagadoCuotas" => round($totalPagadoCuotas, 2),
            "carteraPendiente" => round($carteraPendiente, 2),
            "recaudoActividades" => round($recaudoActividades, 2)
        ];
    }

    // Obtiene el estado de cuenta y cartera consolidada por cada asociado (usando subconsultas para evitar duplicados)
    public function obtenerCarteraPorAsociado()
    {
        $sql = "SELECT a.idAsociado,
                       a.documento,
                       TRIM(CONCAT(COALESCE(a.nombres, ''), ' ', COALESCE(a.apellidos, ''))) AS nombreAsociado,
                       a.telefono,
                       COALESCE(pr.numCreditos, 0) AS numCreditos,
                       COALESCE(pr.totalPrestado, 0) AS totalPrestado,
                       COALESCE(pg.totalPagado, 0) AS totalPagado
                FROM asociados a
                LEFT JOIN (
                    SELECT idAsociado,
                           COUNT(*) AS numCreditos,
                           COALESCE(SUM(ValorPrestamo), 0) AS totalPrestado
                    FROM prestamos
                    GROUP BY idAsociado
                ) pr ON pr.idAsociado = a.idAsociado
                LEFT JOIN (
                    SELECT p.idAsociado,
                           COALESCE(SUM(pc.ValorCuota), 0) AS totalPagado
                    FROM pagos_cuotas pc
                    INNER JOIN prestamos p ON p.idPrestamos = pc.idPrestamo
                    GROUP BY p.idAsociado
                ) pg ON pg.idAsociado = a.idAsociado
                ORDER BY (COALESCE(pr.totalPrestado, 0) - COALESCE(pg.totalPagado, 0)) DESC, a.nombres ASC";

        $consulta = $this->conexion->prepare($sql);
        $consulta->execute();
        $filas = $consulta->fetchAll();

        // Calcula el saldo pendiente individual de cada asociado
        foreach ($filas as &$fila) {
            $prestado = (float)$fila["totalPrestado"];
            $pagado = (float)$fila["totalPagado"];
            $fila["numCreditos"] = (int)$fila["numCreditos"];
            $fila["totalPrestado"] = round($prestado, 2);
            $fila["totalPagado"] = round($pagado, 2);
            $fila["saldoPendiente"] = round(max(0, $prestado - $pagado), 2);
        }
        unset($fila);

        return $filas;
    }

    // Obtiene el balance histórico de actividades con distribución 50% Club / 50% Asociados participantes
    public function obtenerBalanceActividades()
    {
        $sql = "SELECT act.idActividad,
                       act.nombreActividad,
                       act.fechaEvento,
                       act.municipio,
                       COALESCE(act.totalRecaudado, 0) AS totalRecaudado,
                       COUNT(aa.idParticipacion) AS participantes
                FROM actividades act
                LEFT JOIN actividades_asociado aa ON aa.idActividad = act.idActividad
                GROUP BY act.idActividad, act.nombreActividad, act.fechaEvento, act.municipio, act.totalRecaudado
                ORDER BY act.fechaEvento DESC, act.idActividad DESC";

        $consulta = $this->conexion->prepare($sql);
        $consulta->execute();
        $filas = $consulta->fetchAll();

        // Calcula 50% club, 50% distribuido y ganancia individual por participante
        foreach ($filas as &$fila) {
            $recaudado = (float)$fila["totalRecaudado"];
            $participantes = (int)$fila["participantes"];
            $mitadClub = round($recaudado / 2, 2);
            $mitadDistribuido = round($recaudado / 2, 2);
            $gananciaPorAsociado = $participantes > 0 ? round($mitadDistribuido / $participantes, 2) : 0;

            $fila["totalRecaudado"] = round($recaudado, 2);
            $fila["participantes"] = $participantes;
            $fila["mitadClub"] = $mitadClub;
            $fila["mitadDistribuido"] = $mitadDistribuido;
            $fila["gananciaPorAsociado"] = $gananciaPorAsociado;
        }
        unset($fila);

        return $filas;
    }
}
