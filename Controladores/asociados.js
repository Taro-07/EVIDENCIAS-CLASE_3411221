const formulario = document.getElementById("formRegistro") || document.getElementById("formAsociados");

if (formulario) {
    formulario.addEventListener("submit", async function (event) {
        event.preventDefault();

        const botonGuardar = formulario.querySelector('button[type="submit"]');
        const Asociado = Object.fromEntries(new FormData(formulario).entries());
        const mensajeEl = document.getElementById("mensajeRegistro");

        // Validar coincidencia de contraseñas si existe campo de confirmación
        const pass = Asociado.contraseña || Asociado.contrasena || Asociado.password || Asociado.clave;
        const confirmPass = Asociado.confirmarContraseña || Asociado.confirmarContrasena || Asociado.confirmPassword;

        if (confirmPass !== undefined && confirmPass !== "" && pass !== confirmPass) {
            if (mensajeEl) {
                mensajeEl.textContent = "Las contraseñas no coinciden.";
                mensajeEl.style.color = "red";
                mensajeEl.style.fontWeight = "bold";
            } else {
                alert("Las contraseñas no coinciden.");
            }
            return;
        }

        // Limpiar confirmación y asegurar campo contraseña
        delete Asociado.confirmarContraseña;
        delete Asociado.confirmarContrasena;
        delete Asociado.confirmPassword;
        Asociado.contraseña = pass;

        if (botonGuardar) botonGuardar.disabled = true;

        if (mensajeEl) {
            mensajeEl.textContent = "Guardando...";
            mensajeEl.style.color = "#333";
            mensajeEl.style.fontWeight = "bold";
        }

        try {
            const urlDestino = formulario.action || '../Modelo/guardarAsociado.php';
            const respuesta = await fetch(urlDestino, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Asociado)
            });

            let resultado;
            try {
                resultado = await respuesta.json();
            } catch {
                throw new Error(`El servidor respondió con HTTP ${respuesta.status}, pero no devolvió JSON.`);
            }

            if (mensajeEl) {
                mensajeEl.textContent = resultado.message;
                mensajeEl.style.color = resultado.success ? "green" : "red";
                mensajeEl.style.fontWeight = "bold";
                mensajeEl.style.marginTop = "10px";
            } else {
                alert(resultado.message);
            }

            if (respuesta.ok && resultado.success) {
                formulario.reset();
            }
        } catch (error) {
            console.error("Error al enviar el formulario: ", error);
            if (mensajeEl) {
                mensajeEl.textContent = error.message || "Ocurrió un error al enviar el formulario.";
                mensajeEl.style.color = "red";
            } else {
                alert(error.message || "Ocurrió un error al enviar el formulario.");
            }
        } finally {
            if (botonGuardar) botonGuardar.disabled = false;
        }
    });
}