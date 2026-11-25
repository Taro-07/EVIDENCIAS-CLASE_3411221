// Se ejecuta automáticamente cuando todo el HTML del panel principal ha terminado de cargar
document.addEventListener('DOMContentLoaded', () => {
    // Lee en localStorage si el usuario inició sesión correctamente
    const logueado = localStorage.getItem('logueado');

    // Si no está autenticado, lo redirige inmediatamente a Login.html
    if (logueado !== 'true') {
        window.location.href = 'Login.html';
        return;
    }

    // Recupera el nombre y el rol del usuario almacenados al iniciar sesión
    const nombre = localStorage.getItem('nombre');
    const rol = (localStorage.getItem('rol') || '').toLowerCase();

    // Muestra el nombre real del usuario en el encabezado superior del dashboard
    const nombreUsuario = document.getElementById('nombreUsuario');
    if (nombreUsuario && nombre) {
        nombreUsuario.textContent = nombre;
    }

    // Obtiene los dos bloques de tarjetas (uno para administrador y otro para asociado)
    const tarjetasAdmin = document.getElementById('tarjetasAdministrador');
    const tarjetasAsociados = document.getElementById('tarjetasAsociados');

    // Aplica el tema visual y muestra las tarjetas correspondientes según el rol
    if (rol === 'admin') {
        // Tema morado/claro y tarjetas de gestión para administrador
        document.body.classList.add('tema-admin');
        document.body.classList.remove('tema-asociado');
        if (tarjetasAdmin) tarjetasAdmin.classList.remove('d-none');
        if (tarjetasAsociados) tarjetasAsociados.classList.add('d-none');
    } else {
        // Tema cálido terracota/vino y tarjetas de consulta para asociado
        document.body.classList.add('tema-asociado');
        document.body.classList.remove('tema-admin');
        if (tarjetasAdmin) tarjetasAdmin.classList.add('d-none');
        if (tarjetasAsociados) tarjetasAsociados.classList.remove('d-none');
    }
});

// Función invocada por el botón "Cerrar sesión" del encabezado del panel principal
async function cerrarSesion() {
    try {
        // Envía una petición POST al backend para destruir la sesión PHP en el servidor
        const respuesta = await fetch("../Modelo/cerrarSesion.php", {
            method: "POST",
            credentials: "include"
        });

        // Lanza un error si el servidor no respondió correctamente
        if (!respuesta.ok) {
            throw new Error("Error al cerrar sesión");
        }

        // Borra los datos guardados en localStorage y regresa a la pantalla de inicio de sesión
        localStorage.clear();
        window.location.href = 'Login.html';
    } catch (error) {
        // Muestra en consola cualquier problema ocurrido al cerrar sesión
        console.error('Error al cerrar sesión:', error);
    }
}
