// Alterna la clase CSS del tema visual del body según si el usuario es administrador o asociado
function aplicarTemaPorRol(esAdmin) {
    if (!document.body) return;
    document.body.classList.toggle("tema-admin", esAdmin);
    document.body.classList.toggle("tema-asociado", !esAdmin);
}

// Aplica el tema de forma inmediata al cargar el script para evitar parpadeos de la barra superior
aplicarTemaPorRol((localStorage.getItem("rol") || "").toLowerCase() === "admin");

// Inyecta la barra lateral persistente en los apartados internos según el rol (Admin o Asociado)
function inyectarSidebarGlobal(esAdmin) {
    if (document.getElementById("sidebarAsociadoGlobal")) return;

    const paginaActual = (window.location.pathname.split("/").pop() || "").toLowerCase();
    const esActivo = (archivo) => (paginaActual === archivo.toLowerCase() ? "active" : "");

    const overlay = document.createElement("div");
    overlay.id = "sidebarAsociadoOverlay";
    overlay.className = "sidebar-global-overlay no-print";

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

    const btnMovil = document.createElement("button");
    btnMovil.type = "button";
    btnMovil.id = "btnMovilSidebarGlobal";
    btnMovil.className = `btn-movil-sidebar-global no-print d-lg-none${esAdmin ? " btn-movil-admin" : ""}`;
    btnMovil.setAttribute("aria-label", "Abrir menú lateral");
    btnMovil.innerHTML = '<i class="bi bi-list"></i> Menú';

    btnMovil.addEventListener("click", () => {
        sidebar.classList.toggle("abierta");
        overlay.classList.toggle("activo");
    });
    overlay.addEventListener("click", () => {
        sidebar.classList.remove("abierta");
        overlay.classList.remove("activo");
    });

    document.body.prepend(btnMovil);
    document.body.prepend(sidebar);
    document.body.prepend(overlay);
    document.body.classList.add(esAdmin ? "con-sidebar-admin" : "con-sidebar-asociado");
}

// Se ejecuta al cargar cualquiera de las vistas internas (Asociados, Actividades, Pagos, Préstamos, Reportes o Billetera)
document.addEventListener("DOMContentLoaded", () => {
    const logueado = localStorage.getItem("logueado");
    if (logueado !== "true") {
        window.location.href = "Login.html";
        return;
    }

    const nombre = localStorage.getItem("nombre");
    const rol = (localStorage.getItem("rol") || "").toLowerCase();
    const esAdmin = rol === "admin";

    aplicarTemaPorRol(esAdmin);

    const nombreUsuario = document.getElementById("nombreUsuario");
    if (nombreUsuario && nombre) {
        nombreUsuario.textContent = nombre;
    }

    document.querySelectorAll("[data-solo-admin]").forEach((elemento) => {
        elemento.classList.toggle("d-none", !esAdmin);
    });

    document.querySelectorAll("[data-solo-asociado]").forEach((elemento) => {
        elemento.classList.toggle("d-none", esAdmin);
    });

    // Inyecta la barra lateral persistente con la paleta correspondiente al rol (sin barra superior)
    inyectarSidebarGlobal(esAdmin);

    // Si es Admin, muestra un contador rojo en "Préstamos" de la barra lateral cuando hay solicitudes pendientes
    if (esAdmin) {
        const actualizarBadgeAdmin = async () => {
            try {
                const resp = await fetch("../Modelo/gestionarPrestamos.php", {
                    method: "GET",
                    headers: { "Accept": "application/json" },
                    credentials: "include"
                });
                const datos = await resp.json();
                const badge = document.getElementById("badgeNotifSidebarAdmin");
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
        actualizarBadgeAdmin();
        setInterval(actualizarBadgeAdmin, 15000);
    }

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
        const respuesta = await fetch("../Modelo/cerrarSesion.php", {
            method: "POST",
            credentials: "include"
        });

        if (!respuesta.ok) {
            throw new Error("Error al cerrar sesión");
        }

        localStorage.clear();
        window.location.href = "Login.html";
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
    }
}
