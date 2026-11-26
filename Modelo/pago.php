<?php

// Importa la clase de conexión PDO a la base de datos
require_once __DIR__ . '/../Config/conexion.php';

// Clase Modelo encargada de gestionar los pagos de cuotas, comprobantes (foto) y su aprobación en pagos_cuotas
class Pago
{
    // Conexión PDO con MySQL
    private $conexion;

    // Constructor: recibe una conexión opcional o abre una nueva y garantiza columnas de comprobante y estado
    public function __construct($conexionDB = null)
    {
        // Reutiliza la conexión PDO recibida si es válida; de lo contrario crea una nueva conexión
        if ($conexionDB instanceof PDO) {
            $this->conexion = $conexionDB;
        } else {
            // Instancia la clase Conexion y abre la conexión con la base de datos
            $db = new Conexion();
            $this->conexion = $db->conectar();
        }
        // Verifica y agrega columnas requeridas en la tabla pagos_cuotas si aún no existen
        $this->asegurarEstructuraPagos();
    }

    // Agrega las columnas comprobante y estadoPago en pagos_cuotas sin afectar pagos ya existentes
    private function asegurarEstructuraPagos()
    {
        // Mapa de columnas requeridas con su sentencia ALTER TABLE correspondiente
        $columnas = [
            "comprobante" => "ALTER TABLE pagos_cuotas ADD COLUMN comprobante VARCHAR(255) DEFAULT NULL",
            "estadoPago" => "ALTER TABLE pagos_cuotas ADD COLUMN estadoPago VARCHAR(20) NOT NULL DEFAULT 'Aprobado'"
        ];

        // Prepara la consulta sobre INFORMATION_SCHEMA para verificar si existe cada columna en la BD actual
        $consulta = $this->conexion->prepare(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'pagos_cuotas'
               AND COLUMN_NAME = :columna"
        );

        // Recorre las columnas definidas y ejecuta el ALTER TABLE únicamente si falta la columna
        foreach ($columnas as $nombre => $sqlAlter) {
            // Ejecuta la verificación de existencia para el nombre de columna actual
            $consulta->execute([":columna" => $nombre]);
            // Si el conteo es 0, la columna no existe y se añade a la tabla
            if ((int)$consulta->fetchColumn() === 0) {
                $this->conexion->exec($sqlAlter);
            }
        }
    }

    // Comprueba si el ID de préstamo indicado existe en la tabla prestamos (clave foránea)
    public function existePrestamo($idPrestamo)
    {
        // Consulta rápida que devuelve 1 si existe un préstamo con el ID indicado
        $consulta = $this->conexion->prepare("SELECT 1 FROM prestamos WHERE idPrestamos = :idPrestamo LIMIT 1");
        // Ejecuta la consulta enlazando el parámetro :idPrestamo
        $consulta->execute([":idPrestamo" => $idPrestamo]);
        // Retorna true si se encontró coincidencia o false si no existe
        return (bool)$consulta->fetchColumn();
    }

    // Verifica que el préstamo pertenezca al asociado autenticado (seguridad para rol Asociado)
    public function prestamoPerteneceADocumento($idPrestamo, $documento)
    {
        // Consulta con INNER JOIN entre prestamos y asociados filtrando por ID de préstamo y documento
        $sql = "SELECT 1
                FROM prestamos p
                INNER JOIN asociados a ON a.idAsociado = p.idAsociado
                WHERE p.idPrestamos = :idPrestamo AND a.documento = :documento
                LIMIT 1";
        // Prepara la consulta parametrizada
        $consulta = $this->conexion->prepare($sql);
        // Ejecuta pasando el ID del préstamo y el documento del asociado
        $consulta->execute([
            ":idPrestamo" => $idPrestamo,
            ":documento" => $documento
        ]);
        // Retorna true si el préstamo pertenece al asociado; false en caso contrario
        return (bool)$consulta->fetchColumn();
    }

