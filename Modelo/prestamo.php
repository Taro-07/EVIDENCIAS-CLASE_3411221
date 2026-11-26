<?php

// Importa la clase de conexión a la base de datos MySQL
require_once __DIR__ . '/../Config/conexion.php';

// Clase Modelo encargada de gestionar préstamos y el flujo de aprobaciones del Administrador
class Prestamo
{
    // Conexión PDO activa
    private $conexion;

    // Constructor: establece la conexión PDO y garantiza que existan las columnas necesarias
    public function __construct($conexionDB = null)
    {
        if ($conexionDB instanceof PDO) {
            $this->conexion = $conexionDB;
        } else {
            $db = new Conexion();
            $this->conexion = $db->conectar();
        }
        $this->asegurarEstructuraPrestamos();
    }

    // Verifica y crea columnas adicionales en prestamos y la estructura de billetera en asociados sin afectar datos previos
    private function asegurarEstructuraPrestamos()
    {
        $columnas = [
            "Proposito" => "ALTER TABLE prestamos ADD COLUMN Proposito VARCHAR(255) DEFAULT NULL",
            "estadoAprobacion" => "ALTER TABLE prestamos ADD COLUMN estadoAprobacion VARCHAR(30) NOT NULL DEFAULT 'Aprobado'",
            "solicitudTipo" => "ALTER TABLE prestamos ADD COLUMN solicitudTipo VARCHAR(20) DEFAULT NULL",
            "solicitudDatos" => "ALTER TABLE prestamos ADD COLUMN solicitudDatos TEXT DEFAULT NULL"
        ];

        $consulta = $this->conexion->prepare(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'prestamos'
               AND COLUMN_NAME = :columna"
        );

        foreach ($columnas as $nombre => $sqlAlter) {
            $consulta->execute([":columna" => $nombre]);
            if ((int)$consulta->fetchColumn() === 0) {
                $this->conexion->exec($sqlAlter);
            }
        }

        // Garantiza que exista la columna saldoBilletera en asociados y la tabla movimientos_billetera
        $consultaSaldo = $this->conexion->prepare(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'asociados'
               AND COLUMN_NAME = 'saldoBilletera'"
        );
        $consultaSaldo->execute();
        if ((int)$consultaSaldo->fetchColumn() === 0) {
            $this->conexion->exec("ALTER TABLE asociados ADD COLUMN saldoBilletera DECIMAL(14,2) NOT NULL DEFAULT 0.00");
        }

        $this->conexion->exec(
            "CREATE TABLE IF NOT EXISTS movimientos_billetera (
                idMovimiento INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                idAsociado INT UNSIGNED NOT NULL,
                tipo ENUM('recarga', 'retiro') NOT NULL,
                monto DECIMAL(14,2) NOT NULL,
                descripcion VARCHAR(255) DEFAULT NULL,
                saldoResultante DECIMAL(14,2) NOT NULL,
                fechaMovimiento DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_mov_asociado_fecha (idAsociado, fechaMovimiento),
                CONSTRAINT fk_mov_billetera_asociado
                    FOREIGN KEY (idAsociado) REFERENCES asociados(idAsociado)
                    ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );
    }

    // Acredita automáticamente un monto en la billetera del asociado y registra el movimiento en su historial
    private function acreditarBilletera(int $idAsociado, float $monto, string $descripcion): float
    {
        $stmtLock = $this->conexion->prepare(
            "SELECT saldoBilletera FROM asociados WHERE idAsociado = :idAsociado FOR UPDATE"
        );
        $stmtLock->execute([":idAsociado" => $idAsociado]);
        $saldoActual = round((float)$stmtLock->fetchColumn(), 2);
        $nuevoSaldo = round($saldoActual + $monto, 2);

        $stmtUpd = $this->conexion->prepare(
            "UPDATE asociados SET saldoBilletera = :saldo WHERE idAsociado = :idAsociado"
        );
        $stmtUpd->execute([
            ":saldo" => $nuevoSaldo,
            ":idAsociado" => $idAsociado
        ]);

        $stmtMov = $this->conexion->prepare(
            "INSERT INTO movimientos_billetera (idAsociado, tipo, monto, descripcion, saldoResultante)
             VALUES (:idAsociado, 'recarga', :monto, :descripcion, :saldoResultante)"
        );
        $stmtMov->execute([
            ":idAsociado" => $idAsociado,
            ":monto" => round($monto, 2),
            ":descripcion" => $descripcion,
            ":saldoResultante" => $nuevoSaldo
        ]);

        return $nuevoSaldo;
    }

