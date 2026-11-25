// Alterna la clase CSS del tema visual del body según si el usuario es administrador o asociado
function aplicarTemaPorRol(esAdmin) {
    document.body.classList.toggle("tema-admin", esAdmin);
    document.body.classList.toggle("tema-asociado", !esAdmin);
}

// Se ejecuta al cargar cualquiera de las vistas internas (Asociados, Actividades, Pagos o Préstamos)
document.addEventListener("DOMContentLoaded", () => {
    // Verifica en localStorage si el usuario tiene sesión activa
    const logueado = localStorage.getItem("logueado");

    // Si no ha iniciado sesión, bloquea el acceso y redirige al Login
    if (logueado !== "true") {
        window.location.href = "Login.html";
        return;
    }

    // Obtiene el nombre y rol guardados en localStorage
    const nombre = localStorage.getItem("nombre");
    const rol = (localStorage.getItem("rol") || "").toLowerCase();
    const esAdmin = rol === "admin";

    // Aplica la paleta de colores correspondiente al rol actual
    aplicarTemaPorRol(esAdmin);

    // Si la página tiene un elemento #nombreUsuario, coloca el nombre del usuario autenticado
    const nombreUsuario = document.getElementById("nombreUsuario");
    if (nombreUsuario && nombre) {
        nombreUsuario.textContent = nombre;
    }

    // Muestra los elementos marcados con data-solo-admin únicamente si el usuario es administrador
    document.querySelectorAll("[data-solo-admin]").forEach((elemento) => {
        elemento.classList.toggle("d-none", !esAdmin);
    });

    // Muestra los elementos marcados con data-solo-asociado únicamente si el usuario tiene rol Asociado
    document.querySelectorAll("[data-solo-asociado]").forEach((elemento) => {
        elemento.classList.toggle("d-none", esAdmin);
    });

    // Para el rol Asociado, renombra los enlaces de la barra superior a sus títulos personales
    if (!esAdmin) {
        const enlaceAsociados = document.querySelector('.navbar-nav a[href^="asociados.html"]');
        if (enlaceAsociados) {
            enlaceAsociados.innerHTML = '<i class="bi bi-person-vcard"></i> Mis Datos Personales';
        }
        const enlacePagos = document.querySelector('.navbar-nav a[href^="pagos.html"]');
        if (enlacePagos) {
            enlacePagos.innerHTML = '<i class="bi bi-cash-coin"></i> Mis Pagos';
        }
    }

    // Garantiza que al hacer clic en el ícono/texto "GESTIÓN" de la barra superior regrese al panel principal
    const marcaGestion = document.querySelector(".navbar-brand");
    if (marcaGestion) {
        marcaGestion.setAttribute("href", "dashboard.html?v=3");
        marcaGestion.addEventListener("click", (e) => {
            e.preventDefault();
            window.location.href = "dashboard.html?v=3";
        });
    }
});

// Función global usada por el botón rojo "Cerrar sesión" en la barra de navegación superior
async function cerrarSesion() {
    try {
        // Solicita al backend destruir la sesión PHP enviando la cookie de sesión
        const respuesta = await fetch("../Modelo/cerrarSesion.php", {
            method: "POST",
            credentials: "include"
        });

        // Verifica que el cierre en el servidor haya sido exitoso
        if (!respuesta.ok) {
            throw new Error("Error al cerrar sesión");
        }

        // Limpia localStorage y redirige al inicio de sesión
        localStorage.clear();
        window.location.href = "Login.html";
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
    }
}
