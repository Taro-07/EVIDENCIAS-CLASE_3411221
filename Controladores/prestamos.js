// Referencias a los elementos HTML del módulo Préstamos (vista Admin - solo aprobación)
const listaPrestamos = document.getElementById("listaPrestamos");
const totalPrestamos = document.getElementById("totalPrestamos");

// Referencias a los elementos HTML de la vista de 2 columnas (rol Asociado)
const formPrestamoAsociado = document.getElementById("formPrestamoAsociado");
const asocSelectAsociado = document.getElementById("asocSelectAsociado");
const btnGuardarPrestamoAsociado = document.getElementById("btnGuardarPrestamoAsociado");
const mensajePrestamoAsociado = document.getElementById("mensajePrestamoAsociado");
const listaPrestamosAsociado = document.getElementById("listaPrestamosAsociado");
const totalPrestamosAsociado = document.getElementById("totalPrestamosAsociado");

// Estado local del rol del usuario y arreglo de préstamos cargados
let esAdministrador = (localStorage.getItem("rol") || "").toLowerCase() === "admin";
let prestamosLista = [];

// Envía peticiones GET, POST, PUT o DELETE al endpoint ../Modelo/gestionarPrestamos.php
async function solicitarApiPrestamos(metodo, datos) {
    const opciones = {
        method: metodo,
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        credentials: "include"
    };

    if (datos) {
        opciones.body = JSON.stringify(datos);
    }

    const respuesta = await fetch("../Modelo/gestionarPrestamos.php", opciones);
    const texto = await respuesta.text();

    let resultado = {};
    try {
        resultado = JSON.parse(texto);
    } catch {
        throw new Error(`Respuesta inválida del servidor (HTTP ${respuesta.status})`);
    }

    if (respuesta.status === 401) {
        localStorage.clear();
        window.location.href = "Login.html";
        throw new Error(resultado.mensaje || "Sesión expirada");
    }

    if (!respuesta.ok || !resultado.success) {
        throw new Error(resultado.mensaje || resultado.message || "Error en la solicitud");
    }

    return resultado;
}

// Crea una celda <td> con texto plano seguro y usa "-" si el dato está vacío
function crearCelda(texto, clase = "") {
    const td = document.createElement("td");
    if (clase) td.className = clase;
    td.textContent = texto !== null && texto !== undefined && String(texto).trim() !== "" ? String(texto) : "-";
    return td;
}

// Formatea cifras numéricas como moneda en pesos colombianos (COP) sin decimales innecesarios
function formatearMoneda(valor) {
    if (valor === null || valor === undefined || valor === "") return "-";
    const numero = Number(valor);
    const esEntero = Number.isInteger(numero);
    return numero.toLocaleString("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: esEntero ? 0 : 2,
        maximumFractionDigits: 2
    });
}

// Determina automáticamente la tasa de interés mensual (%) según el valor del préstamo en COP
function obtenerTasaSegunMonto(valor) {
    const monto = Number(valor);
    if (!Number.isFinite(monto) || monto <= 0) {
        return null;
    }
    if (monto <= 500000) {
        return { tasa: 1.0, rango: "Hasta $500.000" };
    }
    if (monto <= 2000000) {
        return { tasa: 1.5, rango: "$500.001 – $2.000.000" };
    }
    if (monto <= 5000000) {
        return { tasa: 2.0, rango: "$2.000.001 – $5.000.000" };
    }
    if (monto <= 10000000) {
        return { tasa: 2.5, rango: "$5.000.001 – $10.000.000" };
    }
    return { tasa: 3.0, rango: "Más de $10.000.000" };
}

