const formulario = document.getElementById("formRegistro");

formulario.addEventListener("submit", async function (event) {
    //evita recargar la pag al enviar el formulario
    event.preventDefault();

    const botonGuardar = formulario.querySelector('button[type="submit"]');

    // Lee los campos del formulario y los convierte en un objeto
    const asociado = Object.fromEntries(new FormData(formulario).entries());

    if (asociado.password_hash !== asociado.confirmar_password) {
        document.getElementById("mensajeRegistro").textContent = "Las contraseñas no coinciden.";
        return;
    }

    delete asociado.confirmar_password; // Elimina el campo de confirmación de contraseña antes de enviarlo al servidor

    botonGuardar.disabled = true; // Deshabilita el botón de guardar mientras se procesa la solicitud
    try {
        const respuesta = await fetch(formulario.action, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(asociado) });
        
        //pasar la respuesta Json a un objeto de JS
        const resultado = await respuesta.json();
        document.getElementById("mensajeRegistro").textContent = "Guardando...";

        //limpia cualquier mensaje previo
        document.getElementById("mensajeRegistro").dataset.tipo='';

        document.getElementById("mensajeRegistro").textContent = resultado.mensaje;

        if(respuesta.ok && resultado.success) {
            formulario.reset(); // Limpia el formulario si la respuesta es exitosa
        }

    } catch (error) {
        console.error("Error al enviar el formulario:", error);
        document.getElementById("mensajeRegistro").textContent = "Error al enviar el formulario. Por favor, inténtelo de nuevo.";
    }finally {
        botonGuardar.disabled = false; // Habilita el botón de guardar después de procesar la solicitud
    }

});