    // Lista los préstamos del asociado junto con el total abonado APROBADO para calcular saldo real y progreso
    public function obtenerPrestamosConSaldoPorDocumento($documento)
    {
        // Consulta cada préstamo del asociado sumando únicamente los pagos con estadoPago = 'Aprobado'
        $sql = "SELECT p.idPrestamos,
                       p.ValorPrestamo,
                       p.TasaInteres,
                       p.NumeroCuotas,
                       p.FechaPrestamo,
                       COALESCE(SUM(CASE WHEN pc.estadoPago = 'Aprobado' THEN pc.ValorCuota ELSE 0 END), 0) AS totalAbonado
                FROM prestamos p
                INNER JOIN asociados a ON a.idAsociado = p.idAsociado
                LEFT JOIN pagos_cuotas pc ON pc.idPrestamo = p.idPrestamos
                WHERE a.documento = :documento
                GROUP BY p.idPrestamos, p.ValorPrestamo, p.TasaInteres, p.NumeroCuotas, p.FechaPrestamo
                ORDER BY p.idPrestamos DESC";
        // Prepara la consulta SQL
        $consulta = $this->conexion->prepare($sql);
        // Ejecuta filtrando por el documento del asociado
        $consulta->execute([":documento" => $documento]);
        // Retorna todas las filas encontradas con el total abonado calculado
        return $consulta->fetchAll();
    }

    // Valida que la ruta de comprobante exista en Assets/comprobantes/ antes de devolverla al navegador
    private function formatearComprobantes(array $filas): array
    {
        // Recorre por referencia cada registro de pago para normalizar estadoPago y ruta de comprobante
        foreach ($filas as &$fila) {
            // Asigna 'Aprobado' por defecto si estadoPago viene vacío o nulo
            $fila["estadoPago"] = $fila["estadoPago"] ?: "Aprobado";
            // Verifica si el registro tiene una ruta de comprobante almacenada
            if (!empty($fila["comprobante"])) {
                // Extrae solo el nombre base del archivo para evitar rutas relativas maliciosas
                $archivo = basename($fila["comprobante"]);
                // Comprueba si el archivo físico existe en la carpeta Assets/comprobantes/
                if (is_file(__DIR__ . '/../Assets/comprobantes/' . $archivo)) {
                    // Asigna la ruta relativa pública que consumirá el navegador
                    $fila["comprobante"] = "../Assets/comprobantes/" . $archivo;
                } else {
                    // Si el archivo no existe en disco, devuelve null
                    $fila["comprobante"] = null;
                }
            } else {
                // Si no hay comprobante registrado, normaliza el valor a null
                $fila["comprobante"] = null;
            }
        }
        // Rompe la referencia del bucle foreach para evitar efectos secundarios
        unset($fila);
        // Retorna el arreglo de pagos ya formateado
        return $filas;
    }

    // Obtiene únicamente los comprobantes de pago pertenecientes a los préstamos del asociado autenticado
    public function obtenerPorDocumento($documento)
    {
        // Consulta pagos_cuotas unidos con prestamos y asociados filtrados por el documento del asociado
        $sql = "SELECT pc.idPago, pc.ValorCuota, pc.FechaPago, pc.idPrestamo,
                       pc.comprobante, pc.estadoPago,
                       p.ValorPrestamo, a.documento,
                       TRIM(CONCAT(COALESCE(a.nombres, ''), ' ', COALESCE(a.apellidos, ''))) AS nombreAsociado
                FROM pagos_cuotas pc
                INNER JOIN prestamos p ON p.idPrestamos = pc.idPrestamo
                INNER JOIN asociados a ON a.idAsociado = p.idAsociado
                WHERE a.documento = :documento
                ORDER BY pc.idPago DESC";
        // Prepara la sentencia SQL
        $consulta = $this->conexion->prepare($sql);
        // Ejecuta la consulta con el documento del asociado
        $consulta->execute([":documento" => $documento]);
        // Formatea y valida las rutas de comprobantes antes de retornar el listado
        return $this->formatearComprobantes($consulta->fetchAll());
    }

    // Lista los préstamos registrados junto al nombre y documento del asociado
    public function obtenerPrestamosDisponibles()
    {
        // Consulta todos los préstamos con los datos básicos del asociado dueño de cada préstamo
        $sql = "SELECT p.idPrestamos, p.ValorPrestamo, p.FechaPrestamo,
                       a.documento,
                       TRIM(CONCAT(COALESCE(a.nombres, ''), ' ', COALESCE(a.apellidos, ''))) AS nombreAsociado
                FROM prestamos p
                INNER JOIN asociados a ON a.idAsociado = p.idAsociado
                ORDER BY p.idPrestamos DESC";
        // Prepara la consulta SQL
        $consulta = $this->conexion->prepare($sql);
        // Ejecuta la consulta sin parámetros
        $consulta->execute();
        // Retorna el listado completo de préstamos
        return $consulta->fetchAll();
    }