// Calcula la cuota base, el valor adicional por interés y el total por cuota, actualizando el panel resumen
function actualizarCalculoPrestamo({
    inputMonto,
    inputTasa,
    inputCuotas,
    contenedorResumen,
    elementoInfoTasa
}) {
    if (!inputMonto || !inputTasa || !contenedorResumen) return;

    const monto = Number(inputMonto.value);
    const cuotas = parseInt(inputCuotas?.value || "0", 10);
    const infoTasa = obtenerTasaSegunMonto(monto);

    if (!infoTasa) {
        inputTasa.value = "";
        if (elementoInfoTasa) {
            elementoInfoTasa.textContent = "La tasa de interés se asigna automáticamente según el valor del préstamo.";
        }
        contenedorResumen.classList.add("d-none");
        contenedorResumen.replaceChildren();
        return;
    }

    inputTasa.value = String(infoTasa.tasa);
    const tasaFinal = infoTasa.tasa;

    if (elementoInfoTasa) {
        elementoInfoTasa.textContent = `Rango ${infoTasa.rango}: tasa automática del ${tasaFinal}% mensual.`;
    }

    const adicionalPorCuota = Math.round(monto * (tasaFinal / 100) * 100) / 100;

    if (!Number.isInteger(cuotas) || cuotas < 1) {
        contenedorResumen.classList.remove("d-none");
        contenedorResumen.innerHTML = `
            <div class="resumen-cuota-titulo">
                <i class="bi bi-calculator me-1"></i>Tasa asignada: ${tasaFinal}% mensual
            </div>
            <div class="resumen-cuota-fila">
                <span>Adicional por interés (por cuota):</span>
                <span class="resumen-cuota-adicional">+ ${formatearMoneda(adicionalPorCuota)}</span>
            </div>
            <div class="resumen-cuota-nota">
                Ingresa el <strong>N° de cuotas</strong> para ver tu cuota base y el valor total a pagar cada mes.
            </div>`;
        return;
    }

    const cuotaBase = Math.round((monto / cuotas) * 100) / 100;
    const cuotaTotal = Math.round((cuotaBase + adicionalPorCuota) * 100) / 100;
    const interesTotal = Math.round(adicionalPorCuota * cuotas * 100) / 100;
    const totalConInteres = Math.round((monto + interesTotal) * 100) / 100;

    contenedorResumen.classList.remove("d-none");
    contenedorResumen.innerHTML = `
        <div class="resumen-cuota-titulo">
            <i class="bi bi-calculator me-1"></i>Detalle de Cuota (${tasaFinal}% mensual)
        </div>
        <div class="resumen-cuota-fila">
            <span>Cuota establecida (capital):</span>
            <strong>${formatearMoneda(cuotaBase)}</strong>
        </div>
        <div class="resumen-cuota-fila">
            <span>Adicional por interés / cuota:</span>
            <span class="resumen-cuota-adicional">+ ${formatearMoneda(adicionalPorCuota)}</span>
        </div>
        <div class="resumen-cuota-fila resumen-cuota-total">
            <span>Total a pagar por cuota:</span>
            <span>${formatearMoneda(cuotaTotal)}</span>
        </div>
        <div class="resumen-cuota-nota">
            Interés total en ${cuotas} cuota${cuotas === 1 ? "" : "s"}: <strong>${formatearMoneda(interesTotal)}</strong> · Total del crédito: <strong>${formatearMoneda(totalConInteres)}</strong>
        </div>`;
}

// Construye la insignia de estado de aprobación para una fila de préstamo
function crearBadgeEstadoPrestamo(prestamo) {
    const span = document.createElement("span");
    const tipo = prestamo.solicitudTipo || null;
    const estado = prestamo.estadoAprobacion || "Aprobado";

    if (tipo === "eliminar") {
        span.className = "badge badge-estado-eliminacion";
        span.innerHTML = '<i class="bi bi-trash3 me-1"></i>Eliminación pendiente';
        return span;
    }
    if (tipo === "editar") {
        span.className = "badge badge-estado-edicion";
        span.innerHTML = '<i class="bi bi-pencil-square me-1"></i>Edición pendiente';
        return span;
    }
    if (estado === "Pendiente" || tipo === "crear") {
        span.className = "badge badge-estado-pendiente";
        span.innerHTML = '<i class="bi bi-clock-history me-1"></i>Pendiente de aprobación';
        return span;
    }
    span.className = "badge badge-estado-aprobado";
    span.innerHTML = '<i class="bi bi-check-circle me-1"></i>Aprobado';
    return span;
}

