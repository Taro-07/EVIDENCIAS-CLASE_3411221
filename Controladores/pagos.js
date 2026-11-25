// Referencias a los elementos HTML del módulo Pagos (vista Admin)
const listaPagos = document.getElementById("listaPagos");
const totalPagos = document.getElementById("totalPagos");
const formPago = document.getElementById("formPago");
const mensajePago = document.getElementById("mensajePago");
const btnGuardarPago = document.getElementById("btnGuardarPago");
const btnCancelarEdicionPago = document.getElementById("cancelarEdicionPago");
const tituloFormPago = document.getElementById("tituloFormPago");
const selectPrestamo = document.getElementById("idPrestamo");

// Referencias a los elementos HTML de la vista "Mis Pagos e Historial de Cuotas" (rol Asociado)
const tarjetasSaldosPrestamos = document.getElementById("tarjetasSaldosPrestamos");
const formPagoAsociado = document.getElementById("formPagoAsociado");
const asocSelectPrestamoPago = document.getElementById("asocSelectPrestamoPago");
const btnGuardarPagoAsociado = document.getElementById("btnGuardarPagoAsociado");
const mensajePagoAsociado = document.getElementById("mensajePagoAsociado");
const listaPagosAsociado = document.getElementById("listaPagosAsociado");
const totalPagosAsociado = document.getElementById("totalPagosAsociado");

// Estado local del rol, listado de pagos y préstamos disponibles
let esAdministrador = (localStorage.getItem("rol") || "").toLowerCase() === "admin";
let pagosLista = [];
let prestamosDisponibles = [];

