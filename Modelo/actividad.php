<?php

// Importa la clase de conexión a la base de datos MySQL
require_once __DIR__ . '/../Config/conexion.php';

// Clase Modelo encargada de las operaciones CRUD sobre la tabla actividades
class Actividad
{
    // Almacena el objeto PDO de conexión a la base de datos
    private $conexion;

    // Constructor: acepta una conexión PDO existente o crea una nueva y garantiza la columna metaRecaudo
    public function __construct($conexionDB = null)
    {
        if ($conexionDB instanceof PDO) {
            $this->conexion = $conexionDB;
        } else {
            $db = new Conexion();
            $this->conexion = $db->conectar();
        }
        $this->asegurarColumnaMetaRecaudo();
    }

    // Agrega automáticamente la columna metaRecaudo (tope de dinero) en actividades sin alterar registros existentes
    private function asegurarColumnaMetaRecaudo()
    {
        $consulta = $this->conexion->prepare(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'actividades'
               AND COLUMN_NAME = 'metaRecaudo'"
        );
        $consulta->execute();
        if ((int)$consulta->fetchColumn() === 0) {
            $this->conexion->exec("ALTER TABLE actividades ADD COLUMN metaRecaudo DECIMAL(14,2) DEFAULT NULL");
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

    // Inserta una nueva actividad en la tabla actividades incluyendo su tope de monto (metaRecaudo)
    public function guardar($datos)
    {
        $sql = "INSERT INTO actividades (nombreActividad, fechaEvento, municipio, metaRecaudo)
                VALUES (:nombreActividad, :fechaEvento, :municipio, :metaRecaudo)";
        $consulta = $this->conexion->prepare($sql);
        return $consulta->execute([
            ":nombreActividad" => $datos['nombreActividad'],
            ":fechaEvento" => $datos['fechaEvento'],
            ":municipio" => $datos['municipio'],
            ":metaRecaudo" => $datos['metaRecaudo'] ?? null
        ]);
    }

    // Elimina una actividad de la base de datos según su idActividad
    public function eliminar($idActividad)
    {
        $sql = "DELETE FROM actividades WHERE idActividad = :idActividad";
        $consulta = $this->conexion->prepare($sql);
        $consulta->execute([":idActividad" => $idActividad]);
        return $consulta->rowCount() > 0;
    }

    // Actualiza los datos de una actividad existente (incluyendo tope metaRecaudo y totalRecaudado)
    public function editar($datos)
    {
        $sql = "UPDATE actividades
                SET nombreActividad = :nombreActividad,
                    fechaEvento = :fechaEvento,
                    municipio = :municipio,
                    metaRecaudo = :metaRecaudo,
                    totalRecaudado = :totalRecaudado
                WHERE idActividad = :idActividad";
        $consulta = $this->conexion->prepare($sql);
        $consulta->execute([
            ":nombreActividad" => $datos['nombreActividad'],
            ":fechaEvento" => $datos['fechaEvento'],
            ":municipio" => $datos['municipio'],
            ":metaRecaudo" => $datos['metaRecaudo'] ?? null,
            ":totalRecaudado" => $datos['totalRecaudado'] ?? null,
            ":idActividad" => $datos['idActividad']
        ]);

        if ($consulta->rowCount() > 0) {
            return true;
        }

        $verificar = $this->conexion->prepare("SELECT 1 FROM actividades WHERE idActividad = :idActividad");
        $verificar->execute([":idActividad" => $datos['idActividad']]);

        return (bool)$verificar->fetchColumn();
    }

    // Registra un abono del asociado a una actividad respetando el tope (metaRecaudo) si está definido
    public function abonarActividad($idActividad, $documento, $monto)
    {
        $this->conexion->beginTransaction();
        try {
            $stmtAct = $this->conexion->prepare(
                "SELECT idActividad,
                        COALESCE(totalRecaudado, 0) AS totalRecaudado,
                        metaRecaudo
                 FROM actividades
                 WHERE idActividad = :idActividad
                 FOR UPDATE"
            );
            $stmtAct->execute([":idActividad" => $idActividad]);
            $actividad = $stmtAct->fetch();

            if (!$actividad) {
                $this->conexion->rollBack();
                return ["ok" => false, "codigo" => 404, "mensaje" => "No se encontró la actividad seleccionada"];
            }

            $recaudadoActual = (float)$actividad["totalRecaudado"];
            $meta = $actividad["metaRecaudo"] !== null ? (float)$actividad["metaRecaudo"] : null;

            if ($meta !== null && $meta > 0) {
                $faltante = round(max(0, $meta - $recaudadoActual), 2);
                if ($faltante <= 0) {
                    $this->conexion->rollBack();
                    return ["ok" => false, "codigo" => 400, "mensaje" => "Esta actividad ya alcanzó el tope de recaudo establecido."];
                }
                if ((float)$monto > $faltante) {
                    $this->conexion->rollBack();
                    return [
                        "ok" => false,
                        "codigo" => 400,
                        "mensaje" => "El abono supera el tope de la actividad. Faltan $ " . number_format($faltante, 0, ",", ".") . " para llegar a la meta."
                    ];
                }
            }

            $nuevoTotal = round($recaudadoActual + (float)$monto, 2);
            $stmtUpd = $this->conexion->prepare(
                "UPDATE actividades SET totalRecaudado = :total WHERE idActividad = :idActividad"
            );
            $stmtUpd->execute([
                ":total" => $nuevoTotal,
                ":idActividad" => $idActividad
            ]);

            // Registra al asociado como participante de la actividad si aún no estaba inscrito
            $stmtAsoc = $this->conexion->prepare("SELECT idAsociado FROM asociados WHERE documento = :documento LIMIT 1");
            $stmtAsoc->execute([":documento" => $documento]);
            $idAsociado = $stmtAsoc->fetchColumn();

            if ($idAsociado !== false) {
                $stmtExiste = $this->conexion->prepare(
                    "SELECT COUNT(*) FROM actividades_asociado
                     WHERE idAsociado = :idAsociado AND idActividad = :idActividad"
                );
                $stmtExiste->execute([
                    ":idAsociado" => (int)$idAsociado,
                    ":idActividad" => $idActividad
                ]);
                if ((int)$stmtExiste->fetchColumn() === 0) {
                    $stmtPart = $this->conexion->prepare(
                        "INSERT INTO actividades_asociado (idAsociado, idActividad)
                         VALUES (:idAsociado, :idActividad)"
                    );
                    $stmtPart->execute([
                        ":idAsociado" => (int)$idAsociado,
                        ":idActividad" => $idActividad
                    ]);
                }
            }

            $this->conexion->commit();
            return ["ok" => true, "totalRecaudado" => $nuevoTotal];
        } catch (Throwable $e) {
            if ($this->conexion->inTransaction()) {
                $this->conexion->rollBack();
            }
            throw $e;
        }
    }
}
