// Formatea valores en pesos colombianos (COP) sin decimales sobrantes
function formatearMonedaDashboard(valor) {
    // Convierte el valor a número usando 0 si viene vacío
    const numero = Number(valor || 0);
    // Detecta si es entero para omitir decimales ".00"
    const esEntero = Number.isInteger(numero);
    // Devuelve la cifra formateada en moneda colombiana (COP)
    return numero.toLocaleString("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: esEntero ? 0 : 2,
        maximumFractionDigits: 2
    });
}

// Obtiene la inicial en mayúscula del nombre del usuario para el avatar por defecto
function obtenerInicialNombre(nombre) {
    // Elimina espacios sobrantes y retorna la primera letra en mayúscula o "A" por defecto
    const limpio = String(nombre || "").trim();
    return limpio.length > 0 ? limpio.charAt(0).toUpperCase() : "A";
}

// Aplica la foto subida o, por defecto, la inicial del nombre con el color elegido
function renderizarAvatar(elemento, nombre, fotoUrl, tono) {
    // Sale si el contenedor del avatar no existe
    if (!elemento) return;
    // Remueve cualquier clase previa de color y aplica el tono seleccionado
    elemento.classList.remove("avatar-tono-morado", "avatar-tono-vino", "avatar-tono-terracota", "avatar-tono-cobre", "avatar-tono-ciruela");
    elemento.classList.add(tono || "avatar-tono-vino");
    // Limpia el contenido previo del avatar
    elemento.replaceChildren();

    if (fotoUrl) {
        // Inserta la foto con marca de tiempo para evitar problemas de caché del navegador
        const img = document.createElement("img");
        img.src = `${fotoUrl}?t=${Date.now()}`;
        img.alt = `Foto de perfil de ${nombre}`;
        // Si la imagen falla al cargar, muestra automáticamente la inicial del nombre
        img.onerror = () => {
            elemento.textContent = obtenerInicialNombre(nombre);
        };
        elemento.append(img);
    } else {
        // Muestra la inicial del nombre cuando no existe foto de perfil
        elemento.textContent = obtenerInicialNombre(nombre);
    }
}

// Dibuja el listado de notificaciones pendientes dentro de la campana del Administrador
function renderizarNotificacionesAdmin(prestamos) {
    // Referencias a la insignia numérica, cabecera del popover y contenedor de la lista
    const contadorBadge = document.getElementById("contadorNotificacionesAdmin");
    const resumenHeader = document.getElementById("resumenNotifHeader");
    const lista = document.getElementById("listaNotificacionesAdmin");
    if (!lista) return;

    // Filtra únicamente los préstamos con estado Pendiente o con solicitud de crear/editar/eliminar
    const pendientes = (Array.isArray(prestamos) ? prestamos : []).filter((p) => {
        const tipo = p.solicitudTipo || null;
        const estado = p.estadoAprobacion || "Aprobado";
        return estado === "Pendiente" || tipo === "crear" || tipo === "editar" || tipo === "eliminar";
    });

    // Actualiza el badge contador en la campana (con tope visual "99+") y el texto resumen
    const cantidad = pendientes.length;
    if (contadorBadge) {
        contadorBadge.textContent = cantidad > 99 ? "99+" : String(cantidad);
        contadorBadge.classList.toggle("d-none", cantidad === 0);
    }
    if (resumenHeader) {
        resumenHeader.textContent = `${cantidad} pendiente${cantidad === 1 ? "" : "s"}`;
    }

    // Si no hay solicitudes pendientes, renderiza un mensaje de bandeja vacía
    if (cantidad === 0) {
        lista.innerHTML = `
            <div class="p-4 text-center">
                <i class="bi bi-check-circle fs-3 d-block mb-2" style="color: #198754;"></i>
                <div class="fw-semibold small" style="color: #2c172b;">Sin solicitudes pendientes</div>
                <div class="small text-muted">Te avisaremos aquí cuando un asociado envíe una solicitud.</div>
            </div>`;
        return;
    }

    // Limpia la lista y construye un ítem enlazado a prestamos.html por cada solicitud pendiente
    lista.replaceChildren();
    pendientes.forEach((p) => {
        const enlace = document.createElement("a");
        enlace.href = "prestamos.html?v=9";
        enlace.className = "notif-item-admin";

        // Valores por defecto para una nueva solicitud de préstamo
        let claseIcono = "notif-ico-crear";
        let iconoHtml = '<i class="bi bi-cash-stack"></i>';
        let titulo = "Nueva solicitud de préstamo";
        let detalle = `${p.nombreAsociado || "Asociado"} solicitó ${formatearMonedaDashboard(p.ValorPrestamo)} (${p.NumeroCuotas || 0} cuotas).`;

        // Personaliza icono, título y descripción si se trata de solicitud de edición o eliminación
        if (p.solicitudTipo === "editar") {
            claseIcono = "notif-ico-editar";
            iconoHtml = '<i class="bi bi-pencil-square"></i>';
            titulo = `Solicitud de edición (#${p.idPrestamos})`;
            const prop = p.solicitudDatos;
            detalle = prop
                ? `${p.nombreAsociado || "Asociado"} propone cambiar a ${formatearMonedaDashboard(prop.ValorPrestamo)} (${prop.NumeroCuotas} cuotas).`
                : `${p.nombreAsociado || "Asociado"} solicitó editar este préstamo.`;
        } else if (p.solicitudTipo === "eliminar") {
            claseIcono = "notif-ico-eliminar";
            iconoHtml = '<i class="bi bi-trash3"></i>';
            titulo = `Solicitud de eliminación (#${p.idPrestamos})`;
            detalle = `${p.nombreAsociado || "Asociado"} solicitó eliminar el préstamo de ${formatearMonedaDashboard(p.ValorPrestamo)}.`;
        }

        // Construye el bloque del icono de la notificación
        const cajaIcono = document.createElement("span");
        cajaIcono.className = `notif-item-icono ${claseIcono}`;
        cajaIcono.innerHTML = iconoHtml;

        // Construye el cuerpo textual con título y detalle descriptivo
        const cuerpo = document.createElement("div");
        cuerpo.className = "flex-grow-1";
        const tituloEl = document.createElement("div");
        tituloEl.className = "fw-bold";
        tituloEl.style.fontSize = "0.84rem";
        tituloEl.style.color = "rgb(102, 5, 86)";
        tituloEl.textContent = titulo;

        const descEl = document.createElement("div");
        descEl.className = "small text-muted";
        descEl.style.lineHeight = "1.3";
        descEl.textContent = detalle;

        // Ensambla y añade el elemento de notificación al contenedor
        cuerpo.append(tituloEl, descEl);
        enlace.append(cajaIcono, cuerpo);
        lista.append(enlace);
    });
}

