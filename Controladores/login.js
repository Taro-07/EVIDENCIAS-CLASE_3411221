const formulario = document.getElementById('formLogin');

// 1. Se agrega 'async' al inicio de la función
formulario.addEventListener('submit', async function (event) {
    event.preventDefault();

    const boton = formulario.querySelector('button[type="submit"]');
    const mensaje = formulario.querySelector('.mensajeLogin');

    boton.disabled = true;
    if (mensaje) mensaje.textContent = ''; // Limpiar mensajes previos

    try {
        // 2. Se corrige la URL a formulario.action directa
        const respuesta = await fetch(formulario.action, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(Object.fromEntries(new FormData(formulario).entries()))
        });

        const resultado = await respuesta.json();

        if (!resultado.success) {
            if (mensaje) {
                mensaje.textContent = resultado.message || "No fue posible iniciar sesión. Por favor, verifica tus credenciales.";
            }
            return;
        }

        // Guardar sesión
        localStorage.setItem("logueado", "true");
        localStorage.setItem("rol", resultado.rol);
        localStorage.setItem("nombre", resultado.nombre);

        // Redireccionar
        window.location.href = 'dashboard.html';

    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        if (mensaje) {
            mensaje.textContent = "Ocurrió un error al intentar iniciar sesión. Por favor, inténtalo de nuevo más tarde.";
        }
    } finally {
        // 3. Se reactiva el botón automáticamente al terminar (sea éxito o error)
        boton.disabled = false;
    }
});