// Envía peticiones GET, POST, PUT o DELETE a ../Modelo/gestionarPagos.php
async function solicitarApiPagos(metodo, datos) {
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

    const respuesta = await fetch("../Modelo/gestionarPagos.php", opciones);
    const texto = await respuesta.text();

    let resultado = {};
    try {
        resultado = JSON.parse(texto);
    } catch {
        throw new Error(`Respuesta inválida del servidor (HTTP ${respuesta.status})`);
    }

    // Redirige al Login si la sesión expiró
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

// Crea una celda <td> segura mostrando "-" cuando el valor esté vacío
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

// Llena el desplegable <select id="idPrestamo"> de la vista Admin
function renderizarSelectPrestamosAdmin(valorSeleccionado = "") {
    if (!selectPrestamo) return;
    selectPrestamo.replaceChildren();

    const opcionInicial = document.createElement("option");
    opcionInicial.value = "";
    opcionInicial.disabled = true;
    opcionInicial.selected = !valorSeleccionado;
    opcionInicial.textContent =
        prestamosDisponibles.length > 0
            ? "Seleccione un préstamo..."
            : "No hay préstamos registrados (registra uno primero)";
    selectPrestamo.append(opcionInicial);

    prestamosDisponibles.forEach((prestamo) => {
        const option = document.createElement("option");
        option.value = String(prestamo.idPrestamos);
        option.textContent = `#${prestamo.idPrestamos} - ${prestamo.nombreAsociado} (Doc: ${prestamo.documento}) - ${formatearMoneda(prestamo.ValorPrestamo)}`;
        if (String(prestamo.idPrestamos) === String(valorSeleccionado)) {
            option.selected = true;
        }
        selectPrestamo.append(option);
    });
}

// Llena el desplegable "-- Selecciona el Crédito a Abonar --" de la vista Asociado
function renderizarSelectPrestamosAsociado() {
    if (!asocSelectPrestamoPago) return;
    asocSelectPrestamoPago.replaceChildren();

    const opcionInicial = document.createElement("option");
    opcionInicial.value = "";
    opcionInicial.disabled = true;
    opcionInicial.selected = true;
    opcionInicial.textContent =
        prestamosDisponibles.length > 0
            ? "-- Selecciona el Crédito a Abonar --"
            : "No tienes créditos registrados";
    asocSelectPrestamoPago.append(opcionInicial);

    prestamosDisponibles.forEach((prestamo) => {
        const valorAcordado = Number(prestamo.ValorPrestamo || 0);
        const abonado = Number(prestamo.totalAbonado || 0);
        const saldo = Math.max(0, valorAcordado - abonado);

        const option = document.createElement("option");
        option.value = String(prestamo.idPrestamos);
        option.textContent = `Crédito #${prestamo.idPrestamos} - Saldo: ${formatearMoneda(saldo)}`;
        asocSelectPrestamoPago.append(option);
    });
}

// Construye las tarjetas de "Saldo Pendiente de Cada Uno de Tus Préstamos" para el Asociado
function mostrarTarjetasSaldos() {
    if (!tarjetasSaldosPrestamos) return;
    tarjetasSaldosPrestamos.replaceChildren();

    if (prestamosDisponibles.length === 0) {
        const col = document.createElement("div");
        col.className = "col-12";
        col.innerHTML = `
            <div class="card ficha-asociado-card p-4 text-center text-muted">
                Aún no tienes préstamos registrados para consultar saldo.
            </div>`;
        tarjetasSaldosPrestamos.append(col);
        return;
    }

    prestamosDisponibles.forEach((prestamo) => {
        const valorAcordado = Number(prestamo.ValorPrestamo || 0);
        const abonado = Number(prestamo.totalAbonado || 0);
        const saldo = Math.max(0, valorAcordado - abonado);
        const porcentaje =
            valorAcordado > 0 ? Math.min(100, Math.round((abonado / valorAcordado) * 100)) : 0;
        const estaPagado = saldo <= 0;

        const col = document.createElement("div");
        col.className = "col-md-6 col-lg-4";

        const card = document.createElement("div");
        card.className = "card tarjeta-saldo-credito h-100 p-3";

        // Fila superior con las dos insignias (Crédito #ID y Saldo Pendiente / Pagado)
        const headerRow = document.createElement("div");
        headerRow.className = "d-flex justify-content-between align-items-center mb-3";

        const badgeCredito = document.createElement("span");
        badgeCredito.className = "badge badge-credito-id";
        badgeCredito.textContent = `Crédito #${prestamo.idPrestamos}`;

        const badgeEstado = document.createElement("span");
        badgeEstado.className = estaPagado
            ? "badge badge-credito-pagado"
            : "badge badge-saldo-pendiente";
        badgeEstado.textContent = estaPagado ? "Pagado" : "Saldo Pendiente";

        headerRow.append(badgeCredito, badgeEstado);

        // Detalles de valor acordado y total abonado
        const lineaAcordado = document.createElement("div");
        lineaAcordado.className = "saldo-linea";
        lineaAcordado.innerHTML = `Valor Acordado: <strong>${formatearMoneda(valorAcordado)}</strong>`;

        const lineaAbonado = document.createElement("div");
        lineaAbonado.className = "saldo-linea mb-2";
        lineaAbonado.innerHTML = `Abonado: <strong class="texto-abonado">${formatearMoneda(abonado)}</strong>`;

        // Saldo principal destacado
        const lineaSaldo = document.createElement("div");
        lineaSaldo.className = estaPagado ? "saldo-monto-pagado mb-2" : "saldo-monto-pendiente mb-2";
        lineaSaldo.textContent = `Saldo: ${formatearMoneda(saldo)}`;

        // Barra de progreso de pago
        const progress = document.createElement("div");
        progress.className = "progress progress-saldo mb-1";
        const progressBar = document.createElement("div");
        progressBar.className = "progress-bar bg-success";
        progressBar.style.width = `${porcentaje}%`;
        progressBar.setAttribute("role", "progressbar");
        progressBar.setAttribute("aria-valuenow", String(porcentaje));
        progressBar.setAttribute("aria-valuemin", "0");
        progressBar.setAttribute("aria-valuemax", "100");
        progress.append(progressBar);

        // Porcentaje pagado alineado a la derecha
        const textoPorcentaje = document.createElement("div");
        textoPorcentaje.className = "text-end small text-muted fw-medium";
        textoPorcentaje.textContent = `${porcentaje}% pagado`;

        card.append(headerRow, lineaAcordado, lineaAbonado, lineaSaldo, progress, textoPorcentaje);
        col.append(card);
        tarjetasSaldosPrestamos.append(col);
    });
}

// Construye la tabla "Comprobantes de Cuotas Pagadas Mensualmente" para el rol Asociado
function mostrarPagosAsociado() {
    if (!listaPagosAsociado) return;
    listaPagosAsociado.replaceChildren();

    if (totalPagosAsociado) {
        totalPagosAsociado.textContent = String(pagosLista.length);
    }

    if (pagosLista.length === 0) {
        const fila = document.createElement("tr");
        const celda = document.createElement("td");
        celda.colSpan = 5;
        celda.className = "text-center py-4 text-muted";
        celda.textContent = "Aún no tienes comprobantes de pago registrados.";
        fila.append(celda);
        listaPagosAsociado.append(fila);
        return;
    }

    pagosLista.forEach((pago) => {
        const fila = document.createElement("tr");

        const celdaEstado = document.createElement("td");
        const badgeEstado = document.createElement("span");
        badgeEstado.className = "badge badge-comprobante-aplicado";
        badgeEstado.textContent = "Comprobante Aplicado";
        celdaEstado.append(badgeEstado);

        fila.append(
            crearCelda(`#${pago.idPago}`, "fw-bold"),
            crearCelda(`Crédito #${pago.idPrestamo}`),
            crearCelda(formatearMoneda(pago.ValorCuota), "fw-bold texto-abonado"),
            crearCelda(pago.FechaPago),
            celdaEstado
        );

        listaPagosAsociado.append(fila);
    });
}

// Construye la tabla completa de pagos de cuotas para el rol Admin
function mostrarPagosAdmin() {
    if (!listaPagos) return;
    listaPagos.replaceChildren();

    if (totalPagos) {
        totalPagos.textContent = String(pagosLista.length);
    }

    if (pagosLista.length === 0) {
        const fila = document.createElement("tr");
        const celda = document.createElement("td");
        celda.colSpan = 7;
        celda.className = "text-center py-4 text-muted";
        celda.textContent = "No hay pagos de cuotas registrados.";
        fila.append(celda);
        listaPagos.append(fila);
        return;
    }

    pagosLista.forEach((pago, indice) => {
        const fila = document.createElement("tr");
        const asociadoTexto = pago.nombreAsociado
            ? `${pago.nombreAsociado} (${pago.documento})`
            : String(pago.documento ?? "-");

        fila.append(
            crearCelda(indice + 1),
            crearCelda(pago.idPago),
            crearCelda(`#${pago.idPrestamo}`),
            crearCelda(asociadoTexto),
            crearCelda(formatearMoneda(pago.ValorCuota)),
            crearCelda(pago.FechaPago)
        );

        const acciones = document.createElement("td");
        acciones.className = "text-nowrap";

        const botonEditar = document.createElement("button");
        botonEditar.type = "button";
        botonEditar.className = "btn btn-sm btn-outline-primary me-2";
        botonEditar.style.flex = "0 0 auto";
        botonEditar.style.padding = "4px 8px";
        botonEditar.innerHTML = '<i class="bi bi-pencil"></i>';
        botonEditar.title = "Editar pago";
        botonEditar.addEventListener("click", () => abrirEdicionPago(pago));

        const botonEliminar = document.createElement("button");
        botonEliminar.type = "button";
        botonEliminar.className = "btn btn-sm btn-outline-danger";
        botonEliminar.style.flex = "0 0 auto";
        botonEliminar.style.padding = "4px 8px";
        botonEliminar.innerHTML = '<i class="bi bi-trash"></i>';
        botonEliminar.title = "Eliminar pago";
        botonEliminar.addEventListener("click", () => eliminarPago(pago));

        acciones.append(botonEditar, botonEliminar);
        fila.append(acciones);
        listaPagos.append(fila);
    });
}

// Consulta pagos y préstamos por GET y renderiza la interfaz según el rol (Admin o Asociado)
async function cargarPagos() {
    try {
        const resultado = await solicitarApiPagos("GET");
        esAdministrador = (resultado.rol || "").toLowerCase() === "admin";

        const encabezadoAcciones = document.getElementById("encabezadoAccionesPago");
        if (encabezadoAcciones) {
            encabezadoAcciones.classList.toggle("d-none", !esAdministrador);
        }
        document.querySelectorAll("[data-solo-admin]").forEach((elemento) => {
            elemento.classList.toggle("d-none", !esAdministrador);
        });
        document.querySelectorAll("[data-solo-asociado]").forEach((elemento) => {
            elemento.classList.toggle("d-none", esAdministrador);
        });

        pagosLista = Array.isArray(resultado.pagos) ? resultado.pagos : [];
        prestamosDisponibles = Array.isArray(resultado.prestamos) ? resultado.prestamos : [];

        if (esAdministrador) {
            const prestamoActual = selectPrestamo ? selectPrestamo.value : "";
            renderizarSelectPrestamosAdmin(prestamoActual);
            mostrarPagosAdmin();
        } else {
            mostrarTarjetasSaldos();
            renderizarSelectPrestamosAsociado();
            mostrarPagosAsociado();
        }
    } catch (error) {
        console.error("Error al cargar pagos:", error);
        if (esAdministrador && listaPagos) {
            listaPagos.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-danger">${error.message}</td></tr>`;
        } else if (listaPagosAsociado) {
            listaPagosAsociado.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">${error.message}</td></tr>`;
        }
    }
}

// Restaura el formulario de Admin al modo registro
function resetearFormularioPago() {
    if (!formPago) return;
    formPago.reset();
    document.getElementById("idPago").value = "";
    renderizarSelectPrestamosAdmin("");
    if (btnCancelarEdicionPago) btnCancelarEdicionPago.classList.add("d-none");
    if (tituloFormPago) {
        tituloFormPago.innerHTML = '<i class="bi bi-wallet2"></i> Registro de Pago';
    }
    if (btnGuardarPago) {
        btnGuardarPago.textContent = "Registrar Pago";
    }
}

// Carga los datos de un pago en el formulario superior de Admin para editarlos
function abrirEdicionPago(pago) {
    if (!formPago) return;
    formPago.reset();

    document.getElementById("idPago").value = pago.idPago;
    renderizarSelectPrestamosAdmin(pago.idPrestamo);
    document.getElementById("ValorCuota").value =
        pago.ValorCuota !== null && pago.ValorCuota !== undefined ? Number(pago.ValorCuota) : "";
    document.getElementById("FechaPago").value = pago.FechaPago ?? "";

    if (btnCancelarEdicionPago) btnCancelarEdicionPago.classList.remove("d-none");
    if (tituloFormPago) {
        tituloFormPago.innerHTML = '<i class="bi bi-pencil-square"></i> Editar Pago';
    }
    if (btnGuardarPago) {
        btnGuardarPago.textContent = "Guardar cambios";
    }
    if (mensajePago) mensajePago.textContent = "";

    window.scrollTo({ top: 0, behavior: "smooth" });
}

// Elimina un pago (acción exclusiva de Admin) y recarga la tabla
async function eliminarPago(pago) {
    const confirmar = window.confirm(
        `¿Desea eliminar el pago #${pago.idPago} de ${formatearMoneda(pago.ValorCuota)} (Préstamo #${pago.idPrestamo})?`
    );
    if (!confirmar) return;

    try {
        const resultado = await solicitarApiPagos("DELETE", { idPago: pago.idPago });
        if (document.getElementById("idPago").value === String(pago.idPago)) {
            resetearFormularioPago();
        }
        if (mensajePago) {
            mensajePago.textContent = resultado.mensaje || "Pago eliminado correctamente.";
        }
        await cargarPagos();
    } catch (error) {
        alert(error.message);
    }
}

// Botón Cancelar edición (vista Admin)
if (btnCancelarEdicionPago) {
    btnCancelarEdicionPago.addEventListener("click", () => {
        resetearFormularioPago();
        if (mensajePago) mensajePago.textContent = "";
    });
}

// Envío del formulario de Admin (POST o PUT)
if (formPago) {
    formPago.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        const idPago = document.getElementById("idPago").value;
        const datos = {
            idPrestamo: Number(document.getElementById("idPrestamo").value),
            ValorCuota: Number(document.getElementById("ValorCuota").value),
            FechaPago: document.getElementById("FechaPago").value
        };

        if (idPago) {
            datos.idPago = Number(idPago);
        }

        if (btnGuardarPago) btnGuardarPago.disabled = true;
        if (mensajePago) mensajePago.textContent = "";

        try {
            const resultado = await solicitarApiPagos(idPago ? "PUT" : "POST", datos);
            resetearFormularioPago();
            if (mensajePago) {
                mensajePago.textContent =
                    resultado.mensaje ||
                    (idPago ? "Pago actualizado correctamente." : "Comprobante de pago registrado con éxito.");
            }
            await cargarPagos();
        } catch (error) {
            if (mensajePago) {
                mensajePago.textContent = error.message;
            } else {
                alert(error.message);
            }
        } finally {
            if (btnGuardarPago) btnGuardarPago.disabled = false;
        }
    });
}