// Consulta las solicitudes pendientes de préstamo para mantener al día la campana del Admin
async function cargarNotificacionesAdmin() {
    try {
        // Realiza petición GET al endpoint de préstamos incluyendo la cookie de sesión
        const resp = await fetch("../Modelo/gestionarPrestamos.php", {
            method: "GET",
            headers: { "Accept": "application/json" },
            credentials: "include"
        });
        const datos = await resp.json();
        // Si la respuesta es válida, actualiza la lista y contador de notificaciones
        if (resp.ok && datos.success) {
            renderizarNotificacionesAdmin(datos.prestamos || []);
        }
    } catch (error) {
        console.error("Error al consultar notificaciones del administrador:", error);
    }
}

// Dibuja la tabla de "Cartera y pagos de asociados" en el panel principal del Administrador
function renderizarCarteraAdmin(cartera) {
    const contenedor = document.getElementById("contenedorCarteraAdmin");
    if (!contenedor) return;

    // Si no existen registros en cartera, muestra un bloque de estado vacío con acceso directo
    if (!Array.isArray(cartera) || cartera.length === 0) {
        contenedor.innerHTML = `
            <div class="estado-vacio-reciente">
                <i class="bi bi-people" style="color: #b78cc2;"></i>
                <h6 class="fw-bold mb-1" style="color: rgb(102, 5, 86);">No hay asociados registrados todavía</h6>
                <p class="small text-muted mb-3">Registra asociados o préstamos para visualizar la cartera aquí.</p>
                <a href="asociados.html?v=4" class="btn-accion-primaria-admin">
                    <i class="bi bi-plus-lg me-1"></i>Gestionar Asociados
                </a>
            </div>`;
        return;
    }

    // Crea la tabla responsiva con los encabezados de cartera
    const tablaWrap = document.createElement("div");
    tablaWrap.className = "table-responsive";
    const tabla = document.createElement("table");
    tabla.className = "table table-hover align-middle mb-0";

    tabla.innerHTML = `
        <thead>
            <tr style="background-color: #f4ebf7; color: #4a1540;">
                <th>Documento</th>
                <th>Asociado</th>
                <th class="text-center">Créditos</th>
                <th class="text-end">Total Prestado</th>
                <th class="text-end">Total Pagado</th>
                <th class="text-end">Saldo Pendiente</th>
                <th class="text-center">Estado</th>
                <th class="text-end">Acción</th>
            </tr>
        </thead>
        <tbody></tbody>`;

    // Recorre cada asociado de la cartera y construye su fila en el tbody
    const tbody = tabla.querySelector("tbody");
    cartera.forEach((item) => {
        const tr = document.createElement("tr");

        // Celda con el número de documento del asociado
        const tdDoc = document.createElement("td");
        tdDoc.className = "fw-bold";
        tdDoc.textContent = item.documento || "-";

        // Celda con el nombre completo del asociado
        const tdNombre = document.createElement("td");
        tdNombre.textContent = item.nombreAsociado || "-";

        // Celda con el total de créditos del asociado
        const tdCred = document.createElement("td");
        tdCred.className = "text-center fw-semibold";
        tdCred.textContent = String(item.numCreditos ?? 0);

        // Celda con el monto acumulado prestado
        const tdPrest = document.createElement("td");
        tdPrest.className = "text-end fw-semibold";
        tdPrest.textContent = formatearMonedaDashboard(item.totalPrestado);

        // Celda con el monto total abonado en verde
        const tdPag = document.createElement("td");
        tdPag.className = "text-end fw-semibold";
        tdPag.style.color = "#198754";
        tdPag.textContent = formatearMonedaDashboard(item.totalPagado);

        // Celda con el saldo pendiente en rojo si adeuda o verde si está en cero
        const tdSaldo = document.createElement("td");
        tdSaldo.className = "text-end fw-bold";
        tdSaldo.style.color = Number(item.saldoPendiente) > 0 ? "#c0284c" : "#198754";
        tdSaldo.textContent = formatearMonedaDashboard(item.saldoPendiente);

        // Celda de estado con insignia diferenciada (Saldo Pendiente, Al día o Sin créditos)
        const tdEstado = document.createElement("td");
        tdEstado.className = "text-center";
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.style.padding = "6px 10px";
        badge.style.borderRadius = "8px";
        if (Number(item.saldoPendiente) > 0) {
            badge.style.backgroundColor = "#fde8ee";
            badge.style.color = "#b02a37";
            badge.textContent = "Saldo Pendiente";
        } else if (Number(item.numCreditos) > 0) {
            badge.style.backgroundColor = "#e6f5ec";
            badge.style.color = "#157347";
            badge.textContent = "Al día";
        } else {
            badge.style.backgroundColor = "#f1ecf3";
            badge.style.color = "#6b546c";
            badge.textContent = "Sin créditos";
        }
        tdEstado.append(badge);

        // Celda de acción con enlace directo a Pagos (si debe saldo) o Reportes (si está al día)
        const tdAccion = document.createElement("td");
        tdAccion.className = "text-end";
        const btnAccion = document.createElement("a");
        btnAccion.href = Number(item.saldoPendiente) > 0 ? "pagos.html?v=4" : "reportes.html?v=1";
        btnAccion.className = "btn-accion-primaria-admin btn-sm";
        btnAccion.style.padding = "5px 11px";
        btnAccion.style.fontSize = "0.8rem";
        btnAccion.innerHTML = Number(item.saldoPendiente) > 0
            ? '<i class="bi bi-cash-coin me-1"></i>Pagos'
            : '<i class="bi bi-eye me-1"></i>Ver';
        tdAccion.append(btnAccion);

        // Añade todas las celdas a la fila y la agrega al cuerpo de la tabla
        tr.append(tdDoc, tdNombre, tdCred, tdPrest, tdPag, tdSaldo, tdEstado, tdAccion);
        tbody.append(tr);
    });

    // Reemplaza el contenido del contenedor con la nueva tabla
    tablaWrap.append(tabla);
    contenedor.replaceChildren(tablaWrap);
}

