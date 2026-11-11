<?php
require_once __DIR__ . '/../Config/conexion.php';

class Asociado {
    private $documento;
    private $nombres;
    private $apellidos;
    private $DireccionResidencia;
    private $ciudad;
    private $telefono;
    private $email;
    private $genero;
    private $FechaNacimiento;
    private $contrasena;
    private $rol;
    private $conexion;

    public function __construct($datos) {
        $this->documento = $datos['documento'] ?? '';
        $this->nombres = $datos['nombres'] ?? '';
        $this->apellidos = $datos['apellidos'] ?? '';
        $this->DireccionResidencia = $datos['DireccionResidencia'] ?? ($datos['DirecciónResidencia'] ?? '');
        $this->ciudad = $datos['ciudad'] ?? '';
        $this->telefono = $datos['telefono'] ?? '';
        $this->email = $datos['email'] ?? '';
        $this->genero = $datos['genero'] ?? 'Otro';
        $this->FechaNacimiento = $datos['FechaNacimiento'] ?? '';
        $this->contrasena = $datos['contrasena'] ?? ($datos['clave'] ?? ($datos['password'] ?? ''));
        $this->rol = $datos['rol'] ?? ($datos['Rol'] ?? 'Asociado');

        $conexion = new Conexion();
        $this->conexion = $conexion->conectar();
    }

    public function guardar() {
        $params = [
            ":documento" => $this->documento,
            ":nombres" => $this->nombres,
            ":apellidos" => $this->apellidos,
            ":DireccionResidencia" => $this->DireccionResidencia,
            ":ciudad" => $this->ciudad,
            ":telefono" => $this->telefono,
            ":email" => $this->email,
            ":genero" => $this->genero,
            ":FechaNacimiento" => $this->FechaNacimiento,
            ":contrasena" => $this->contrasena,
            ":rol" => $this->rol
        ];

        try {
            $sql = "INSERT INTO asociados (documento, nombres, apellidos, DireccionResidencia, ciudad, telefono, email, genero, FechaNacimiento, contrasena, Rol) VALUES (:documento, :nombres, :apellidos, :DireccionResidencia, :ciudad, :telefono, :email, :genero, :FechaNacimiento, :contrasena, :rol)";
            $consulta = $this->conexion->prepare($sql);
            return $consulta->execute($params);
        } catch (PDOException $e) {
            // Compatibilidad por si la columna en MySQL fue creada con tilde (`direcciónResidencia`)
            if (strpos($e->getMessage(), 'DireccionResidencia') !== false) {
                $sql = "INSERT INTO asociados (documento, nombres, apellidos, `direcciónResidencia`, ciudad, telefono, email, genero, FechaNacimiento, contrasena, Rol) VALUES (:documento, :nombres, :apellidos, :DireccionResidencia, :ciudad, :telefono, :email, :genero, :FechaNacimiento, :contrasena, :rol)";
                $consulta = $this->conexion->prepare($sql);
                return $consulta->execute($params);
            }
            throw $e;
        }
    }
}