    // Obtiene todos los pagos de cuotas (priorizando primero los Pendientes por verificar para el Admin)
    public function obtenerTodos()
    {
        // Consulta todos los pagos ordenando primero los 'Pendiente', luego por fecha e ID descendente
        $sql = "SELECT pc.idPago, pc.ValorCuota, pc.FechaPago, pc.idPrestamo,
                       pc.comprobante, pc.estadoPago,
                       p.ValorPrestamo, a.documento,
                       TRIM(CONCAT(COALESCE(a.nombres, ''), ' ', COALESCE(a.apellidos, ''))) AS nombreAsociado
                FROM pagos_cuotas pc
                INNER JOIN prestamos p ON p.idPrestamos = pc.idPrestamo
                INNER JOIN asociados a ON a.idAsociado = p.idAsociado
                ORDER BY
                    CASE WHEN pc.estadoPago = 'Pendiente' THEN 0 ELSE 1 END ASC,
                    pc.FechaPago DESC,
                    pc.idPago DESC";
        // Prepara la sentencia SQL
        $consulta = $this->conexion->prepare($sql);
        // Ejecuta la consulta
        $consulta->execute();
        // Valida y normaliza las rutas de comprobantes antes de devolver las filas
        return $this->formatearComprobantes($consulta->fetchAll());
    }

    // Registra un nuevo pago de cuota con comprobante fotográfico en estado Pendiente de verificación
    public function guardar($datos)
    {
        // Sentencia INSERT para almacenar el pago junto con su comprobante y estado inicial
        $sql = "INSERT INTO pagos_cuotas (ValorCuota, FechaPago, idPrestamo, comprobante, estadoPago)
                VALUES (:ValorCuota, :FechaPago, :idPrestamo, :comprobante, :estadoPago)";
        // Prepara la inserción parametrizada
        $consulta = $this->conexion->prepare($sql);
        // Ejecuta el INSERT con los datos recibidos (por defecto comprobante=null y estadoPago='Pendiente') y retorna booleano
        return $consulta->execute([
            ":ValorCuota" => $datos['ValorCuota'],
            ":FechaPago" => $datos['FechaPago'],
            ":idPrestamo" => $datos['idPrestamo'],
            ":comprobante" => $datos['comprobante'] ?? null,
            ":estadoPago" => $datos['estadoPago'] ?? 'Pendiente'
        ]);
    }

    // Aprueba un comprobante de pago pendiente (acción exclusiva del Administrador)
    public function aprobarPago($idPago)
    {
        // Consulta el estado actual del pago para validar que exista y no esté ya aprobado
        $verificar = $this->conexion->prepare("SELECT estadoPago FROM pagos_cuotas WHERE idPago = :idPago LIMIT 1");
        // Ejecuta la consulta de verificación por idPago
        $verificar->execute([":idPago" => $idPago]);
        // Obtiene el valor de la columna estadoPago (o false si no existe el registro)
        $estadoActual = $verificar->fetchColumn();

        // Si el pago no existe en la tabla, retorna error con código HTTP 404
        if ($estadoActual === false) {
            return ["ok" => false, "codigo" => 404, "mensaje" => "No se encontró el pago especificado"];
        }

        // Si el pago ya estaba aprobado, evita aprobarlo de nuevo y retorna error 400
        if ($estadoActual === "Aprobado") {
            return ["ok" => false, "codigo" => 400, "mensaje" => "Este comprobante ya fue aprobado anteriormente"];
        }

        // Prepara la actualización del estado del pago a 'Aprobado'
        $actualizar = $this->conexion->prepare("UPDATE pagos_cuotas SET estadoPago = 'Aprobado' WHERE idPago = :idPago");
        // Ejecuta el UPDATE para el idPago indicado
        $actualizar->execute([":idPago" => $idPago]);

        // Retorna confirmación de aprobación exitosa con mensaje descriptivo
        return ["ok" => true, "mensaje" => "Comprobante de pago #" . $idPago . " verificado y aprobado correctamente."];
    }

    // Elimina un pago de cuota según su idPago
    public function eliminar($idPago)
    {
        // Sentencia DELETE para borrar el pago por su clave primaria
        $sql = "DELETE FROM pagos_cuotas WHERE idPago = :idPago";
        // Prepara la sentencia DELETE
        $consulta = $this->conexion->prepare($sql);
        // Ejecuta la eliminación enlazando :idPago
        $consulta->execute([":idPago" => $idPago]);
        // Retorna true si se eliminó al menos una fila, o false si el ID no existía
        return $consulta->rowCount() > 0;
    }
}
