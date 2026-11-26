// Alterna la clase CSS del tema visual del body según si el usuario es administrador o asociado
function aplicarTemaPorRol(esAdmin) {
    // Evita errores si document.body aún no está disponible
    if (!document.body) return;
    // Activa "tema-admin" para administradores y "tema-asociado" para asociados
    document.body.classList.toggle("tema-admin", esAdmin);
    document.body.classList.toggle("tema-asociado", !esAdmin);
}

// Aplica el tema de forma inmediata al cargar el script para evitar parpadeos de la barra superior
aplicarTemaPorRol((localStorage.getItem("rol") || "").toLowerCase() === "admin");

// Inyecta la barra lateral persistente en los apartados internos según el rol (Admin o Asociado)
function inyectarSidebarGlobal(esAdmin) {
    // Evita inyectar un segundo sidebar si ya existe en el documento
    if (document.getElementById("sidebarAsociadoGlobal")) return;

    // Extrae el nombre del archivo HTML actual de la URL para resaltar el enlace activo
    const paginaActual = (window.location.pathname.split("/").pop() || "").toLowerCase();
    // Función auxiliar que retorna "active" cuando el enlace coincide con la página actual
    const esActivo = (archivo) => (paginaActual === archivo.toLowerCase() ? "active" : "");

    // Crea el fondo oscuro semitransparente para cerrar el menú lateral en móviles
    const overlay = document.createElement("div");
    overlay.id = "sidebarAsociadoOverlay";
    overlay.className = "sidebar-global-overlay no-print";

    // Plantilla HTML de enlaces de navegación exclusivos para el rol Administrador
    const enlacesAdmin = `
            <a href="dashboard.html?v=7" class="sidebar-global-link ${esActivo("dashboard.html")}">
                <i class="bi bi-grid-1x2-fill"></i>
                <span>Panel Principal</span>
            </a>
            <a href="asociados.html?v=4" class="sidebar-global-link ${esActivo("asociados.html")}">
                <i class="bi bi-people"></i>
                <span>Asociados</span>
            </a>
            <a href="actividades.html?v=4" class="sidebar-global-link ${esActivo("actividades.html")}">
                <i class="bi bi-calendar-event"></i>
                <span>Actividades</span>
            </a>
            <a href="pagos.html?v=4" class="sidebar-global-link ${esActivo("pagos.html")}">
                <i class="bi bi-cash-coin"></i>
                <span>Pagos</span>
            </a>
            <a href="prestamos.html?v=9" class="sidebar-global-link ${esActivo("prestamos.html")}">
                <i class="bi bi-bank"></i>
                <span>Préstamos</span>
                <span id="badgeNotifSidebarAdmin" class="badge rounded-pill bg-danger ms-auto d-none" title="Solicitudes pendientes">0</span>
            </a>
            <a href="reportes.html?v=2" class="sidebar-global-link ${esActivo("reportes.html")}">
                <i class="bi bi-graph-up-arrow"></i>
                <span>Reportes</span>
            </a>`;

    // Plantilla HTML de enlaces de navegación exclusivos para el rol Asociado
    const enlacesAsociado = `
            <a href="dashboard.html?v=7" class="sidebar-global-link ${esActivo("dashboard.html")}">
                <i class="bi bi-grid-1x2-fill"></i>
                <span>Panel Principal</span>
            </a>
            <a href="billetera.html?v=1" class="sidebar-global-link ${esActivo("billetera.html")}">
                <i class="bi bi-wallet2"></i>
                <span>Mi Billetera</span>
            </a>
            <a href="asociados.html?v=4" class="sidebar-global-link ${esActivo("asociados.html")}">
                <i class="bi bi-person-vcard"></i>
                <span>Mis Datos Personales</span>
            </a>
            <a href="actividades.html?v=4" class="sidebar-global-link ${esActivo("actividades.html")}">
                <i class="bi bi-calendar-event"></i>
                <span>Actividades</span>
            </a>
            <a href="pagos.html?v=4" class="sidebar-global-link ${esActivo("pagos.html")}">
                <i class="bi bi-cash-coin"></i>
                <span>Mis Pagos</span>
            </a>
            <a href="prestamos.html?v=9" class="sidebar-global-link ${esActivo("prestamos.html")}">
                <i class="bi bi-bank"></i>
                <span>Préstamos</span>
            </a>`;

    // Construye el elemento <aside> del menú lateral con marca, enlaces y botón de cierre de sesión
    const sidebar = document.createElement("aside");
    sidebar.id = "sidebarAsociadoGlobal";
    sidebar.className = `sidebar-asociado-global no-print${esAdmin ? " sidebar-admin-global" : ""}`;
    sidebar.innerHTML = `
        <a href="dashboard.html?v=7" class="sidebar-global-brand">
            <i class="bi bi-layers-fill"></i>
            <span>CLUB ACERÍAS</span>
        </a>
        <nav class="sidebar-global-nav">
            ${esAdmin ? enlacesAdmin : enlacesAsociado}
        </nav>
        <div class="sidebar-global-footer">
            <button type="button" class="btn-sidebar-global-logout" onclick="cerrarSesion()">
                <i class="bi bi-box-arrow-left"></i>
                <span>Cerrar sesión</span>
            </button>
        </div>`;

    // Crea el botón flotante "Menú" visible únicamente en pantallas pequeñas
    const btnMovil = document.createElement("button");
    btnMovil.type = "button";
    btnMovil.id = "btnMovilSidebarGlobal";
    btnMovil.className = `btn-movil-sidebar-global no-print d-lg-none${esAdmin ? " btn-movil-admin" : ""}`;
    btnMovil.setAttribute("aria-label", "Abrir menú lateral");
    btnMovil.innerHTML = '<i class="bi bi-list"></i> Menú';

    // Alterna la visibilidad del menú lateral y su overlay al pulsar el botón móvil
    btnMovil.addEventListener("click", () => {
        sidebar.classList.toggle("abierta");
        overlay.classList.toggle("activo");
    });
    // Cierra el menú lateral al pulsar sobre el overlay oscuro
    overlay.addEventListener("click", () => {
        sidebar.classList.remove("abierta");
        overlay.classList.remove("activo");
    });

    // Inserta el overlay, el sidebar y el botón móvil al inicio del body y agrega la clase de layout
    document.body.prepend(btnMovil);
    document.body.prepend(sidebar);
    document.body.prepend(overlay);
    document.body.classList.add(esAdmin ? "con-sidebar-admin" : "con-sidebar-asociado");
}