// Muestra alerta de confirmación encima de la tabla de Admin
function mostrarAlertaAdminPrestamos(texto, tipo = "success") {
    const alerta = document.getElementById("alertaAdminPrestamos");
    if (!alerta) return;
    alerta.className = `alert alert-${tipo} mb-3`;
    alerta.textContent = texto;
}

// Muestra alerta de confirmación encima del historial del Asociado
function mostrarAlertaAsociadoPrestamos(texto, tipo = "warning") {
    const alerta = document.getElementById("alertaAsociadoPrestamos");
    if (!alerta) return;
    alerta.className = `alert alert-${tipo} mb-3`;
    alerta.textContent = texto;
}

// Dibuja todas las solicitudes de préstamo en la vista Admin (el Admin SOLO acepta solicitudes)
function mostrarPrestamosAdmin() {
    if (!listaPrestamos) return;
    listaPrestamos.replaceChildren();

    if (totalPrestamos) {
        totalPrestamos.textContent = String(prestamosLista.length);
    }

    if (prestamosLista.length === 0) {
        const fila = document.createElement("tr");
        const celda = document.createElement("td");
        celda.colSpan = 9;
        celda.className = "text-center py-4 text-muted";
        celda.textContent = "No hay solicitudes de préstamo registradas.";
        fila.append(celda);
        listaPrestamos.append(fila);
        return;
    }

    prestamosLista.forEach((prestamo, indice) => {
        const fila = document.createElement("tr");
        const plazoTexto = prestamo.NumeroCuotas ? `${prestamo.NumeroCuotas} meses` : "-";
        const tasaTexto =
            prestamo.TasaInteres !== null && prestamo.TasaInteres !== undefined
                ? `${Number(prestamo.TasaInteres)}%`
                : "-";

        const celdaPlazo = document.createElement("td");
        const badgePlazo = document.createElement("span");
        badgePlazo.className = "badge badge-plazo-admin";
        badgePlazo.textContent = plazoTexto;
        celdaPlazo.append(badgePlazo);

        // Columna Estado / Solicitud (si es edición pendiente muestra vista previa de los nuevos valores)
        const celdaEstado = document.createElement("td");
        celdaEstado.append(crearBadgeEstadoPrestamo(prestamo));
        if (prestamo.solicitudTipo === "editar" && prestamo.solicitudDatos) {
            const prop = prestamo.solicitudDatos;
            const detalle = document.createElement("div");
            detalle.className = "detalle-cambio-admin";
            detalle.textContent = `Propuesto: ${formatearMoneda(prop.ValorPrestamo)} · ${prop.NumeroCuotas} meses · ${prop.TasaInteres}% · ${prop.FechaPrestamo}`;
            celdaEstado.append(document.createElement("br"), detalle);
        }

        // Columna Aprobación: el Admin solo tiene el botón Aceptar cuando hay una solicitud pendiente
        const celdaAccion = document.createElement("td");
        celdaAccion.className = "text-nowrap text-center";

        const tienePendiente =
            prestamo.estadoAprobacion === "Pendiente" ||
            prestamo.solicitudTipo === "crear" ||
            prestamo.solicitudTipo === "editar" ||
            prestamo.solicitudTipo === "eliminar";

        if (tienePendiente) {
            const botonAceptar = document.createElement("button");
            botonAceptar.type = "button";
            botonAceptar.className = "btn-aceptar-admin";

            let textoBoton = "Aceptar préstamo";
            if (prestamo.solicitudTipo === "editar") {
                textoBoton = "Aceptar edición";
            } else if (prestamo.solicitudTipo === "eliminar") {
                textoBoton = "Aceptar eliminación";
            }

            botonAceptar.innerHTML = `<i class="bi bi-check2-circle"></i> ${textoBoton}`;
            botonAceptar.addEventListener("click", () => aprobarSolicitudPrestamo(prestamo, botonAceptar));
            celdaAccion.append(botonAceptar);
        } else {
            const aprobadoSpan = document.createElement("span");
            aprobadoSpan.className = "small fw-semibold text-success";
            aprobadoSpan.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i>Aceptado';
            celdaAccion.append(aprobadoSpan);
        }

        fila.append(
            crearCelda(indice + 1, "fw-bold text-muted"),
            crearCelda(prestamo.documento, "fw-semibold"),
            crearCelda(prestamo.nombreAsociado),
            crearCelda(formatearMoneda(prestamo.ValorPrestamo), "fw-bold texto-monto-admin"),
            celdaPlazo,
            crearCelda(tasaTexto, "fw-medium"),
            crearCelda(prestamo.FechaPrestamo, "text-nowrap"),
            celdaEstado,
            celdaAccion
        );

        listaPrestamos.append(fila);
    });
}