// Envío del formulario "Registrar Pago de Cuota" de la vista Asociado (POST)
if (formPagoAsociado) {
    formPagoAsociado.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        const datos = {
            idPrestamo: Number(document.getElementById("asocSelectPrestamoPago").value),
            ValorCuota: Number(document.getElementById("asocValorCuota").value),
            FechaPago: document.getElementById("asocFechaPago").value
        };

        if (btnGuardarPagoAsociado) btnGuardarPagoAsociado.disabled = true;
        if (mensajePagoAsociado) mensajePagoAsociado.textContent = "";

        try {
            const resultado = await solicitarApiPagos("POST", datos);
            formPagoAsociado.reset();
            if (mensajePagoAsociado) {
                mensajePagoAsociado.textContent =
                    resultado.mensaje || "Comprobante de pago registrado con éxito.";
            }
            // Recarga tarjetas de saldo pendiente, selector y tabla de comprobantes
            await cargarPagos();
        } catch (error) {
            if (mensajePagoAsociado) {
                mensajePagoAsociado.textContent = error.message;
            } else {
                alert(error.message);
            }
        } finally {
            if (btnGuardarPagoAsociado) btnGuardarPagoAsociado.disabled = false;
        }
    });
}

// Carga inicial al abrir el apartado Pagos
cargarPagos();