    // Busca el idAsociado en la tabla asociados a partir de su número de documento
    public function buscarIdAsociadoPorDocumento($documento)
    {
        $consulta = $this->conexion->prepare("SELECT idAsociado FROM asociados WHERE documento = :documento LIMIT 1");
        $consulta->execute([":documento" => $documento]);
        $id = $consulta->fetchColumn();
        return $id !== false ? (int)$id : null;
    }

    // Decodifica el JSON de solicitudDatos si existe para enviarlo estructurado al frontend
    private function formatearFilas(array $filas): array
    {
        foreach ($filas as &$fila) {
            $fila["estadoAprobacion"] = $fila["estadoAprobacion"] ?: "Aprobado";
            $fila["solicitudTipo"] = $fila["solicitudTipo"] ?: null;
            if (!empty($fila["solicitudDatos"])) {
                $decodificado = json_decode($fila["solicitudDatos"], true);
                $fila["solicitudDatos"] = is_array($decodificado) ? $decodificado : null;
            } else {
                $fila["solicitudDatos"] = null;
            }
        }
        unset($fila);
        return $filas;
    }

    // Obtiene todos los préstamos (priorizando las solicitudes pendientes de aprobación primero)
    public function obtenerTodos()
    {
        $sql = "SELECT p.idPrestamos, p.idAsociado, a.documento,
                       TRIM(CONCAT(COALESCE(a.nombres, ''), ' ', COALESCE(a.apellidos, ''))) AS nombreAsociado,
                       p.ValorPrestamo, p.NumeroCuotas, p.TasaInteres, p.FechaPrestamo, p.Proposito,
                       p.estadoAprobacion, p.solicitudTipo, p.solicitudDatos
                FROM prestamos p
                INNER JOIN asociados a ON a.idAsociado = p.idAsociado
                ORDER BY
                    CASE
                        WHEN p.estadoAprobacion = 'Pendiente' OR p.solicitudTipo IS NOT NULL THEN 0
                        ELSE 1
                    END ASC,
                    p.idPrestamos DESC";
        $consulta = $this->conexion->prepare($sql);
        $consulta->execute();
        return $this->formatearFilas($consulta->fetchAll());
    }

    // Obtiene únicamente los préstamos pertenecientes al asociado autenticado por su documento
    public function obtenerPorDocumento($documento)
    {
        $sql = "SELECT p.idPrestamos, p.idAsociado, a.documento,
                       TRIM(CONCAT(COALESCE(a.nombres, ''), ' ', COALESCE(a.apellidos, ''))) AS nombreAsociado,
                       p.ValorPrestamo, p.NumeroCuotas, p.TasaInteres, p.FechaPrestamo, p.Proposito,
                       p.estadoAprobacion, p.solicitudTipo, p.solicitudDatos
                FROM prestamos p
                INNER JOIN asociados a ON a.idAsociado = p.idAsociado
                WHERE a.documento = :documento
                ORDER BY p.idPrestamos DESC";
        $consulta = $this->conexion->prepare($sql);
        $consulta->execute([":documento" => $documento]);
        return $this->formatearFilas($consulta->fetchAll());
    }

    // Obtiene los datos básicos (documento y nombre) del asociado autenticado
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

    // Obtiene un préstamo específico por ID (para validar propiedad o procesar aprobación)
    public function obtenerPorId($idPrestamos)
    {
        $sql = "SELECT p.idPrestamos, p.idAsociado, a.documento,
                       p.ValorPrestamo, p.NumeroCuotas, p.TasaInteres, p.FechaPrestamo, p.Proposito,
                       p.estadoAprobacion, p.solicitudTipo, p.solicitudDatos
                FROM prestamos p
                INNER JOIN asociados a ON a.idAsociado = p.idAsociado
                WHERE p.idPrestamos = :idPrestamos
                LIMIT 1";
        $consulta = $this->conexion->prepare($sql);
        $consulta->execute([":idPrestamos" => $idPrestamos]);
        $fila = $consulta->fetch();
        return $fila !== false ? $fila : null;
    }