// Envía la aprobación del Admin (PUT con accion: "aprobar") para aplicar la solicitud del Asociado
async function aprobarSolicitudPrestamo(prestamo, boton) {
    let mensajeConfirm = `¿Desea aprobar la solicitud del préstamo #${prestamo.idPrestamos} de ${prestamo.nombreAsociado}?`;
    if (prestamo.solicitudTipo === "editar") {
        mensajeConfirm = `¿Desea aprobar y aplicar los cambios solicitados para el préstamo #${prestamo.idPrestamos}?`;
    } else if (prestamo.solicitudTipo === "eliminar") {
        mensajeConfirm = `¿Desea aprobar la eliminación definitiva del préstamo #${prestamo.idPrestamos}?`;
    }

    if (!window.confirm(mensajeConfirm)) return;

    if (boton) boton.disabled = true;
    try {
        const resultado = await solicitarApiPrestamos("PUT", {
            idPrestamos: prestamo.idPrestamos,
            accion: "aprobar"
        });
        mostrarAlertaAdminPrestamos(resultado.mensaje || "Solicitud aprobada correctamente.", "success");
        await cargarPrestamos();
    } catch (error) {
        mostrarAlertaAdminPrestamos(error.message, "danger");
        if (boton) boton.disabled = false;
    }
}

// Dibuja la tabla "Historial de Créditos" para el rol Asociado con botones independientes Editar y Eliminar
function mostrarPrestamosAsociado() {
    if (!listaPrestamosAsociado) return;
    listaPrestamosAsociado.replaceChildren();

    if (totalPrestamosAsociado) {
        totalPrestamosAsociado.textContent = String(prestamosLista.length);
    }

    if (prestamosLista.length === 0) {
        const fila = document.createElement("tr");
        const celda = document.createElement("td");
        celda.colSpan = 7;
        celda.className = "text-center py-4 text-muted";
        celda.textContent = "Aún no tienes créditos registrados.";
        fila.append(celda);
        listaPrestamosAsociado.append(fila);
        return;
    }

    prestamosLista.forEach((prestamo) => {
        const fila = document.createElement("tr");
        const tasaTexto =
            prestamo.TasaInteres !== null && prestamo.TasaInteres !== undefined
                ? `${Number(prestamo.TasaInteres)}%`
                : "-";

        const celdaEstado = document.createElement("td");
        celdaEstado.append(crearBadgeEstadoPrestamo(prestamo));

        // Dos botones completamente independientes: Editar y Eliminar (cada uno abre su propia alerta emergente)
        const celdaAcciones = document.createElement("td");
        celdaAcciones.className = "text-center text-nowrap";

        const botonEditar = document.createElement("button");
        botonEditar.type = "button";
        botonEditar.className = "btn btn-sm btn-editar-credito me-1";
        botonEditar.innerHTML = '<i class="bi bi-pencil"></i>';
        botonEditar.title = "Solicitar edición de este préstamo";
        botonEditar.addEventListener("click", () => abrirModalSolicitudEdicion(prestamo));

        const botonEliminar = document.createElement("button");
        botonEliminar.type = "button";
        botonEliminar.className = "btn btn-sm btn-eliminar-credito";
        botonEliminar.innerHTML = '<i class="bi bi-trash"></i>';
        botonEliminar.title = "Solicitar eliminación de este préstamo";
        botonEliminar.addEventListener("click", () => abrirModalSolicitudEliminacion(prestamo));

        celdaAcciones.append(botonEditar, botonEliminar);

        fila.append(
            crearCelda(`#${prestamo.idPrestamos}`, "fw-bold"),
            crearCelda(formatearMoneda(prestamo.ValorPrestamo), "fw-semibold"),
            crearCelda(tasaTexto),
            crearCelda(prestamo.NumeroCuotas),
            crearCelda(prestamo.FechaPrestamo, "text-nowrap"),
            celdaEstado,
            celdaAcciones
        );

        listaPrestamosAsociado.append(fila);
    });
}

