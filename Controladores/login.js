// Obtiene la referencia al formulario de inicio de sesión en Login.html
const formulario = document.getElementById("formLogin");

// Verifica que el formulario exista antes de registrar el evento submit
if (formulario) {
    // Escucha el envío del formulario de forma asíncrona
    formulario.addEventListener("submit", async function (e) {
        // Evita que el navegador recargue la página al enviar el formulario
        e.preventDefault();

        // Obtiene el botón de envío y el párrafo donde se mostrarán los mensajes de error
        const boton = formulario.querySelector('button[type="submit"]');
        const mensaje = document.getElementById("mensajeLogin");

        // Deshabilita el botón mientras se procesa la petición y limpia mensajes anteriores
        if (boton) boton.disabled = true;
        if (mensaje) mensaje.textContent = "";

        // Convierte los campos con atributo name del formulario en un objeto clave-valor
        const formData = Object.fromEntries(new FormData(formulario).entries());
        // Construye el objeto final con respaldo por ID por si faltara algún atributo name
        const datos = {
            email: String(formData.email ?? document.getElementById("Email")?.value ?? "").trim(),
            contraseña: String(formData.contraseña ?? document.getElementById("Password")?.value ?? "")
        };

        try {
            // Envía la petición POST en formato JSON al endpoint ../Modelo/Login.php
            const respuesta = await fetch(formulario.action, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                // Incluye las cookies de sesión PHP (PHPSESSID)
                credentials: "include",
                body: JSON.stringify(datos)
            });

            // Lee la respuesta como texto plano antes de intentar convertirla a JSON
            const textoRespuesta = await respuesta.text();
            let resultado = {};
            try {
                // Parsea el texto recibido a un objeto JavaScript
                resultado = JSON.parse(textoRespuesta);
            } catch {
                // Si el servidor no devolvió JSON válido, lo registra en la consola
                console.error("Respuesta no JSON del servidor:", respuesta.status, textoRespuesta);
                resultado = {};
            }

            // Si el estado HTTP no fue exitoso o success es false, muestra el error en pantalla
            if (!respuesta.ok || !resultado.success) {
                if (mensaje) {
                    mensaje.textContent =
                        resultado.mensaje ||
                        resultado.message ||
                        `No fue posible iniciar sesión (HTTP ${respuesta.status}). Verifique que está accediendo desde http://localhost y que sus datos sean correctos.`;
                }
                // Vuelve a habilitar el botón para que el usuario pueda reintentar
                if (boton) boton.disabled = false;
                return;
            }

            // Guarda en localStorage el estado de sesión, el rol y el nombre del usuario autenticado
            localStorage.setItem("logueado", "true");
            if (resultado.rol) localStorage.setItem("rol", resultado.rol);
            if (resultado.nombre) localStorage.setItem("nombre", resultado.nombre);

            // Redirige al panel principal tras iniciar sesión correctamente
            window.location.href = "dashboard.html?v=3";
        } catch (error) {
            // Captura fallos de red o conexión con el servidor
            console.error("Error al iniciar sesión:", error);
            if (mensaje) {
                mensaje.textContent =
                    "Ocurrió un error al iniciar sesión, por favor vuelve a intentarlo.";
            }
            // Rehabilita el botón de envío
            if (boton) boton.disabled = false;
        }
    });
}
