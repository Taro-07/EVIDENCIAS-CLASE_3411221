// Formatea valores en pesos colombianos (COP) sin decimales sobrantes
function formatearMonedaDashboard(valor) {
    const numero = Number(valor || 0);
    const esEntero = Number.isInteger(numero);
    return numero.toLocaleString("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: esEntero ? 0 : 2,
        maximumFractionDigits: 2
    });
}

// Obtiene la inicial en mayúscula del nombre del usuario para el avatar por defecto
function obtenerInicialNombre(nombre) {
    const limpio = String(nombre || "").trim();
    return limpio.length > 0 ? limpio.charAt(0).toUpperCase() : "A";
}

// Aplica la foto subida o, por defecto, la inicial del nombre con el color elegido
function renderizarAvatar(elemento, nombre, fotoUrl, tono) {
    if (!elemento) return;
    elemento.classList.remove("avatar-tono-morado", "avatar-tono-vino", "avatar-tono-terracota", "avatar-tono-cobre", "avatar-tono-ciruela");
    elemento.classList.add(tono || "avatar-tono-vino");
    elemento.replaceChildren();

    if (fotoUrl) {
        const img = document.createElement("img");
        img.src = `${fotoUrl}?t=${Date.now()}`;
        img.alt = `Foto de perfil de ${nombre}`;
        // Si la imagen falla al cargar, muestra automáticamente la inicial del nombre
        img.onerror = () => {
            elemento.textContent = obtenerInicialNombre(nombre);
        };
        elemento.append(img);
    } else {
        elemento.textContent = obtenerInicialNombre(nombre);
    }
}

// Dibuja el listado de notificaciones pendientes dentro de la campana del Administrador
function renderizarNotificacionesAdmin(prestamos) {
    const contadorBadge = document.getElementById("contadorNotificacionesAdmin");
    const resumenHeader = document.getElementById("resumenNotifHeader");
    const lista = document.getElementById("listaNotificacionesAdmin");
    if (!lista) return;

    const pendientes = (Array.isArray(prestamos) ? prestamos : []).filter((p) => {
        const tipo = p.solicitudTipo || null;
        const estado = p.estadoAprobacion || "Aprobado";
        return estado === "Pendiente" || tipo === "crear" || tipo === "editar" || tipo === "eliminar";
    });

    const cantidad = pendientes.length;
    if (contadorBadge) {
        contadorBadge.textContent = cantidad > 99 ? "99+" : String(cantidad);
        contadorBadge.classList.toggle("d-none", cantidad === 0);
    }
    if (resumenHeader) {
        resumenHeader.textContent = `${cantidad} pendiente${cantidad === 1 ? "" : "s"}`;
    }

    if (cantidad === 0) {
        lista.innerHTML = `
            <div class="p-4 text-center">
                <i class="bi bi-check-circle fs-3 d-block mb-2" style="color: #198754;"></i>
                <div class="fw-semibold small" style="color: #2c172b;">Sin solicitudes pendientes</div>
                <div class="small text-muted">Te avisaremos aquí cuando un asociado envíe una solicitud.</div>
            </div>`;
        return;
    }

    lista.replaceChildren();
    pendientes.forEach((p) => {
        const enlace = document.createElement("a");
        enlace.href = "prestamos.html?v=9";
        enlace.className = "notif-item-admin";

        let claseIcono = "notif-ico-crear";
        let iconoHtml = '<i class="bi bi-cash-stack"></i>';
        let titulo = "Nueva solicitud de préstamo";
        let detalle = `${p.nombreAsociado || "Asociado"} solicitó ${formatearMonedaDashboard(p.ValorPrestamo)} (${p.NumeroCuotas || 0} cuotas).`;

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

        const cajaIcono = document.createElement("span");
        cajaIcono.className = `notif-item-icono ${claseIcono}`;
        cajaIcono.innerHTML = iconoHtml;

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

        cuerpo.append(tituloEl, descEl);
        enlace.append(cajaIcono, cuerpo);
        lista.append(enlace);
    });
}