// Instancias independientes de los 2 modales emergentes de alerta del Asociado
let modalEdicionAsocInstancia = null;
let modalEliminacionAsocInstancia = null;

function obtenerModalEdicionAsoc() {
    if (!modalEdicionAsocInstancia) {
        const el = document.getElementById("modalSolicitarEdicionAsociado");
        if (el && window.bootstrap) modalEdicionAsocInstancia = new bootstrap.Modal(el);
    }
    return modalEdicionAsocInstancia;
}

function obtenerModalEliminacionAsoc() {
    if (!modalEliminacionAsocInstancia) {
        const el = document.getElementById("modalSolicitarEliminacionAsociado");
        if (el && window.bootstrap) modalEliminacionAsocInstancia = new bootstrap.Modal(el);
    }
    return modalEliminacionAsocInstancia;
}

// Abre la alerta emergente independiente de Editar (Asociado) con los datos actuales del préstamo
function abrirModalSolicitudEdicion(prestamo) {
    const origen = prestamo.solicitudTipo === "editar" && prestamo.solicitudDatos ? prestamo.solicitudDatos : prestamo;

    document.getElementById("editAsocIdPrestamo").value = prestamo.idPrestamos;
    document.getElementById("editAsocValorPrestamo").value = Number(origen.ValorPrestamo ?? 0);
    document.getElementById("editAsocNumeroCuotas").value = Number(origen.NumeroCuotas ?? 1);
    document.getElementById("editAsocFechaPrestamo").value = origen.FechaPrestamo ?? "";

    const msg = document.getElementById("msgModalEdicionAsoc");
    if (msg) msg.textContent = "";

    actualizarCalculoPrestamo({
        inputMonto: document.getElementById("editAsocValorPrestamo"),
        inputTasa: document.getElementById("editAsocTasaInteres"),
        inputCuotas: document.getElementById("editAsocNumeroCuotas"),
        contenedorResumen: document.getElementById("resumenCalculoEdicionAsociado"),
        elementoInfoTasa: document.getElementById("infoTasaEdicionAsociado")
    });

    const modal = obtenerModalEdicionAsoc();
    if (modal) modal.show();
}

// Abre la alerta emergente independiente de Eliminar (Asociado)
function abrirModalSolicitudEliminacion(prestamo) {
    document.getElementById("deleteAsocIdPrestamo").value = prestamo.idPrestamos;

    const resumen = document.getElementById("resumenEliminarPrestamoAsoc");
    if (resumen) {
        resumen.innerHTML = `
            <div><strong>Crédito #${prestamo.idPrestamos}</strong></div>
            <div>Valor: <strong>${formatearMoneda(prestamo.ValorPrestamo)}</strong> · Plazo: <strong>${prestamo.NumeroCuotas} cuotas</strong> · Fecha: <strong>${prestamo.FechaPrestamo || "-"}</strong></div>`;
    }

    const msg = document.getElementById("msgModalEliminacionAsoc");
    if (msg) msg.textContent = "";

    const modal = obtenerModalEliminacionAsoc();
    if (modal) modal.show();
}

// Llena el selector de Asociado en la tarjeta izquierda con los datos del usuario autenticado
function mostrarAsociadoActual(asociadoActual) {
    if (!asocSelectAsociado) return;
    asocSelectAsociado.replaceChildren();

    const nombre = asociadoActual?.nombreCompleto || localStorage.getItem("nombre") || "Asociado";
    const documento = asociadoActual?.documento ?? "";
    const opcion = document.createElement("option");
    opcion.value = String(documento);
    opcion.textContent = documento ? `${nombre} (Doc: ${documento})` : nombre;
    opcion.selected = true;
    asocSelectAsociado.append(opcion);
}

