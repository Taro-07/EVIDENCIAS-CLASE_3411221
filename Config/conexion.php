<?php

// Clase encargada de gestionar la conexión a la base de datos MySQL mediante PDO
class Conexion{
    // Nombre del servidor donde corre MySQL (local en Laragon)
    private $host = "localhost";
    // Nombre de la base de datos del proyecto
    private $baseDatos = "mr_club";
    // Usuario de acceso a MySQL
    private $user = "root";
    // Contraseña del usuario de MySQL (vacía por defecto en Laragon)
    private $password = "";
    
    // Método público que crea y devuelve el objeto de conexión PDO
    public function conectar(){
        // Construye la cadena de conexión (DSN) indicando motor, host, base de datos y codificación UTF-8
        $dsn = "mysql:host={$this->host};dbname={$this->baseDatos};charset=utf8mb4";

        // Retorna una nueva instancia de PDO con manejo de errores por excepciones y resultados como arreglo asociativo
        return new PDO($dsn, $this->user, $this->password, [
            // Configura PDO para lanzar excepciones PDOException cuando ocurra un error SQL
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            // Configura PDO para devolver cada fila como un array asociativo ['columna' => 'valor']
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }
}
