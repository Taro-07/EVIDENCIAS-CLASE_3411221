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
        // Reutiliza la conexión PDO proporcionada si existe; de lo contrario crea una nueva conexión
        if ($conexionDB instanceof PDO) {
            $this->conexion = $conexionDB;
        } else {
            // Instancia la clase Conexion y abre la conexión con MySQL
            $db = new Conexion();
            $this->conexion = $db->conectar();
        }
        // Verifica y crea la columna metaRecaudo en actividades si todavía no existe
        $this->asegurarColumnaMetaRecaudo();
    }

    // Agrega automáticamente la columna metaRecaudo (tope de dinero) en actividades sin alterar registros existentes
    private function asegurarColumnaMetaRecaudo()
    {
        // Consulta INFORMATION_SCHEMA para comprobar si existe la columna metaRecaudo en la BD activa
        $consulta = $this->conexion->prepare(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'actividades'
               AND COLUMN_NAME = 'metaRecaudo'"
        );
        // Ejecuta la verificación de columna
        $consulta->execute();
        // Si el conteo es 0, agrega la columna metaRecaudo aceptando valores nulos
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
        // Sentencia INSERT parametrizada para registrar la nueva actividad
        $sql = "INSERT INTO actividades (nombreActividad, fechaEvento, municipio, metaRecaudo)
                VALUES (:nombreActividad, :fechaEvento, :municipio, :metaRecaudo)";
        // Prepara la sentencia INSERT
        $consulta = $this->conexion->prepare($sql);
        // Ejecuta el INSERT con los valores recibidos (metaRecaudo opcional) y retorna booleano
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
        // Sentencia DELETE filtrada por el ID primario de la actividad
        $sql = "DELETE FROM actividades WHERE idActividad = :idActividad";
        // Prepara la sentencia DELETE
        $consulta = $this->conexion->prepare($sql);
        // Ejecuta el borrado enlazando el parámetro :idActividad
        $consulta->execute([":idActividad" => $idActividad]);
        // Retorna true si se borró al menos una fila o false si no existía el registro
        return $consulta->rowCount() > 0;
    }

    // Actualiza los datos de una actividad existente (incluyendo tope metaRecaudo y totalRecaudado)
    public function editar($datos)
    {
        // Sentencia UPDATE para modificar nombre, fecha, municipio, meta y total recaudado
        $sql = "UPDATE actividades
                SET nombreActividad = :nombreActividad,
                    fechaEvento = :fechaEvento,
                    municipio = :municipio,
                    metaRecaudo = :metaRecaudo,
                    totalRecaudado = :totalRecaudado
                WHERE idActividad = :idActividad";
        // Prepara la sentencia UPDATE
        $consulta = $this->conexion->prepare($sql);
        // Ejecuta el UPDATE con los parámetros del arreglo recibido
        $consulta->execute([
            ":nombreActividad" => $datos['nombreActividad'],
            ":fechaEvento" => $datos['fechaEvento'],
            ":municipio" => $datos['municipio'],
            ":metaRecaudo" => $datos['metaRecaudo'] ?? null,
            ":totalRecaudado" => $datos['totalRecaudado'] ?? null,
            ":idActividad" => $datos['idActividad']
        ]);

        // Si hubo filas modificadas, confirma directamente que la actualización tuvo éxito
        if ($consulta->rowCount() > 0) {
            return true;
        }

        // Si rowCount fue 0 (mismos valores enviados), verifica si el registro existe realmente en la tabla
        $verificar = $this->conexion->prepare("SELECT 1 FROM actividades WHERE idActividad = :idActividad");
        $verificar->execute([":idActividad" => $datos['idActividad']]);

        // Retorna true si la actividad existe aunque no hayan cambiado sus valores, o false si no existe
        return (bool)$verificar->fetchColumn();
    }

    // Registra un abono del asociado a una actividad respetando el tope (metaRecaudo) si está definido
    public function abonarActividad($idActividad, $documento, $monto)
    {
        // Inicia una transacción para bloquear la actividad, actualizar su recaudo e inscribir al asociado atómicamente
        $this->conexion->beginTransaction();
        try {
            // Bloquea la fila de la actividad con FOR UPDATE para evitar sobrepasar el tope ante abonos concurrentes
            $stmtAct = $this->conexion->prepare(
                "SELECT idActividad,
                        COALESCE(totalRecaudado, 0) AS totalRecaudado,
                        metaRecaudo
                 FROM actividades
                 WHERE idActividad = :idActividad
                 FOR UPDATE"
            );
            // Ejecuta la lectura bloqueada por idActividad
            $stmtAct->execute([":idActividad" => $idActividad]);
            $actividad = $stmtAct->fetch();

            // Si la actividad no existe, revierte la transacción y retorna error 404
            if (!$actividad) {
                $this->conexion->rollBack();
                return ["ok" => false, "codigo" => 404, "mensaje" => "No se encontró la actividad seleccionada"];
            }

            // Extrae el monto ya recaudado y el tope de metaRecaudo (si está configurado)
            $recaudadoActual = (float)$actividad["totalRecaudado"];
            $meta = $actividad["metaRecaudo"] !== null ? (float)$actividad["metaRecaudo"] : null;

            // Si existe un tope definido (> 0), comprueba que no se haya alcanzado ni se exceda con este abono
            if ($meta !== null && $meta > 0) {
                // Calcula cuánto falta exactamente para completar la meta
                $faltante = round(max(0, $meta - $recaudadoActual), 2);
                // Si ya no falta nada, revierte la transacción y rechaza el abono
                if ($faltante <= 0) {
                    $this->conexion->rollBack();
                    return ["ok" => false, "codigo" => 400, "mensaje" => "Esta actividad ya alcanzó el tope de recaudo establecido."];
                }
                // Si el monto abonado excede el faltante, revierte e informa el valor exacto pendiente
                if ((float)$monto > $faltante) {
                    $this->conexion->rollBack();
                    return [
                        "ok" => false,
                        "codigo" => 400,
                        "mensaje" => "El abono supera el tope de la actividad. Faltan $ " . number_format($faltante, 0, ",", ".") . " para llegar a la meta."
                    ];
                }
            }

            // Calcula el nuevo total recaudado sumando el abono y redondeando a 2 decimales
            $nuevoTotal = round($recaudadoActual + (float)$monto, 2);
            // Actualiza totalRecaudado en la tabla actividades
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

            // Si se encontró el asociado en la BD, verifica si ya figura en la tabla puente actividades_asociado
            if ($idAsociado !== false) {
                $stmtExiste = $this->conexion->prepare(
                    "SELECT COUNT(*) FROM actividades_asociado
                     WHERE idAsociado = :idAsociado AND idActividad = :idActividad"
                );
                $stmtExiste->execute([
                    ":idAsociado" => (int)$idAsociado,
                    ":idActividad" => $idActividad
                ]);
                // Si no está registrado aún como participante, inserta la relación en actividades_asociado
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

            // Confirma todos los cambios de la transacción y retorna el nuevo total recaudado
            $this->conexion->commit();
            return ["ok" => true, "totalRecaudado" => $nuevoTotal];
        } catch (Throwable $e) {
            // Revierte la transacción ante cualquier excepción inesperada
            if ($this->conexion->inTransaction()) {
                $this->conexion->rollBack();
            }
            // Relanza el error para que sea gestionado por el controlador
            throw $e;
        }
    }
}