// Consulta todos los préstamos al servidor por GET y actualiza la vista correspondiente al rol
async function cargarPrestamos() {
    try {
        const resultado = await solicitarApiPrestamos("GET");
        esAdministrador = (resultado.rol || "").toLowerCase() === "admin";

        const encabezadoAcciones = document.getElementById("encabezadoAccionesPrestamo");
        if (encabezadoAcciones) {
            encabezadoAcciones.classList.toggle("d-none", !esAdministrador);
        }
        document.querySelectorAll("[data-solo-admin]").forEach((elemento) => {
            elemento.classList.toggle("d-none", !esAdministrador);
        });
        document.querySelectorAll("[data-solo-asociado]").forEach((elemento) => {
            elemento.classList.toggle("d-none", esAdministrador);
        });

        prestamosLista = Array.isArray(resultado.prestamos) ? resultado.prestamos : [];

        if (esAdministrador) {
            mostrarPrestamosAdmin();
        } else {
            mostrarAsociadoActual(resultado.asociadoActual);
            mostrarPrestamosAsociado();
        }
    } catch (error) {
        console.error("Error al cargar préstamos:", error);
        if (esAdministrador && listaPrestamos) {
            listaPrestamos.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-danger">${error.message}</td></tr>`;
        } else if (listaPrestamosAsociado) {
            listaPrestamosAsociado.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-danger">${error.message}</td></tr>`;
        }
    }
}

// Envío del formulario "Solicitar / Registrar Préstamo" de la vista Asociado (POST -> queda Pendiente hasta aprobación del Admin)
if (formPrestamoAsociado) {
    formPrestamoAsociado.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        const datos = {
            ValorPrestamo: Number(document.getElementById("asocValorPrestamo").value),
            TasaInteres: Number(document.getElementById("asocTasaInteres").value),
            NumeroCuotas: Number(document.getElementById("asocNumeroCuotas").value),
            FechaPrestamo: document.getElementById("asocFechaPrestamo").value,
            Proposito: ""
        };

        if (btnGuardarPrestamoAsociado) btnGuardarPrestamoAsociado.disabled = true;
        if (mensajePrestamoAsociado) mensajePrestamoAsociado.textContent = "";

        try {
            const resultado = await solicitarApiPrestamos("POST", datos);
            formPrestamoAsociado.reset();
            const resumenAsoc = document.getElementById("resumenCalculoPrestamoAsociado");
            if (resumenAsoc) {
                resumenAsoc.classList.add("d-none");
                resumenAsoc.replaceChildren();
            }
            const infoTasaAsoc = document.getElementById("infoTasaAsociado");
            if (infoTasaAsoc) {
                infoTasaAsoc.textContent = "La tasa de interés se asigna automáticamente según el valor del préstamo.";
            }
            mostrarAlertaAsociadoPrestamos(
                resultado.mensaje || "Solicitud de préstamo enviada. Debes esperar a que el administrador la apruebe.",
                "warning"
            );
            await cargarPrestamos();
        } catch (error) {
            if (mensajePrestamoAsociado) {
                mensajePrestamoAsociado.textContent = error.message;
            } else {
                alert(error.message);
            }
        } finally {
            if (btnGuardarPrestamoAsociado) btnGuardarPrestamoAsociado.disabled = false;
        }
    });
}

// Envío independiente de solicitud de EDICIÓN desde el modal emergente del Asociado (PUT)
const formSolicitarEdicionAsociado = document.getElementById("formSolicitarEdicionAsociado");
if (formSolicitarEdicionAsociado) {
    formSolicitarEdicionAsociado.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        const btnEnviar = document.getElementById("btnEnviarSolicitudEdicion");
        const msg = document.getElementById("msgModalEdicionAsoc");
        const datos = {
            idPrestamos: Number(document.getElementById("editAsocIdPrestamo").value),
            ValorPrestamo: Number(document.getElementById("editAsocValorPrestamo").value),
            NumeroCuotas: Number(document.getElementById("editAsocNumeroCuotas").value),
            FechaPrestamo: document.getElementById("editAsocFechaPrestamo").value,
            Proposito: ""
        };

        if (btnEnviar) btnEnviar.disabled = true;
        if (msg) msg.textContent = "";

        try {
            const resultado = await solicitarApiPrestamos("PUT", datos);
            const modal = obtenerModalEdicionAsoc();
            if (modal) modal.hide();
            mostrarAlertaAsociadoPrestamos(
                resultado.mensaje || "Solicitud de edición enviada. Debes esperar a que el administrador apruebe el cambio.",
                "info"
            );
            await cargarPrestamos();
        } catch (error) {
            if (msg) msg.textContent = error.message;
        } finally {
            if (btnEnviar) btnEnviar.disabled = false;
        }
    });
}