    // Inserta una nueva solicitud de préstamo creada por el Asociado (en estado Pendiente hasta aprobación del Admin)
    public function guardarSolicitudCreacion($datos)
    {
        $sql = "INSERT INTO prestamos
                    (ValorPrestamo, TasaInteres, NumeroCuotas, FechaPrestamo, idAsociado, Proposito, estadoAprobacion, solicitudTipo, solicitudDatos)
                VALUES
                    (:ValorPrestamo, :TasaInteres, :NumeroCuotas, :FechaPrestamo, :idAsociado, :Proposito, 'Pendiente', 'crear', NULL)";
        $consulta = $this->conexion->prepare($sql);
        return $consulta->execute([
            ":ValorPrestamo" => $datos["ValorPrestamo"],
            ":TasaInteres" => $datos["TasaInteres"],
            ":NumeroCuotas" => $datos["NumeroCuotas"],
            ":FechaPrestamo" => $datos["FechaPrestamo"],
            ":idAsociado" => $datos["idAsociado"],
            ":Proposito" => $datos["Proposito"]
        ]);
    }

    // Registra una solicitud de edición de un préstamo propio del Asociado sin aplicar aún el cambio
    public function solicitarEdicionPropia($idPrestamos, $documento, $datosPropuestos)
    {
        $prestamo = $this->obtenerPorId($idPrestamos);
        if (!$prestamo || (string)$prestamo["documento"] !== (string)$documento) {
            return false;
        }

        $jsonDatos = json_encode([
            "ValorPrestamo" => $datosPropuestos["ValorPrestamo"],
            "TasaInteres" => $datosPropuestos["TasaInteres"],
            "NumeroCuotas" => $datosPropuestos["NumeroCuotas"],
            "FechaPrestamo" => $datosPropuestos["FechaPrestamo"],
            "Proposito" => $datosPropuestos["Proposito"]
        ], JSON_UNESCAPED_UNICODE);

        $sql = "UPDATE prestamos
                SET solicitudTipo = 'editar',
                    solicitudDatos = :solicitudDatos
                WHERE idPrestamos = :idPrestamos";
        $consulta = $this->conexion->prepare($sql);
        return $consulta->execute([
            ":solicitudDatos" => $jsonDatos,
            ":idPrestamos" => $idPrestamos
        ]);
    }

    // Registra una solicitud de eliminación de un préstamo propio del Asociado sin borrarlo aún
    public function solicitarEliminacionPropia($idPrestamos, $documento)
    {
        $prestamo = $this->obtenerPorId($idPrestamos);
        if (!$prestamo || (string)$prestamo["documento"] !== (string)$documento) {
            return false;
        }

        $sql = "UPDATE prestamos
                SET solicitudTipo = 'eliminar',
                    solicitudDatos = NULL
                WHERE idPrestamos = :idPrestamos";
        $consulta = $this->conexion->prepare($sql);
        return $consulta->execute([":idPrestamos" => $idPrestamos]);
    }

