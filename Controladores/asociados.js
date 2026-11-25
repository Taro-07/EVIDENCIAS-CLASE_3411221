// Obtiene la referencia al formulario de registro público en Registro.html
const formulario = document.getElementById("formRegistro");

// Solo registra el manejador si el formulario existe en la página actual
if (formulario) {
    // Escucha el evento de envío del formulario de registro
    formulario.addEventListener("submit", async function (event) {
        // Evita la recarga tradicional del navegador al enviar el formulario
        event.preventDefault();

        // Obtiene el botón Guardar y el elemento donde se muestran avisos al usuario
        const botonGuardar = formulario.querySelector('button[type="submit"]');
        const mensajeRegistro = document.getElementById("mensajeRegistro");

        // Convierte todos los campos del formulario en un objeto JavaScript
        const asociado = Object.fromEntries(new FormData(formulario).entries());

        // Verifica que la contraseña y su confirmación sean idénticas antes de enviar al servidor
        if (asociado.contraseña !== asociado.confirmarContraseña) {
            if (mensajeRegistro) {
                mensajeRegistro.textContent = "Las contraseñas no coinciden.";
            }
            return;
        }

        // Elimina el campo confirmarContraseña porque la base de datos no lo necesita
        delete asociado.confirmarContraseña;

        // Deshabilita el botón para evitar envíos duplicados y limpia mensajes previos
        if (botonGuardar) botonGuardar.disabled = true;
        if (mensajeRegistro) mensajeRegistro.textContent = "";

        // Bandera para saber si el usuario ya está siendo redirigido al Login
        let redirigiendo = false;

        try {
            // Envía los datos del nuevo asociado como JSON a ../Modelo/guardarAsociado.php
            const respuesta = await fetch(formulario.action, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(asociado)
            });

            // Convierte la respuesta JSON del servidor a objeto JavaScript de forma segura
            let resultado = {};
            try {
                resultado = await respuesta.json();
            } catch {
                resultado = {};
            }

            // Muestra el mensaje de confirmación o error devuelto por el servidor
            if (mensajeRegistro) {
                mensajeRegistro.dataset.tipo = "";
                mensajeRegistro.textContent =
                    resultado.mensaje ||
                    (respuesta.ok ? "Asociado guardado con éxito." : "No fue posible completar el registro.");
            }

            // Si el registro fue exitoso, limpia el formulario y redirige al Login tras 1 segundo
            if (respuesta.ok && resultado.success) {
                formulario.reset();
                redirigiendo = true;
                const destino = resultado.redirect || "Login.html";
                setTimeout(() => {
                    window.location.href = destino;
                }, 1000);
            }
        } catch (error) {
            // Registra y muestra un mensaje si falla la comunicación con el servidor
            console.error("Error al enviar el formulario", error);
            if (mensajeRegistro) {
                mensajeRegistro.textContent = "Ocurrió un error. Por favor, inténtalo de nuevo.";
            }
        } finally {
            // Vuelve a activar el botón solo si no se va a redirigir de página
            if (!redirigiendo && botonGuardar) {
                botonGuardar.disabled = false;
            }
        }
    });
}