// Envío independiente de solicitud de ELIMINACIÓN desde el modal emergente del Asociado (DELETE)
const btnEnviarSolicitudEliminacion = document.getElementById("btnEnviarSolicitudEliminacion");
if (btnEnviarSolicitudEliminacion) {
    btnEnviarSolicitudEliminacion.addEventListener("click", async () => {
        const idPrestamos = Number(document.getElementById("deleteAsocIdPrestamo").value);
        const msg = document.getElementById("msgModalEliminacionAsoc");

        btnEnviarSolicitudEliminacion.disabled = true;
        if (msg) msg.textContent = "";

        try {
            const resultado = await solicitarApiPrestamos("DELETE", { idPrestamos });
            const modal = obtenerModalEliminacionAsoc();
            if (modal) modal.hide();
            mostrarAlertaAsociadoPrestamos(
                resultado.mensaje || "Solicitud de eliminación enviada. Debes esperar a que el administrador la apruebe.",
                "warning"
            );
            await cargarPrestamos();
        } catch (error) {
            if (msg) msg.textContent = error.message;
        } finally {
            btnEnviarSolicitudEliminacion.disabled = false;
        }
    });
}

// Cálculo automático de tasa e interés adicional en el formulario de creación del Asociado
const inputMontoAsoc = document.getElementById("asocValorPrestamo");
const inputTasaAsoc = document.getElementById("asocTasaInteres");
const inputCuotasAsoc = document.getElementById("asocNumeroCuotas");
const resumenAsocEl = document.getElementById("resumenCalculoPrestamoAsociado");
const infoTasaAsocEl = document.getElementById("infoTasaAsociado");

if (inputMontoAsoc && inputTasaAsoc && inputCuotasAsoc) {
    const recalcularAsoc = () => {
        actualizarCalculoPrestamo({
            inputMonto: inputMontoAsoc,
            inputTasa: inputTasaAsoc,
            inputCuotas: inputCuotasAsoc,
            contenedorResumen: resumenAsocEl,
            elementoInfoTasa: infoTasaAsocEl
        });
    };
    inputMontoAsoc.addEventListener("input", recalcularAsoc);
    inputCuotasAsoc.addEventListener("input", recalcularAsoc);
}

// Cálculo automático de tasa e interés adicional dentro del modal independiente de solicitud de edición (Asociado)
const editMontoAsoc = document.getElementById("editAsocValorPrestamo");
const editTasaAsoc = document.getElementById("editAsocTasaInteres");
const editCuotasAsoc = document.getElementById("editAsocNumeroCuotas");
const resumenEditAsocEl = document.getElementById("resumenCalculoEdicionAsociado");
const infoTasaEditAsocEl = document.getElementById("infoTasaEdicionAsociado");

if (editMontoAsoc && editTasaAsoc && editCuotasAsoc) {
    const recalcularEditAsoc = () => {
        actualizarCalculoPrestamo({
            inputMonto: editMontoAsoc,
            inputTasa: editTasaAsoc,
            inputCuotas: editCuotasAsoc,
            contenedorResumen: resumenEditAsocEl,
            elementoInfoTasa: infoTasaEditAsocEl
        });
    };
    editMontoAsoc.addEventListener("input", recalcularEditAsoc);
    editCuotasAsoc.addEventListener("input", recalcularEditAsoc);
}

// Ejecuta la carga inicial al abrir la vista de Préstamos
cargarPrestamos();