    // Aprueba una solicitud pendiente (creación, edición o eliminación) únicamente ejecutado por el Administrador
    public function aprobarSolicitud($idPrestamos)
    {
        $prestamo = $this->obtenerPorId($idPrestamos);
        if (!$prestamo) {
            return ["ok" => false, "mensaje" => "No se encontró el préstamo solicitado"];
        }

        $tipo = $prestamo["solicitudTipo"] ?: null;
        $estado = $prestamo["estadoAprobacion"] ?: "Aprobado";

        // Caso 1: Aprobar solicitud de eliminación -> borra el préstamo y sus cuotas relacionadas
        if ($tipo === "eliminar") {
            $eliminado = $this->eliminar($idPrestamos);
            if (!$eliminado) {
                return ["ok" => false, "mensaje" => "No se pudo completar la eliminación del préstamo"];
            }
            return ["ok" => true, "mensaje" => "Solicitud de eliminación aprobada. El préstamo #" . $idPrestamos . " fue eliminado."];
        }

        // Caso 2: Aprobar solicitud de edición -> aplica los valores propuestos, marca como Aprobado y ajusta billetera si aplica
        if ($tipo === "editar" && !empty($prestamo["solicitudDatos"])) {
            $propuestos = json_decode($prestamo["solicitudDatos"], true);
            if (!is_array($propuestos)) {
                return ["ok" => false, "mensaje" => "Los datos de la solicitud de edición no son válidos"];
            }

            $valorAnterior = round((float)$prestamo["ValorPrestamo"], 2);
            $valorNuevo = round((float)$propuestos["ValorPrestamo"], 2);
            $idAsociado = (int)$prestamo["idAsociado"];

            $this->conexion->beginTransaction();
            try {
                $sql = "UPDATE prestamos
                        SET ValorPrestamo = :ValorPrestamo,
                            TasaInteres = :TasaInteres,
                            NumeroCuotas = :NumeroCuotas,
                            FechaPrestamo = :FechaPrestamo,
                            Proposito = :Proposito,
                            estadoAprobacion = 'Aprobado',
                            solicitudTipo = NULL,
                            solicitudDatos = NULL
                        WHERE idPrestamos = :idPrestamos";
                $consulta = $this->conexion->prepare($sql);
                $consulta->execute([
                    ":ValorPrestamo" => $valorNuevo,
                    ":TasaInteres" => $propuestos["TasaInteres"],
                    ":NumeroCuotas" => $propuestos["NumeroCuotas"],
                    ":FechaPrestamo" => $propuestos["FechaPrestamo"],
                    ":Proposito" => $propuestos["Proposito"] ?? $prestamo["Proposito"],
                    ":idPrestamos" => $idPrestamos
                ]);

                // Si el préstamo aún estaba Pendiente (no desembolsado), acredita el monto total aprobado;
                // si ya estaba Aprobado y el monto aumentó, acredita únicamente la diferencia adicional.
                if ($estado === "Pendiente" && $valorNuevo > 0) {
                    $this->acreditarBilletera($idAsociado, $valorNuevo, "Desembolso de préstamo #" . $idPrestamos);
                } elseif ($estado === "Aprobado" && $valorNuevo > $valorAnterior) {
                    $diferencia = round($valorNuevo - $valorAnterior, 2);
                    $this->acreditarBilletera($idAsociado, $diferencia, "Ajuste por ampliación de préstamo #" . $idPrestamos);
                }

                $this->conexion->commit();
            } catch (Throwable $e) {
                if ($this->conexion->inTransaction()) {
                    $this->conexion->rollBack();
                }
                throw $e;
            }

            return ["ok" => true, "mensaje" => "Solicitud de edición aprobada. Los cambios del préstamo #" . $idPrestamos . " fueron aplicados."];
        }

        // Caso 3: Aprobar solicitud de nuevo préstamo pendiente -> marca Aprobado y desembolsa automáticamente en la billetera
        if ($estado === "Pendiente" || $tipo === "crear") {
            $valorPrestamo = round((float)$prestamo["ValorPrestamo"], 2);
            $idAsociado = (int)$prestamo["idAsociado"];

            $this->conexion->beginTransaction();
            try {
                $sql = "UPDATE prestamos
                        SET estadoAprobacion = 'Aprobado',
                            solicitudTipo = NULL,
                            solicitudDatos = NULL
                        WHERE idPrestamos = :idPrestamos";
                $consulta = $this->conexion->prepare($sql);
                $consulta->execute([":idPrestamos" => $idPrestamos]);

                if ($valorPrestamo > 0) {
                    $this->acreditarBilletera(
                        $idAsociado,
                        $valorPrestamo,
                        "Desembolso de préstamo #" . $idPrestamos
                    );
                }

                $this->conexion->commit();
            } catch (Throwable $e) {
                if ($this->conexion->inTransaction()) {
                    $this->conexion->rollBack();
                }
                throw $e;
            }

            return [
                "ok" => true,
                "mensaje" => "Préstamo #" . $idPrestamos . " aprobado y acreditado automáticamente en la billetera del asociado ($ " . number_format($valorPrestamo, 0, ",", ".") . ")."
            ];
        }

        return ["ok" => false, "mensaje" => "Este préstamo ya se encuentra aprobado y no tiene solicitudes pendientes"];
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