// Se ejecuta al cargar cualquiera de las vistas internas (Asociados, Actividades, Pagos, Préstamos, Reportes o Billetera)
document.addEventListener("DOMContentLoaded", () => {
    // Valida que exista una sesión activa en localStorage; de lo contrario redirige al Login
    const logueado = localStorage.getItem("logueado");
    if (logueado !== "true") {
        window.location.href = "Login.html";
        return;
    }

    // Lee el nombre y rol del usuario autenticado desde localStorage
    const nombre = localStorage.getItem("nombre");
    const rol = (localStorage.getItem("rol") || "").toLowerCase();
    const esAdmin = rol === "admin";

    // Refuerza la aplicación del tema visual una vez listo el DOM
    aplicarTemaPorRol(esAdmin);

    // Coloca el nombre del usuario en la cabecera si el elemento #nombreUsuario existe
    const nombreUsuario = document.getElementById("nombreUsuario");
    if (nombreUsuario && nombre) {
        nombreUsuario.textContent = nombre;
    }

    // Muestra los bloques de interfaz marcados para administradores y oculta los demás
    document.querySelectorAll("[data-solo-admin]").forEach((elemento) => {
        elemento.classList.toggle("d-none", !esAdmin);
    });

    // Muestra los bloques de interfaz marcados para asociados y oculta los de administrador
    document.querySelectorAll("[data-solo-asociado]").forEach((elemento) => {
        elemento.classList.toggle("d-none", esAdmin);
    });

    // Inyecta la barra lateral persistente con la paleta correspondiente al rol (sin barra superior)
    inyectarSidebarGlobal(esAdmin);

    // Si es Admin, muestra un contador rojo en "Préstamos" de la barra lateral cuando hay solicitudes pendientes
    if (esAdmin) {
        // Función periódica que consulta los préstamos pendientes y actualiza la insignia del sidebar
        const actualizarBadgeAdmin = async () => {
            try {
                // Petición GET al endpoint de préstamos usando la sesión PHP activa
                const resp = await fetch("../Modelo/gestionarPrestamos.php", {
                    method: "GET",
                    headers: { "Accept": "application/json" },
                    credentials: "include"
                });
                const datos = await resp.json();
                const badge = document.getElementById("badgeNotifSidebarAdmin");
                // Calcula cuántos préstamos tienen aprobación o solicitud pendiente y actualiza el badge
                if (resp.ok && datos.success && badge) {
                    const pendientes = (datos.prestamos || []).filter(
                        (p) => p.estadoAprobacion === "Pendiente" || p.solicitudTipo
                    ).length;
                    badge.textContent = pendientes > 99 ? "99+" : String(pendientes);
                    badge.classList.toggle("d-none", pendientes === 0);
                }
            } catch {
                // Silencioso para no interrumpir la vista actual
            }
        };
        // Ejecuta la primera verificación de inmediato y la repite cada 15 segundos
        actualizarBadgeAdmin();
        setInterval(actualizarBadgeAdmin, 15000);
    }

    // Asegura que el logotipo de la barra superior (si existe) redirija siempre al dashboard
    const marcaGestion = document.querySelector(".navbar-brand");
    if (marcaGestion) {
        marcaGestion.setAttribute("href", "dashboard.html?v=7");
        marcaGestion.addEventListener("click", (e) => {
            e.preventDefault();
            window.location.href = "dashboard.html?v=7";
        });
    }
});

// Función global usada por el botón "Cerrar sesión"
async function cerrarSesion() {
    try {
        // Envía petición POST a cerrarSesion.php para destruir la sesión en el servidor
        const respuesta = await fetch("../Modelo/cerrarSesion.php", {
            method: "POST",
            credentials: "include"
        });

        // Lanza error si el servidor no respondió satisfactoriamente
        if (!respuesta.ok) {
            throw new Error("Error al cerrar sesión");
        }

        // Limpia los datos de sesión en el navegador y redirige a Login.html
        localStorage.clear();
        window.location.href = "Login.html";
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
    }
}