// Consulta las solicitudes pendientes de préstamo para mantener al día la campana del Admin
async function cargarNotificacionesAdmin() {
    try {
        const resp = await fetch("../Modelo/gestionarPrestamos.php", {
            method: "GET",
            headers: { "Accept": "application/json" },
            credentials: "include"
        });
        const datos = await resp.json();
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

    const tbody = tabla.querySelector("tbody");
    cartera.forEach((item) => {
        const tr = document.createElement("tr");

        const tdDoc = document.createElement("td");
        tdDoc.className = "fw-bold";
        tdDoc.textContent = item.documento || "-";

        const tdNombre = document.createElement("td");
        tdNombre.textContent = item.nombreAsociado || "-";

        const tdCred = document.createElement("td");
        tdCred.className = "text-center fw-semibold";
        tdCred.textContent = String(item.numCreditos ?? 0);

        const tdPrest = document.createElement("td");
        tdPrest.className = "text-end fw-semibold";
        tdPrest.textContent = formatearMonedaDashboard(item.totalPrestado);

        const tdPag = document.createElement("td");
        tdPag.className = "text-end fw-semibold";
        tdPag.style.color = "#198754";
        tdPag.textContent = formatearMonedaDashboard(item.totalPagado);

        const tdSaldo = document.createElement("td");
        tdSaldo.className = "text-end fw-bold";
        tdSaldo.style.color = Number(item.saldoPendiente) > 0 ? "#c0284c" : "#198754";
        tdSaldo.textContent = formatearMonedaDashboard(item.saldoPendiente);

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

        tr.append(tdDoc, tdNombre, tdCred, tdPrest, tdPag, tdSaldo, tdEstado, tdAccion);
        tbody.append(tr);
    });

    tablaWrap.append(tabla);
    contenedor.replaceChildren(tablaWrap);
}

// Dibuja la tabla de "Historial de pagos pendientes" o el estado vacío en el panel del Asociado
function renderizarPagosPendientes(pagosPendientes) {
    const contenedor = document.getElementById("contenedorActividadReciente");
    if (!contenedor) return;

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

    const tbody = tabla.querySelector("tbody");
    pagosPendientes.forEach((item) => {
        const tr = document.createElement("tr");

        const tdCred = document.createElement("td");
        tdCred.className = "fw-bold";
        tdCred.style.color = "#5c1d22";
        tdCred.textContent = `Crédito #${item.idPrestamos}`;

        const tdFecha = document.createElement("td");
        tdFecha.textContent = item.fechaPrestamo || "-";

        const tdPagadas = document.createElement("td");
        tdPagadas.textContent = `${item.cuotasPagadas} / ${item.numeroCuotas}`;

        const tdPendientes = document.createElement("td");
        const badgePend = document.createElement("span");
        badgePend.className = "badge";
        badgePend.style.backgroundColor = "#fdf0e6";
        badgePend.style.color = "#b84324";
        badgePend.style.border = "1px solid #ecc6b1";
        badgePend.style.padding = "6px 10px";
        badgePend.textContent = `${item.cuotasPendientes} pendiente${item.cuotasPendientes === 1 ? "" : "s"}`;
        tdPendientes.append(badgePend);

        const tdCuota = document.createElement("td");
        tdCuota.textContent = formatearMonedaDashboard(item.valorCuotaAprox);

        const tdSaldo = document.createElement("td");
        tdSaldo.className = "fw-bold";
        tdSaldo.style.color = "#a82832";
        tdSaldo.textContent = formatearMonedaDashboard(item.saldoPendiente);

        const tdAccion = document.createElement("td");
        tdAccion.className = "text-end";
        const btnAbonar = document.createElement("a");
        btnAbonar.href = "pagos.html?v=4";
        btnAbonar.className = "btn-accion-primaria btn-sm";
        btnAbonar.style.padding = "5px 12px";
        btnAbonar.style.fontSize = "0.82rem";
        btnAbonar.innerHTML = '<i class="bi bi-cash-coin me-1"></i>Abonar';
        tdAccion.append(btnAbonar);

        tr.append(tdCred, tdFecha, tdPagadas, tdPendientes, tdCuota, tdSaldo, tdAccion);
        tbody.append(tr);
    });

    tablaWrap.append(tabla);
    contenedor.replaceChildren(tablaWrap);
}

// Se ejecuta cuando todo el HTML del panel principal ha cargado
document.addEventListener("DOMContentLoaded", () => {
    const logueado = localStorage.getItem("logueado");
    if (logueado !== "true") {
        window.location.href = "Login.html";
        return;
    }

    const rol = (localStorage.getItem("rol") || "").toLowerCase();
    const esAdmin = rol === "admin";
    let nombre = localStorage.getItem("nombre") || (esAdmin ? "Administrador" : "Asociado");

    const vistaAdmin = document.getElementById("vistaAdminDashboard");
    const vistaAsociado = document.getElementById("vistaAsociadoDashboard");

    document.body.classList.toggle("tema-admin", esAdmin);
    document.body.classList.toggle("tema-asociado", !esAdmin);
    if (vistaAdmin) vistaAdmin.classList.toggle("d-none", !esAdmin);
    if (vistaAsociado) vistaAsociado.classList.toggle("d-none", esAdmin);

    const nombreTop = document.getElementById(esAdmin ? "nombreUsuarioAdmin" : "nombreUsuario");
    const saludoNombre = document.getElementById(esAdmin ? "saludoNombreAdmin" : "saludoNombreAsociado");
    const nombreModal = document.getElementById("nombreModalFoto");
    const avatarTop = document.getElementById(esAdmin ? "avatarTopAdmin" : "avatarTopAsociado");
    const avatarPreview = document.getElementById("avatarPreviewModal");
    const saldoTop = document.getElementById("saldoTopAsociado");
    const mensajeFoto = document.getElementById("mensajeFotoPerfil");

    let fotoActual = localStorage.getItem("fotoPerfil") || null;
    let tonoActual = localStorage.getItem("avatarTono") || (esAdmin ? "avatar-tono-morado" : "avatar-tono-vino");

    const btnUsarInicial = document.getElementById("btnUsarInicial");
    const selectorColorAvatar = document.getElementById("selectorColorAvatar");

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
        document.querySelectorAll(".btn-tono-avatar").forEach((btn) => {
            btn.classList.toggle("activo", btn.dataset.tono === tonoActual);
        });
    };

    actualizarNombreYAvatares();

    // Menú lateral colapsable en pantallas móviles (Admin o Asociado)
    const sidebar = document.getElementById(esAdmin ? "sidebarAdmin" : "sidebarAsociado");
    const overlay = document.getElementById(esAdmin ? "sidebarOverlayAdmin" : "sidebarOverlay");
    const btnAbrirSidebar = document.getElementById(esAdmin ? "btnAbrirSidebarAdmin" : "btnAbrirSidebar");
    if (btnAbrirSidebar && sidebar && overlay) {
        btnAbrirSidebar.addEventListener("click", () => {
            sidebar.classList.toggle("abierta");
            overlay.classList.toggle("activo");
        });
        overlay.addEventListener("click", () => {
            sidebar.classList.remove("abierta");
            overlay.classList.remove("activo");
        });
    }

    // Despliega u oculta la vista pequeña de Mi Billetera al hacer clic en el botón "Saldo" (Asociado)
    const btnToggleBilletera = document.getElementById("btnToggleMiniBilletera");
    const popoverBilletera = document.getElementById("popoverMiniBilletera");
    const btnCerrarBilletera = document.getElementById("btnCerrarMiniBilletera");

    const cerrarPopoverBilletera = () => {
        if (!popoverBilletera || !btnToggleBilletera) return;
        popoverBilletera.classList.add("d-none");
        btnToggleBilletera.setAttribute("aria-expanded", "false");
    };

    if (!esAdmin && btnToggleBilletera && popoverBilletera) {
        btnToggleBilletera.addEventListener("click", (e) => {
            e.stopPropagation();
            const estaOculto = popoverBilletera.classList.contains("d-none");
            popoverBilletera.classList.toggle("d-none", !estaOculto);
            btnToggleBilletera.setAttribute("aria-expanded", estaOculto ? "true" : "false");
        });

        popoverBilletera.addEventListener("click", (e) => {
            e.stopPropagation();
        });

        if (btnCerrarBilletera) {
            btnCerrarBilletera.addEventListener("click", cerrarPopoverBilletera);
        }

        document.addEventListener("click", cerrarPopoverBilletera);
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") cerrarPopoverBilletera();
        });
    }

    // Despliega u oculta el menú de notificaciones al pulsar la campana del Administrador
    const btnNotifAdmin = document.getElementById("btnNotificacionesAdmin");
    const popoverNotifAdmin = document.getElementById("popoverNotificacionesAdmin");
    const btnCerrarNotifAdmin = document.getElementById("btnCerrarNotifAdmin");

    const cerrarPopoverNotifAdmin = () => {
        if (!popoverNotifAdmin || !btnNotifAdmin) return;
        popoverNotifAdmin.classList.add("d-none");
        btnNotifAdmin.setAttribute("aria-expanded", "false");
    };

    if (esAdmin && btnNotifAdmin && popoverNotifAdmin) {
        btnNotifAdmin.addEventListener("click", (e) => {
            e.stopPropagation();
            const estaOculto = popoverNotifAdmin.classList.contains("d-none");
            popoverNotifAdmin.classList.toggle("d-none", !estaOculto);
            btnNotifAdmin.setAttribute("aria-expanded", estaOculto ? "true" : "false");
            if (estaOculto) {
                cargarNotificacionesAdmin();
            }
        });

        popoverNotifAdmin.addEventListener("click", (e) => {
            e.stopPropagation();
        });

        if (btnCerrarNotifAdmin) {
            btnCerrarNotifAdmin.addEventListener("click", cerrarPopoverNotifAdmin);
        }

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
            const archivo = inputFoto?.files?.[0];
            if (!archivo) {
                if (mensajeFoto) mensajeFoto.textContent = "Primero selecciona una imagen desde tu dispositivo.";
                return;
            }

            const formData = new FormData();
            formData.append("foto", archivo);

            if (btnGuardarFoto) btnGuardarFoto.disabled = true;
            if (mensajeFoto) mensajeFoto.textContent = "Subiendo foto...";

            try {
                const respuesta = await fetch("../Modelo/perfilFoto.php", {
                    method: "POST",
                    credentials: "include",
                    body: formData
                });
                const resultado = await respuesta.json();

                if (!respuesta.ok || !resultado.success) {
                    throw new Error(resultado.mensaje || "No se pudo subir la foto");
                }

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
                const respuesta = await fetch("../Modelo/perfilFoto.php", {
                    method: "DELETE",
                    credentials: "include"
                });
                const resultado = await respuesta.json();
                if (!respuesta.ok || !resultado.success) {
                    throw new Error(resultado.mensaje || "No se pudo quitar la foto");
                }

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
            const respuesta = await fetch("../Modelo/perfilFoto.php", {
                method: "GET",
                headers: { "Accept": "application/json" },
                credentials: "include"
            });
            const resultado = await respuesta.json();

            if (respuesta.status === 401) {
                localStorage.clear();
                window.location.href = "Login.html";
                return;
            }

            if (respuesta.ok && resultado.success) {
                if (resultado.nombre) {
                    nombre = resultado.nombre;
                    localStorage.setItem("nombre", nombre);
                }
                fotoActual = resultado.fotoPerfil || null;
                if (fotoActual) {
                    localStorage.setItem("fotoPerfil", fotoActual);
                } else {
                    localStorage.removeItem("fotoPerfil");
                }
                actualizarNombreYAvatares();

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
                const respRep = await fetch("../Modelo/gestionarReportes.php", {
                    method: "GET",
                    headers: { "Accept": "application/json" },
                    credentials: "include"
                });
                const datosRep = await respRep.json();

                if (respRep.ok && datosRep.success) {
                    const cartera = Array.isArray(datosRep.cartera) ? datosRep.cartera : [];
                    const actividades = Array.isArray(datosRep.actividades) ? datosRep.actividades : [];

                    const totalCreditos = cartera.reduce((acc, item) => acc + Number(item.numCreditos || 0), 0);
                    const conPendiente = cartera.filter((item) => Number(item.saldoPendiente || 0) > 0).length;

                    const elAsoc = document.getElementById("adminKpiAsociados");
                    const elCred = document.getElementById("adminKpiCreditos");
                    const elAct = document.getElementById("adminKpiActividades");
                    const elPend = document.getElementById("adminKpiPendientes");

                    if (elAsoc) elAsoc.textContent = String(cartera.length);
                    if (elCred) elCred.textContent = String(totalCreditos);
                    if (elAct) elAct.textContent = String(actividades.length);
                    if (elPend) elPend.textContent = String(conPendiente);

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