// Dibuja la tabla de "Historial de pagos pendientes" o el estado vacío en el panel del Asociado
function renderizarPagosPendientes(pagosPendientes) {
    const contenedor = document.getElementById("contenedorActividadReciente");
    if (!contenedor) return;

    // Si no existen créditos con saldo pendiente, muestra el estado positivo al asociado
    if (!Array.isArray(pagosPendientes) || pagosPendientes.length === 0) {
        contenedor.innerHTML = `
            <div class="estado-vacio-reciente">
                <i class="bi bi-check-circle"></i>
                <h6 class="fw-bold mb-1" style="color: #5c1d22;">No tienes pagos pendientes</h6>
                <p class="small text-muted mb-3">Estás al día con tus obligaciones o aún no has solicitado un préstamo.</p>
                <a href="prestamos.html?v=5" class="btn-accion-primaria">
                    <i class="bi bi-plus-lg me-1"></i>Solicitar un préstamo
                </a>
            </div>`;
        return;
    }

    // Construye la tabla responsiva para los pagos pendientes del asociado
    const tablaWrap = document.createElement("div");
    tablaWrap.className = "table-responsive";
    const tabla = document.createElement("table");
    tabla.className = "table table-hover align-middle mb-0";

    tabla.innerHTML = `
        <thead>
            <tr style="background-color: #f6e9df; color: #5c1d22;">
                <th>Crédito</th>
                <th>Fecha</th>
                <th>Cuotas Pagadas</th>
                <th>Cuotas Pendientes</th>
                <th>Cuota Aprox.</th>
                <th>Saldo Pendiente</th>
                <th class="text-end">Acción</th>
            </tr>
        </thead>
        <tbody></tbody>`;

    // Recorre cada préstamo con cuotas pendientes y crea su fila
    const tbody = tabla.querySelector("tbody");
    pagosPendientes.forEach((item) => {
        const tr = document.createElement("tr");

        // Celda con el número de crédito
        const tdCred = document.createElement("td");
        tdCred.className = "fw-bold";
        tdCred.style.color = "#5c1d22";
        tdCred.textContent = `Crédito #${item.idPrestamos}`;

        // Celda con la fecha del préstamo
        const tdFecha = document.createElement("td");
        tdFecha.textContent = item.fechaPrestamo || "-";

        // Celda con el progreso de cuotas pagadas sobre el total
        const tdPagadas = document.createElement("td");
        tdPagadas.textContent = `${item.cuotasPagadas} / ${item.numeroCuotas}`;

        // Celda con insignia destacando la cantidad de cuotas pendientes
        const tdPendientes = document.createElement("td");
        const badgePend = document.createElement("span");
        badgePend.className = "badge";
        badgePend.style.backgroundColor = "#fdf0e6";
        badgePend.style.color = "#b84324";
        badgePend.style.border = "1px solid #ecc6b1";
        badgePend.style.padding = "6px 10px";
        badgePend.textContent = `${item.cuotasPendientes} pendiente${item.cuotasPendientes === 1 ? "" : "s"}`;
        tdPendientes.append(badgePend);

        // Celda con el valor aproximado de cada cuota
        const tdCuota = document.createElement("td");
        tdCuota.textContent = formatearMonedaDashboard(item.valorCuotaAprox);

        // Celda con el saldo total pendiente del crédito
        const tdSaldo = document.createElement("td");
        tdSaldo.className = "fw-bold";
        tdSaldo.style.color = "#a82832";
        tdSaldo.textContent = formatearMonedaDashboard(item.saldoPendiente);

        // Celda de acción con enlace rápido a la vista de pagos para abonar
        const tdAccion = document.createElement("td");
        tdAccion.className = "text-end";
        const btnAbonar = document.createElement("a");
        btnAbonar.href = "pagos.html?v=4";
        btnAbonar.className = "btn-accion-primaria btn-sm";
        btnAbonar.style.padding = "5px 12px";
        btnAbonar.style.fontSize = "0.82rem";
        btnAbonar.innerHTML = '<i class="bi bi-cash-coin me-1"></i>Abonar';
        tdAccion.append(btnAbonar);

        // Ensambla la fila y la agrega al tbody
        tr.append(tdCred, tdFecha, tdPagadas, tdPendientes, tdCuota, tdSaldo, tdAccion);
        tbody.append(tr);
    });

    // Inserta la tabla en el contenedor reemplazando su contenido anterior
    tablaWrap.append(tabla);
    contenedor.replaceChildren(tablaWrap);
}

