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
        // Usa la conexión PDO inyectada si es válida; en caso contrario abre una nueva conexión
        if ($conexionDB instanceof PDO) {
            $this->conexion = $conexionDB;
        } else {
            // Crea una instancia de Conexion y obtiene el objeto PDO
            $db = new Conexion();
            $this->conexion = $db->conectar();
        }
        // Asegura que las tablas y columnas requeridas para préstamos y billetera existan en la BD
        $this->asegurarEstructuraPrestamos();
    }

    // Verifica y crea columnas adicionales en prestamos y la estructura de billetera en asociados sin afectar datos previos
    private function asegurarEstructuraPrestamos()
    {
        // Lista de columnas adicionales necesarias en la tabla prestamos con su respectivo ALTER TABLE
        $columnas = [
            "Proposito" => "ALTER TABLE prestamos ADD COLUMN Proposito VARCHAR(255) DEFAULT NULL",
            "estadoAprobacion" => "ALTER TABLE prestamos ADD COLUMN estadoAprobacion VARCHAR(30) NOT NULL DEFAULT 'Aprobado'",
            "solicitudTipo" => "ALTER TABLE prestamos ADD COLUMN solicitudTipo VARCHAR(20) DEFAULT NULL",
            "solicitudDatos" => "ALTER TABLE prestamos ADD COLUMN solicitudDatos TEXT DEFAULT NULL"
        ];

        // Consulta en INFORMATION_SCHEMA para comprobar si existe cada columna en la tabla prestamos
        $consulta = $this->conexion->prepare(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'prestamos'
               AND COLUMN_NAME = :columna"
        );

        // Recorre el mapa de columnas y agrega las que aún no existan en la tabla
        foreach ($columnas as $nombre => $sqlAlter) {
            // Verifica la existencia de la columna actual
            $consulta->execute([":columna" => $nombre]);
            // Si no existe (conteo 0), ejecuta la sentencia ALTER TABLE
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
        // Ejecuta la verificación de la columna saldoBilletera
        $consultaSaldo->execute();
        // Si la columna no existe en asociados, la crea con valor inicial 0.00
        if ((int)$consultaSaldo->fetchColumn() === 0) {
            $this->conexion->exec("ALTER TABLE asociados ADD COLUMN saldoBilletera DECIMAL(14,2) NOT NULL DEFAULT 0.00");
        }

        // Crea la tabla movimientos_billetera con llave foránea hacia asociados si todavía no existe
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
        // Bloquea la fila del asociado con FOR UPDATE para evitar condiciones de carrera al actualizar el saldo
        $stmtLock = $this->conexion->prepare(
            "SELECT saldoBilletera FROM asociados WHERE idAsociado = :idAsociado FOR UPDATE"
        );
        // Ejecuta el bloqueo leyendo el saldo actual del asociado
        $stmtLock->execute([":idAsociado" => $idAsociado]);
        // Convierte y redondea el saldo actual y calcula el nuevo saldo sumando el monto acreditado
        $saldoActual = round((float)$stmtLock->fetchColumn(), 2);
        $nuevoSaldo = round($saldoActual + $monto, 2);

        // Prepara la actualización del nuevo saldo en la tabla asociados
        $stmtUpd = $this->conexion->prepare(
            "UPDATE asociados SET saldoBilletera = :saldo WHERE idAsociado = :idAsociado"
        );
        // Ejecuta el UPDATE del saldo de billetera
        $stmtUpd->execute([
            ":saldo" => $nuevoSaldo,
            ":idAsociado" => $idAsociado
        ]);

        // Prepara la inserción del movimiento de tipo 'recarga' en el historial movimientos_billetera
        $stmtMov = $this->conexion->prepare(
            "INSERT INTO movimientos_billetera (idAsociado, tipo, monto, descripcion, saldoResultante)
             VALUES (:idAsociado, 'recarga', :monto, :descripcion, :saldoResultante)"
        );
        // Ejecuta la inserción dejando trazabilidad del monto, motivo y saldo resultante
        $stmtMov->execute([
            ":idAsociado" => $idAsociado,
            ":monto" => round($monto, 2),
            ":descripcion" => $descripcion,
            ":saldoResultante" => $nuevoSaldo
        ]);

        // Retorna el nuevo saldo acumulado en la billetera del asociado
        return $nuevoSaldo;
    }

    // Busca el idAsociado en la tabla asociados a partir de su número de documento
    public function buscarIdAsociadoPorDocumento($documento)
    {
        // Prepara la consulta para localizar el idAsociado por número de documento
        $consulta = $this->conexion->prepare("SELECT idAsociado FROM asociados WHERE documento = :documento LIMIT 1");
        // Ejecuta la búsqueda con el documento recibido
        $consulta->execute([":documento" => $documento]);
        // Obtiene el resultado escalar de la primera columna
        $id = $consulta->fetchColumn();
        // Retorna el ID convertido a entero si existe, o null si no se encontró
        return $id !== false ? (int)$id : null;
    }

    // Decodifica el JSON de solicitudDatos si existe para enviarlo estructurado al frontend
    private function formatearFilas(array $filas): array
    {
        // Itera cada préstamo por referencia para normalizar estados y decodificar datos propuestos
        foreach ($filas as &$fila) {
            // Establece 'Aprobado' por defecto si estadoAprobacion está vacío
            $fila["estadoAprobacion"] = $fila["estadoAprobacion"] ?: "Aprobado";
            // Normaliza solicitudTipo a null cuando no hay solicitud pendiente
            $fila["solicitudTipo"] = $fila["solicitudTipo"] ?: null;
            // Si solicitudDatos contiene JSON, lo convierte a arreglo asociativo; si falla o está vacío usa null
            if (!empty($fila["solicitudDatos"])) {
                $decodificado = json_decode($fila["solicitudDatos"], true);
                $fila["solicitudDatos"] = is_array($decodificado) ? $decodificado : null;
            } else {
                $fila["solicitudDatos"] = null;
            }
        }
        // Libera la referencia del bucle foreach
        unset($fila);
        // Retorna las filas listas para serializar en JSON
        return $filas;
    }

    // Obtiene todos los préstamos (priorizando las solicitudes pendientes de aprobación primero)
    public function obtenerTodos()
    {
        // Consulta todos los préstamos con datos del asociado, ordenando primero los pendientes o con solicitud activa
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
        // Prepara y ejecuta la consulta
        $consulta = $this->conexion->prepare($sql);
        $consulta->execute();
        // Formatea las filas decodificando solicitudDatos y las retorna
        return $this->formatearFilas($consulta->fetchAll());
    }

    // Obtiene únicamente los préstamos pertenecientes al asociado autenticado por su documento
    public function obtenerPorDocumento($documento)
    {
        // Consulta los préstamos del asociado filtrando por su documento en orden descendente por ID
        $sql = "SELECT p.idPrestamos, p.idAsociado, a.documento,
                       TRIM(CONCAT(COALESCE(a.nombres, ''), ' ', COALESCE(a.apellidos, ''))) AS nombreAsociado,
                       p.ValorPrestamo, p.NumeroCuotas, p.TasaInteres, p.FechaPrestamo, p.Proposito,
                       p.estadoAprobacion, p.solicitudTipo, p.solicitudDatos
                FROM prestamos p
                INNER JOIN asociados a ON a.idAsociado = p.idAsociado
                WHERE a.documento = :documento
                ORDER BY p.idPrestamos DESC";
        // Prepara la sentencia SQL
        $consulta = $this->conexion->prepare($sql);
        // Ejecuta pasando el documento del asociado
        $consulta->execute([":documento" => $documento]);
        // Retorna los préstamos del asociado ya formateados
        return $this->formatearFilas($consulta->fetchAll());
    }

    // Obtiene los datos básicos (documento y nombre) del asociado autenticado
    public function obtenerResumenAsociado($documento)
    {
        // Consulta el documento y el nombre completo concatenado del asociado
        $sql = "SELECT documento,
                       TRIM(CONCAT(COALESCE(nombres, ''), ' ', COALESCE(apellidos, ''))) AS nombreCompleto
                FROM asociados
                WHERE documento = :documento
                LIMIT 1";
        // Prepara y ejecuta la búsqueda por documento
        $consulta = $this->conexion->prepare($sql);
        $consulta->execute([":documento" => $documento]);
        // Recupera la fila encontrada (o false si no existe)
        $fila = $consulta->fetch();
        // Retorna el arreglo del asociado o null si no se encontró
        return $fila !== false ? $fila : null;
    }

    // Obtiene un préstamo específico por ID (para validar propiedad o procesar aprobación)
    public function obtenerPorId($idPrestamos)
    {
        // Consulta los detalles completos de un préstamo junto al documento de su titular
        $sql = "SELECT p.idPrestamos, p.idAsociado, a.documento,
                       p.ValorPrestamo, p.NumeroCuotas, p.TasaInteres, p.FechaPrestamo, p.Proposito,
                       p.estadoAprobacion, p.solicitudTipo, p.solicitudDatos
                FROM prestamos p
                INNER JOIN asociados a ON a.idAsociado = p.idAsociado
                WHERE p.idPrestamos = :idPrestamos
                LIMIT 1";
        // Prepara y ejecuta la consulta por clave primaria del préstamo
        $consulta = $this->conexion->prepare($sql);
        $consulta->execute([":idPrestamos" => $idPrestamos]);
        // Obtiene el registro o false si no existe
        $fila = $consulta->fetch();
        // Retorna la fila encontrada o null
        return $fila !== false ? $fila : null;
    }

    // Inserta una nueva solicitud de préstamo creada por el Asociado (en estado Pendiente hasta aprobación del Admin)
    public function guardarSolicitudCreacion($datos)
    {
        // Inserta el préstamo marcado como estadoAprobacion='Pendiente' y solicitudTipo='crear'
        $sql = "INSERT INTO prestamos
                    (ValorPrestamo, TasaInteres, NumeroCuotas, FechaPrestamo, idAsociado, Proposito, estadoAprobacion, solicitudTipo, solicitudDatos)
                VALUES
                    (:ValorPrestamo, :TasaInteres, :NumeroCuotas, :FechaPrestamo, :idAsociado, :Proposito, 'Pendiente', 'crear', NULL)";
        // Prepara la sentencia INSERT
        $consulta = $this->conexion->prepare($sql);
        // Ejecuta la inserción con los parámetros validados y retorna true/false según el resultado
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
        // Consulta el préstamo y verifica que exista y pertenezca al documento del asociado solicitante
        $prestamo = $this->obtenerPorId($idPrestamos);
        if (!$prestamo || (string)$prestamo["documento"] !== (string)$documento) {
            return false;
        }

        // Serializa en JSON los nuevos valores propuestos para almacenarlos temporalmente en solicitudDatos
        $jsonDatos = json_encode([
            "ValorPrestamo" => $datosPropuestos["ValorPrestamo"],
            "TasaInteres" => $datosPropuestos["TasaInteres"],
            "NumeroCuotas" => $datosPropuestos["NumeroCuotas"],
            "FechaPrestamo" => $datosPropuestos["FechaPrestamo"],
            "Proposito" => $datosPropuestos["Proposito"]
        ], JSON_UNESCAPED_UNICODE);

        // Actualiza el préstamo marcando solicitudTipo='editar' y guardando el JSON sin sobrescribir aún los valores reales
        $sql = "UPDATE prestamos
                SET solicitudTipo = 'editar',
                    solicitudDatos = :solicitudDatos
                WHERE idPrestamos = :idPrestamos";
        // Prepara y ejecuta la actualización de la solicitud
        $consulta = $this->conexion->prepare($sql);
        return $consulta->execute([
            ":solicitudDatos" => $jsonDatos,
            ":idPrestamos" => $idPrestamos
        ]);
    }

    // Registra una solicitud de eliminación de un préstamo propio del Asociado sin borrarlo aún
    public function solicitarEliminacionPropia($idPrestamos, $documento)
    {
        // Comprueba que el préstamo exista y pertenezca al asociado que solicita eliminarlo
        $prestamo = $this->obtenerPorId($idPrestamos);
        if (!$prestamo || (string)$prestamo["documento"] !== (string)$documento) {
            return false;
        }

        // Marca la solicitud pendiente como 'eliminar' y limpia solicitudDatos
        $sql = "UPDATE prestamos
                SET solicitudTipo = 'eliminar',
                    solicitudDatos = NULL
                WHERE idPrestamos = :idPrestamos";
        // Prepara y ejecuta el UPDATE devolviendo el estado booleano
        $consulta = $this->conexion->prepare($sql);
        return $consulta->execute([":idPrestamos" => $idPrestamos]);
    }

    // Aprueba una solicitud pendiente (creación, edición o eliminación) únicamente ejecutado por el Administrador
    public function aprobarSolicitud($idPrestamos)
    {
        // Busca el préstamo actual en base de datos para inspeccionar su estado y tipo de solicitud
        $prestamo = $this->obtenerPorId($idPrestamos);
        if (!$prestamo) {
            return ["ok" => false, "mensaje" => "No se encontró el préstamo solicitado"];
        }

        // Extrae el tipo de solicitud pendiente (crear, editar, eliminar o null) y el estado de aprobación actual
        $tipo = $prestamo["solicitudTipo"] ?: null;
        $estado = $prestamo["estadoAprobacion"] ?: "Aprobado";

        // Caso 1: Aprobar solicitud de eliminación -> borra el préstamo y sus cuotas relacionadas
        if ($tipo === "eliminar") {
            // Ejecuta la eliminación transaccional del préstamo y sus cuotas
            $eliminado = $this->eliminar($idPrestamos);
            // Si no se pudo borrar el registro, retorna respuesta de error
            if (!$eliminado) {
                return ["ok" => false, "mensaje" => "No se pudo completar la eliminación del préstamo"];
            }
            // Retorna confirmación de eliminación aprobada
            return ["ok" => true, "mensaje" => "Solicitud de eliminación aprobada. El préstamo #" . $idPrestamos . " fue eliminado."];
        }

        // Caso 2: Aprobar solicitud de edición -> aplica los valores propuestos, marca como Aprobado y ajusta billetera si aplica
        if ($tipo === "editar" && !empty($prestamo["solicitudDatos"])) {
            // Decodifica el JSON de cambios propuestos por el asociado
            $propuestos = json_decode($prestamo["solicitudDatos"], true);
            // Valida que el JSON decodificado sea un arreglo correcto
            if (!is_array($propuestos)) {
                return ["ok" => false, "mensaje" => "Los datos de la solicitud de edición no son válidos"];
            }

            // Calcula el valor anterior y nuevo del préstamo junto con el ID del asociado para evaluar desembolso/ajuste
            $valorAnterior = round((float)$prestamo["ValorPrestamo"], 2);
            $valorNuevo = round((float)$propuestos["ValorPrestamo"], 2);
            $idAsociado = (int)$prestamo["idAsociado"];

            // Inicia una transacción atómica para actualizar el préstamo y acreditar billetera conjuntamente
            $this->conexion->beginTransaction();
            try {
                // Aplica definitivamente los campos propuestos, marca como 'Aprobado' y limpia los campos de solicitud
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
                // Prepara y ejecuta la actualización del préstamo
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

                // Confirma todos los cambios de la transacción en MySQL
                $this->conexion->commit();
            } catch (Throwable $e) {
                // Revierte la transacción si ocurrió cualquier error para mantener consistencia
                if ($this->conexion->inTransaction()) {
                    $this->conexion->rollBack();
                }
                // Relanza la excepción para que sea manejada por el controlador
                throw $e;
            }

            // Retorna éxito confirmando que la edición fue aplicada
            return ["ok" => true, "mensaje" => "Solicitud de edición aprobada. Los cambios del préstamo #" . $idPrestamos . " fueron aplicados."];
        }

        // Caso 3: Aprobar solicitud de nuevo préstamo pendiente -> marca Aprobado y desembolsa automáticamente en la billetera
        if ($estado === "Pendiente" || $tipo === "crear") {
            // Obtiene el monto total del préstamo a desembolsar y el ID del asociado beneficiario
            $valorPrestamo = round((float)$prestamo["ValorPrestamo"], 2);
            $idAsociado = (int)$prestamo["idAsociado"];

            // Inicia transacción para garantizar que la aprobación y el desembolso ocurran de forma atómica
            $this->conexion->beginTransaction();
            try {
                // Cambia el estado del préstamo a 'Aprobado' y limpia la marca de solicitud pendiente
                $sql = "UPDATE prestamos
                        SET estadoAprobacion = 'Aprobado',
                            solicitudTipo = NULL,
                            solicitudDatos = NULL
                        WHERE idPrestamos = :idPrestamos";
                // Prepara y ejecuta el UPDATE del estado
                $consulta = $this->conexion->prepare($sql);
                $consulta->execute([":idPrestamos" => $idPrestamos]);

                // Si el monto del préstamo es mayor a cero, lo acredita automáticamente en la billetera del asociado
                if ($valorPrestamo > 0) {
                    $this->acreditarBilletera(
                        $idAsociado,
                        $valorPrestamo,
                        "Desembolso de préstamo #" . $idPrestamos
                    );
                }

                // Confirma la transacción completa
                $this->conexion->commit();
            } catch (Throwable $e) {
                // Revierte la transacción en caso de fallo
                if ($this->conexion->inTransaction()) {
                    $this->conexion->rollBack();
                }
                // Relanza la excepción hacia el nivel superior
                throw $e;
            }

            // Retorna mensaje de éxito indicando el monto formateado que fue acreditado en la billetera
            return [
                "ok" => true,
                "mensaje" => "Préstamo #" . $idPrestamos . " aprobado y acreditado automáticamente en la billetera del asociado ($ " . number_format($valorPrestamo, 0, ",", ".") . ")."
            ];
        }

        // Si no cumplía ninguno de los 3 casos, el préstamo ya estaba aprobado y sin solicitudes pendientes
        return ["ok" => false, "mensaje" => "Este préstamo ya se encuentra aprobado y no tiene solicitudes pendientes"];
    }

    // Elimina un préstamo según su idPrestamos (eliminando antes sus pagos de cuotas en una transacción segura)
    public function eliminar($idPrestamos)
    {
        try {
            // Inicia una transacción para borrar primero las cuotas hijas y luego el préstamo padre
            $this->conexion->beginTransaction();

            // Elimina todos los pagos de cuotas asociados al préstamo para respetar integridad referencial
            $eliminarCuotas = $this->conexion->prepare("DELETE FROM pagos_cuotas WHERE idPrestamo = :idPrestamos");
            $eliminarCuotas->execute([":idPrestamos" => $idPrestamos]);

            // Elimina el registro principal del préstamo
            $eliminarPrestamo = $this->conexion->prepare("DELETE FROM prestamos WHERE idPrestamos = :idPrestamos");
            $eliminarPrestamo->execute([":idPrestamos" => $idPrestamos]);
            // Verifica si efectivamente se borró al menos una fila de prestamos
            $eliminado = $eliminarPrestamo->rowCount() > 0;

            // Confirma la transacción y retorna el resultado booleano
            $this->conexion->commit();
            return $eliminado;
        } catch (Throwable $e) {
            // Deshace los borrados si ocurre cualquier error durante la transacción
            if ($this->conexion->inTransaction()) {
                $this->conexion->rollBack();
            }
            // Relanza la excepción para que la capture el endpoint
            throw $e;
        }
    }
}