// Se ejecuta cuando todo el HTML del panel principal ha cargado
document.addEventListener("DOMContentLoaded", () => {
    // Verifica en localStorage si el usuario inició sesión; si no, lo redirige al Login
    const logueado = localStorage.getItem("logueado");
    if (logueado !== "true") {
        window.location.href = "Login.html";
        return;
    }

    // Lee rol y nombre desde localStorage para determinar qué vista del panel activar
    const rol = (localStorage.getItem("rol") || "").toLowerCase();
    const esAdmin = rol === "admin";
    let nombre = localStorage.getItem("nombre") || (esAdmin ? "Administrador" : "Asociado");

    // Referencias a los dos contenedores principales del dashboard (Admin vs Asociado)
    const vistaAdmin = document.getElementById("vistaAdminDashboard");
    const vistaAsociado = document.getElementById("vistaAsociadoDashboard");

    // Aplica el tema visual y muestra únicamente la vista correspondiente al rol
    document.body.classList.toggle("tema-admin", esAdmin);
    document.body.classList.toggle("tema-asociado", !esAdmin);
    if (vistaAdmin) vistaAdmin.classList.toggle("d-none", !esAdmin);
    if (vistaAsociado) vistaAsociado.classList.toggle("d-none", esAdmin);

    // Referencias a textos de bienvenida, avatares, saldo superior y mensajes del modal de foto
    const nombreTop = document.getElementById(esAdmin ? "nombreUsuarioAdmin" : "nombreUsuario");
    const saludoNombre = document.getElementById(esAdmin ? "saludoNombreAdmin" : "saludoNombreAsociado");
    const nombreModal = document.getElementById("nombreModalFoto");
    const avatarTop = document.getElementById(esAdmin ? "avatarTopAdmin" : "avatarTopAsociado");
    const avatarPreview = document.getElementById("avatarPreviewModal");
    const saldoTop = document.getElementById("saldoTopAsociado");
    const mensajeFoto = document.getElementById("mensajeFotoPerfil");

    // Estado local de la foto de perfil y tono de avatar guardados en localStorage
    let fotoActual = localStorage.getItem("fotoPerfil") || null;
    let tonoActual = localStorage.getItem("avatarTono") || (esAdmin ? "avatar-tono-morado" : "avatar-tono-vino");

    // Controles dentro del modal de personalización de foto/avatar
    const btnUsarInicial = document.getElementById("btnUsarInicial");
    const selectorColorAvatar = document.getElementById("selectorColorAvatar");

    // Sincroniza el nombre y los avatares tanto en la barra superior como en el modal
    const actualizarNombreYAvatares = () => {
        if (nombreTop) nombreTop.textContent = nombre;
        if (saludoNombre) saludoNombre.textContent = nombre;
        if (nombreModal) nombreModal.textContent = nombre;
        renderizarAvatar(avatarTop, nombre, fotoActual, tonoActual);
        renderizarAvatar(avatarPreview, nombre, fotoActual, tonoActual);
        // Solo muestra "Quitar foto" cuando hay foto subida, y el selector de color cuando se usa la inicial
        if (btnUsarInicial) {
            btnUsarInicial.classList.toggle("d-none", !fotoActual);
        }
        if (selectorColorAvatar) {
            selectorColorAvatar.classList.toggle("d-none", Boolean(fotoActual));
        }
        // Marca el botón del tono activo
        document.querySelectorAll(".btn-tono-avatar").forEach((btn) => {
            btn.classList.toggle("activo", btn.dataset.tono === tonoActual);
        });
    };

    // Ejecuta el renderizado inicial del nombre y avatares
    actualizarNombreYAvatares();

    // Menú lateral colapsable en pantallas móviles (Admin o Asociado)
    const sidebar = document.getElementById(esAdmin ? "sidebarAdmin" : "sidebarAsociado");
    const overlay = document.getElementById(esAdmin ? "sidebarOverlayAdmin" : "sidebarOverlay");
    const btnAbrirSidebar = document.getElementById(esAdmin ? "btnAbrirSidebarAdmin" : "btnAbrirSidebar");
    if (btnAbrirSidebar && sidebar && overlay) {
        // Alterna la apertura del sidebar y su fondo semitransparente
        btnAbrirSidebar.addEventListener("click", () => {
            sidebar.classList.toggle("abierta");
            overlay.classList.toggle("activo");
        });
        // Cierra el sidebar al pulsar fuera (sobre el overlay)
        overlay.addEventListener("click", () => {
            sidebar.classList.remove("abierta");
            overlay.classList.remove("activo");
        });
    }

    // Despliega u oculta la vista pequeña de Mi Billetera al hacer clic en el botón "Saldo" (Asociado)
    const btnToggleBilletera = document.getElementById("btnToggleMiniBilletera");
    const popoverBilletera = document.getElementById("popoverMiniBilletera");
    const btnCerrarBilletera = document.getElementById("btnCerrarMiniBilletera");

    // Función auxiliar para ocultar el popover de la mini billetera
    const cerrarPopoverBilletera = () => {
        if (!popoverBilletera || !btnToggleBilletera) return;
        popoverBilletera.classList.add("d-none");
        btnToggleBilletera.setAttribute("aria-expanded", "false");
    };

    // Configura los eventos del popover de billetera solo para el rol Asociado
    if (!esAdmin && btnToggleBilletera && popoverBilletera) {
        btnToggleBilletera.addEventListener("click", (e) => {
            // Detiene la propagación para que el listener global del document no lo cierre al instante
            e.stopPropagation();
            const estaOculto = popoverBilletera.classList.contains("d-none");
            popoverBilletera.classList.toggle("d-none", !estaOculto);
            btnToggleBilletera.setAttribute("aria-expanded", estaOculto ? "true" : "false");
        });

        // Evita que los clics dentro del popover lo cierren
        popoverBilletera.addEventListener("click", (e) => {
            e.stopPropagation();
        });

        // Botón interno "X" para cerrar el popover
        if (btnCerrarBilletera) {
            btnCerrarBilletera.addEventListener("click", cerrarPopoverBilletera);
        }

        // Cierra el popover al hacer clic fuera o al presionar Escape
        document.addEventListener("click", cerrarPopoverBilletera);
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") cerrarPopoverBilletera();
        });
    }

    // Despliega u oculta el menú de notificaciones al pulsar la campana del Administrador
    const btnNotifAdmin = document.getElementById("btnNotificacionesAdmin");
    const popoverNotifAdmin = document.getElementById("popoverNotificacionesAdmin");
    const btnCerrarNotifAdmin = document.getElementById("btnCerrarNotifAdmin");

    // Función auxiliar para ocultar el panel desplegable de notificaciones
    const cerrarPopoverNotifAdmin = () => {
        if (!popoverNotifAdmin || !btnNotifAdmin) return;
        popoverNotifAdmin.classList.add("d-none");
        btnNotifAdmin.setAttribute("aria-expanded", "false");
    };

    // Configura eventos de apertura y cierre del popover de notificaciones para Admin
    if (esAdmin && btnNotifAdmin && popoverNotifAdmin) {
        btnNotifAdmin.addEventListener("click", (e) => {
            e.stopPropagation();
            const estaOculto = popoverNotifAdmin.classList.contains("d-none");
            popoverNotifAdmin.classList.toggle("d-none", !estaOculto);
            btnNotifAdmin.setAttribute("aria-expanded", estaOculto ? "true" : "false");
            // Si acaba de abrirse, consulta las notificaciones más recientes al servidor
            if (estaOculto) {
                cargarNotificacionesAdmin();
            }
        });

        // Evita cerrar el popover al interactuar dentro de él
        popoverNotifAdmin.addEventListener("click", (e) => {
            e.stopPropagation();
        });

        // Botón de cierre manual dentro del popover
        if (btnCerrarNotifAdmin) {
            btnCerrarNotifAdmin.addEventListener("click", cerrarPopoverNotifAdmin);
        }

        // Cierra el menú al hacer clic fuera o presionar Escape
        document.addEventListener("click", cerrarPopoverNotifAdmin);
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") cerrarPopoverNotifAdmin();
        });
    }

    // Modal para subir foto de perfil (o quitarla para volver a la inicial por defecto)
    const modalEl = document.getElementById("modalFotoPerfil");
    const modalFoto = modalEl && window.bootstrap ? new bootstrap.Modal(modalEl) : null;
    const btnEditarFoto = document.getElementById(esAdmin ? "btnEditarFotoPerfilAdmin" : "btnEditarFotoPerfil");
    const inputFoto = document.getElementById("inputFotoPerfil");
    const formSubirFoto = document.getElementById("formSubirFoto");
    const btnGuardarFoto = document.getElementById("btnGuardarFoto");

    // Abre el modal de edición de foto al pulsar el avatar o botón de cámara
    if (btnEditarFoto && modalFoto) {
        btnEditarFoto.addEventListener("click", () => {
            if (mensajeFoto) mensajeFoto.textContent = "";
            if (inputFoto) inputFoto.value = "";
            actualizarNombreYAvatares();
            modalFoto.show();
        });
    }

    // Vista previa instantánea al elegir una imagen del dispositivo
    if (inputFoto) {
        inputFoto.addEventListener("change", () => {
            const archivo = inputFoto.files?.[0];
            if (!archivo || !avatarPreview) return;
            // Crea una URL temporal local para previsualizar la imagen antes de subirla
            const urlTemporal = URL.createObjectURL(archivo);
            avatarPreview.replaceChildren();
            const img = document.createElement("img");
            img.src = urlTemporal;
            img.alt = "Vista previa";
            avatarPreview.append(img);
        });
    }

    // Subir nueva foto de perfil al servidor (POST ../Modelo/perfilFoto.php)
    if (formSubirFoto) {
        formSubirFoto.addEventListener("submit", async (e) => {
            e.preventDefault();
            // Valida que exista un archivo seleccionado antes de subirlo
            const archivo = inputFoto?.files?.[0];
            if (!archivo) {
                if (mensajeFoto) mensajeFoto.textContent = "Primero selecciona una imagen desde tu dispositivo.";
                return;
            }

            // Adjunta la imagen en FormData
            const formData = new FormData();
            formData.append("foto", archivo);

            // Deshabilita el botón y muestra estado de subida
            if (btnGuardarFoto) btnGuardarFoto.disabled = true;
            if (mensajeFoto) mensajeFoto.textContent = "Subiendo foto...";

            try {
                // Envía la imagen al servidor mediante POST con cookie de sesión
                const respuesta = await fetch("../Modelo/perfilFoto.php", {
                    method: "POST",
                    credentials: "include",
                    body: formData
                });
                const resultado = await respuesta.json();

                if (!respuesta.ok || !resultado.success) {
                    throw new Error(resultado.mensaje || "No se pudo subir la foto");
                }

                // Actualiza la ruta en memoria, localStorage y refresca los avatares visibles
                fotoActual = resultado.fotoPerfil;
                localStorage.setItem("fotoPerfil", fotoActual);
                actualizarNombreYAvatares();
                if (mensajeFoto) mensajeFoto.textContent = resultado.mensaje;
            } catch (error) {
                if (mensajeFoto) mensajeFoto.textContent = error.message;
            } finally {
                if (btnGuardarFoto) btnGuardarFoto.disabled = false;
            }
        });
    }

    // Botón "Quitar foto": elimina la foto subida y vuelve automáticamente a la inicial por defecto
    if (btnUsarInicial) {
        btnUsarInicial.addEventListener("click", async () => {
            btnUsarInicial.disabled = true;
            try {
                // Envía petición DELETE para borrar la foto almacenada en el servidor
                const respuesta = await fetch("../Modelo/perfilFoto.php", {
                    method: "DELETE",
                    credentials: "include"
                });
                const resultado = await respuesta.json();
                if (!respuesta.ok || !resultado.success) {
                    throw new Error(resultado.mensaje || "No se pudo quitar la foto");
                }

                // Limpia la foto local y restablece el avatar a la inicial del nombre
                fotoActual = null;
                localStorage.removeItem("fotoPerfil");
                if (inputFoto) inputFoto.value = "";
                actualizarNombreYAvatares();
                if (mensajeFoto) mensajeFoto.textContent = "Foto eliminada. Se muestra la inicial de tu nombre.";
            } catch (error) {
                if (mensajeFoto) mensajeFoto.textContent = error.message;
            } finally {
                btnUsarInicial.disabled = false;
            }
        });
    }

    // Permite elegir el color de fondo del avatar con la inicial del nombre
    document.querySelectorAll(".btn-tono-avatar").forEach((boton) => {
        boton.addEventListener("click", () => {
            tonoActual = boton.dataset.tono || "avatar-tono-vino";
            localStorage.setItem("avatarTono", tonoActual);
            actualizarNombreYAvatares();
        });
    });

    // Carga desde el servidor la foto persistida, el saldo actual y la actividad reciente del Asociado
    (async () => {
        try {
            // Consulta al backend los datos del usuario autenticado (nombre, foto, billetera y cuotas)
            const respuesta = await fetch("../Modelo/perfilFoto.php", {
                method: "GET",
                headers: { "Accept": "application/json" },
                credentials: "include"
            });
            const resultado = await respuesta.json();

            // Redirige al Login si la sesión expiró (HTTP 401)
            if (respuesta.status === 401) {
                localStorage.clear();
                window.location.href = "Login.html";
                return;
            }

            if (respuesta.ok && resultado.success) {
                // Sincroniza el nombre real con localStorage
                if (resultado.nombre) {
                    nombre = resultado.nombre;
                    localStorage.setItem("nombre", nombre);
                }
                // Sincroniza la foto de perfil guardada en la base de datos
                fotoActual = resultado.fotoPerfil || null;
                if (fotoActual) {
                    localStorage.setItem("fotoPerfil", fotoActual);
                } else {
                    localStorage.removeItem("fotoPerfil");
                }
                actualizarNombreYAvatares();

                // Si el usuario es Asociado, actualiza saldo de billetera, KPIs y tabla de cuotas pendientes
                if (!esAdmin) {
                    const saldoBilleteraTexto = formatearMonedaDashboard(resultado.saldoBilletera ?? 0);
                    if (saldoTop) saldoTop.textContent = saldoBilleteraTexto;

                    const elBilleteraMini = document.getElementById("saldoBilleteraMini");
                    if (elBilleteraMini) {
                        elBilleteraMini.textContent = saldoBilleteraTexto;
                    }

                    if (resultado.resumen) {
                        const elPend = document.getElementById("kpiCuotasPendientes");
                        const elPag = document.getElementById("kpiCuotasPagadas");
                        const elAct = document.getElementById("kpiCreditosActivos");
                        const elTot = document.getElementById("kpiTotalCuotas");
                        if (elPend) elPend.textContent = String(resultado.resumen.cuotasPendientes ?? 0);
                        if (elPag) elPag.textContent = String(resultado.resumen.cuotasPagadas ?? 0);
                        if (elAct) elAct.textContent = String(resultado.resumen.creditosActivos ?? 0);
                        if (elTot) elTot.textContent = String(resultado.resumen.totalCuotas ?? 0);
                    }
                    renderizarPagosPendientes(resultado.pagosPendientes || []);
                }
            }
        } catch (error) {
            console.error("Error al cargar datos del panel:", error);
            if (!esAdmin) renderizarPagosPendientes([]);
        }

        // Si el usuario es Administrador, carga notificaciones de solicitudes, KPIs globales y cartera
        if (esAdmin) {
            cargarNotificacionesAdmin();
            // Actualiza automáticamente la campana cada 15 segundos para detectar nuevas solicitudes
            setInterval(cargarNotificacionesAdmin, 15000);

            try {
                // Consulta el resumen consolidado de cartera y actividades desde gestionarReportes.php
                const respRep = await fetch("../Modelo/gestionarReportes.php", {
                    method: "GET",
                    headers: { "Accept": "application/json" },
                    credentials: "include"
                });
                const datosRep = await respRep.json();

                if (respRep.ok && datosRep.success) {
                    const cartera = Array.isArray(datosRep.cartera) ? datosRep.cartera : [];
                    const actividades = Array.isArray(datosRep.actividades) ? datosRep.actividades : [];

                    // Calcula el total de créditos otorgados y cuántos asociados tienen saldo pendiente
                    const totalCreditos = cartera.reduce((acc, item) => acc + Number(item.numCreditos || 0), 0);
                    const conPendiente = cartera.filter((item) => Number(item.saldoPendiente || 0) > 0).length;

                    // Actualiza las 4 tarjetas KPI del panel administrativo
                    const elAsoc = document.getElementById("adminKpiAsociados");
                    const elCred = document.getElementById("adminKpiCreditos");
                    const elAct = document.getElementById("adminKpiActividades");
                    const elPend = document.getElementById("adminKpiPendientes");

                    if (elAsoc) elAsoc.textContent = String(cartera.length);
                    if (elCred) elCred.textContent = String(totalCreditos);
                    if (elAct) elAct.textContent = String(actividades.length);
                    if (elPend) elPend.textContent = String(conPendiente);

                    // Dibuja la tabla consolidada de cartera de asociados
                    renderizarCarteraAdmin(cartera);
                } else {
                    renderizarCarteraAdmin([]);
                }
            } catch (error) {
                console.error("Error al cargar resumen administrativo:", error);
                renderizarCarteraAdmin([]);
            }
        }
    })();
});

// Función global para cerrar sesión desde el panel principal (Admin o Asociado)
async function cerrarSesion() {
    try {
        // Envía petición POST al backend para destruir la sesión PHP en el servidor
        const respuesta = await fetch("../Modelo/cerrarSesion.php", {
            method: "POST",
            credentials: "include"
        });

        // Verifica que el cierre de sesión en servidor haya sido exitoso
        if (!respuesta.ok) {
            throw new Error("Error al cerrar sesión");
        }

        // Limpia todos los datos guardados en localStorage y redirige a Login.html
        localStorage.clear();
        window.location.href = "Login.html";
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
    }
}
