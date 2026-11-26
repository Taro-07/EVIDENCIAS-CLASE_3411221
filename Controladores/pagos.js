// Referencias a los elementos HTML del módulo Pagos (vista Admin)
// Cuerpo de la tabla donde se listan todos los pagos en la vista de administrador
const listaPagos = document.getElementById("listaPagos");
// Insignia o contador que muestra la cantidad total de pagos registrados (vista Admin)
const totalPagos = document.getElementById("totalPagos");
// Formulario modal para registrar o editar un pago desde la vista Admin
const formPago = document.getElementById("formPago");
// Contenedor de mensajes de validación o error dentro del formulario de Admin
const mensajePago = document.getElementById("mensajePago");
// Botón principal de envío del formulario de pago (Admin)
const btnGuardarPago = document.getElementById("btnGuardarPago");
// Botón para cancelar la edición y limpiar el formulario de pago (Admin)
const btnCancelarEdicionPago = document.getElementById("cancelarEdicionPago");
// Encabezado del modal que cambia entre modo creación y modo edición
const tituloFormPago = document.getElementById("tituloFormPago");
// Selector desplegable de préstamos disponibles en el formulario de Admin
const selectPrestamo = document.getElementById("idPrestamo");

// Referencias a los elementos HTML de la vista "Mis Pagos e Historial de Cuotas" (rol Asociado)
// Contenedor de tarjetas que muestran el saldo pendiente de cada préstamo del asociado
const tarjetasSaldosPrestamos = document.getElementById("tarjetasSaldosPrestamos");
// Formulario del asociado para subir un comprobante de pago de cuota
const formPagoAsociado = document.getElementById("formPagoAsociado");
// Selector desplegable donde el asociado elige el crédito al que abonará
const asocSelectPrestamoPago = document.getElementById("asocSelectPrestamoPago");
// Botón de envío del formulario de pago del asociado
const btnGuardarPagoAsociado = document.getElementById("btnGuardarPagoAsociado");
// Contenedor de mensajes de estado, éxito o error del formulario del asociado
const mensajePagoAsociado = document.getElementById("mensajePagoAsociado");
// Cuerpo de la tabla donde se listan los comprobantes de pago del asociado
const listaPagosAsociado = document.getElementById("listaPagosAsociado");
// Contador total de comprobantes registrados del asociado
const totalPagosAsociado = document.getElementById("totalPagosAsociado");

// Estado local del rol, listado de pagos y préstamos disponibles
// Bandera booleana que indica si el usuario autenticado tiene rol de administrador
let esAdministrador = (localStorage.getItem("rol") || "").toLowerCase() === "admin";
// Arreglo en memoria con los pagos obtenidos desde el servidor
let pagosLista = [];
// Arreglo en memoria con los préstamos disponibles para asociar pagos o mostrar saldos
let prestamosDisponibles = [];

// Envía peticiones GET, POST, PUT o DELETE a ../Modelo/gestionarPagos.php
async function solicitarApiPagos(metodo, datos) {
    // Configura método HTTP, cabeceras JSON y envío automático de cookies de sesión
    const opciones = {
        method: metodo,
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        credentials: "include"
    };

    // Si se envían datos, los convierte a cadena JSON en el cuerpo de la petición
    if (datos) {
        opciones.body = JSON.stringify(datos);
    }

    // Ejecuta la petición HTTP contra el backend de gestión de pagos
    const respuesta = await fetch("../Modelo/gestionarPagos.php", opciones);
    // Lee el cuerpo de la respuesta como texto plano para poder validar el JSON
    const texto = await respuesta.text();

    // Objeto que almacenará la respuesta parseada del servidor
    let resultado = {};
    try {
        // Intenta convertir el texto recibido a un objeto JSON
        resultado = JSON.parse(texto);
    } catch {
        // Lanza un error descriptivo si la respuesta no tiene formato JSON válido
        throw new Error(`Respuesta inválida del servidor (HTTP ${respuesta.status})`);
    }

    // Redirige al Login si la sesión expiró (código HTTP 401)
    if (respuesta.status === 401) {
        localStorage.clear();
        window.location.href = "Login.html";
        throw new Error(resultado.mensaje || "Sesión expirada");
    }

    // Verifica si la respuesta HTTP falló o el backend devolvió success en false
    if (!respuesta.ok || !resultado.success) {
        throw new Error(resultado.mensaje || resultado.message || "Error en la solicitud");
    }

    // Retorna el objeto JSON validado al llamador
    return resultado;
}

// Crea una celda <td> segura mostrando "-" cuando el valor esté vacío
function crearCelda(texto, clase = "") {
    // Crea el elemento de celda de tabla en el DOM
    const td = document.createElement("td");
    // Aplica clases CSS opcionales si se proporcionaron
    if (clase) td.className = clase;
    // Asigna texto plano seguro (evita XSS) o un guion si el valor es nulo o vacío
    td.textContent = texto !== null && texto !== undefined && String(texto).trim() !== "" ? String(texto) : "-";
    // Devuelve la celda construida
    return td;
}

// Formatea cifras numéricas como moneda en pesos colombianos (COP) sin decimales innecesarios
function formatearMoneda(valor) {
    // Si el valor está ausente o vacío, retorna un guion
    if (valor === null || valor === undefined || valor === "") return "-";
    // Convierte el valor recibido a tipo numérico
    const numero = Number(valor);
    // Comprueba si la cifra es entera para omitir decimales ".00"
    const esEntero = Number.isInteger(numero);
    // Aplica formato monetario colombiano (es-CO / COP)
    return numero.toLocaleString("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: esEntero ? 0 : 2,
        maximumFractionDigits: 2
    });
}

// Llena el desplegable <select id="idPrestamo"> de la vista Admin
function renderizarSelectPrestamosAdmin(valorSeleccionado = "") {
    // Sale de la función si el elemento select no existe en el DOM
    if (!selectPrestamo) return;
    // Elimina todas las opciones previas del selector
    selectPrestamo.replaceChildren();

    // Crea la opción inicial deshabilitada a modo de marcador de posición
    const opcionInicial = document.createElement("option");
    opcionInicial.value = "";
    opcionInicial.disabled = true;
    // Mantiene seleccionada la opción inicial si no hay un préstamo preseleccionado
    opcionInicial.selected = !valorSeleccionado;
    // Define el texto de la opción inicial según haya préstamos registrados o no
    opcionInicial.textContent =
        prestamosDisponibles.length > 0
            ? "Seleccione un préstamo..."
            : "No hay préstamos registrados (registra uno primero)";
    // Agrega la opción inicial al selector
    selectPrestamo.append(opcionInicial);

    // Recorre cada préstamo disponible para agregarlo como opción del selector
    prestamosDisponibles.forEach((prestamo) => {
        // Crea el elemento <option> para el préstamo actual
        const option = document.createElement("option");
        option.value = String(prestamo.idPrestamos);
        // Muestra el ID, nombre, documento y valor formateado del préstamo
        option.textContent = `#${prestamo.idPrestamos} - ${prestamo.nombreAsociado} (Doc: ${prestamo.documento}) - ${formatearMoneda(prestamo.ValorPrestamo)}`;
        // Marca esta opción como seleccionada si coincide con valorSeleccionado
        if (String(prestamo.idPrestamos) === String(valorSeleccionado)) {
            option.selected = true;
        }
        // Añade la opción al <select>
        selectPrestamo.append(option);
    });
}

// Llena el desplegable "-- Selecciona el Crédito a Abonar --" de la vista Asociado
function renderizarSelectPrestamosAsociado() {
    // Sale si el selector del asociado no está presente en la página
    if (!asocSelectPrestamoPago) return;
    // Limpia las opciones existentes antes de volver a poblar
    asocSelectPrestamoPago.replaceChildren();

    // Crea la opción guía inicial deshabilitada y seleccionada por defecto
    const opcionInicial = document.createElement("option");
    opcionInicial.value = "";
    opcionInicial.disabled = true;
    opcionInicial.selected = true;
    // Ajusta el texto según si el asociado tiene créditos disponibles
    opcionInicial.textContent =
        prestamosDisponibles.length > 0
            ? "-- Selecciona el Crédito a Abonar --"
            : "No tienes créditos registrados";
    // Inserta la opción inicial en el selector
    asocSelectPrestamoPago.append(opcionInicial);

    // Recorre cada préstamo del asociado para calcular su saldo y añadir su opción
    prestamosDisponibles.forEach((prestamo) => {
        // Convierte a número el valor acordado y el monto ya abonado
        const valorAcordado = Number(prestamo.ValorPrestamo || 0);
        const abonado = Number(prestamo.totalAbonado || 0);
        // Calcula el saldo pendiente asegurando que nunca sea negativo
        const saldo = Math.max(0, valorAcordado - abonado);

        // Crea la opción con el ID del crédito y su saldo restante formateado
        const option = document.createElement("option");
        option.value = String(prestamo.idPrestamos);
        option.textContent = `Crédito #${prestamo.idPrestamos} - Saldo: ${formatearMoneda(saldo)}`;
        // Añade la opción al selector del asociado
        asocSelectPrestamoPago.append(option);
    });
}

// Construye las tarjetas de "Saldo Pendiente de Cada Uno de Tus Préstamos" para el Asociado
function mostrarTarjetasSaldos() {
    // Verifica que exista el contenedor de tarjetas en el DOM
    if (!tarjetasSaldosPrestamos) return;
    // Limpia las tarjetas renderizadas previamente
    tarjetasSaldosPrestamos.replaceChildren();

    // Si no existen préstamos, renderiza una tarjeta informativa de estado vacío
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

    // Recorre los préstamos del asociado para crear una tarjeta de progreso por cada uno
    prestamosDisponibles.forEach((prestamo) => {
        // Obtiene los montos numéricos de valor acordado y total abonado
        const valorAcordado = Number(prestamo.ValorPrestamo || 0);
        const abonado = Number(prestamo.totalAbonado || 0);
        // Calcula el saldo pendiente sin permitir valores negativos
        const saldo = Math.max(0, valorAcordado - abonado);
        // Calcula el porcentaje pagado limitado entre 0% y 100%
        const porcentaje =
            valorAcordado > 0 ? Math.min(100, Math.round((abonado / valorAcordado) * 100)) : 0;
        // Determina si el crédito ya fue cancelado en su totalidad
        const estaPagado = saldo <= 0;

        // Crea la columna responsiva de Bootstrap para la tarjeta
        const col = document.createElement("div");
        col.className = "col-md-6 col-lg-4";

        // Crea el contenedor principal de la tarjeta de saldo
        const card = document.createElement("div");
        card.className = "card tarjeta-saldo-credito h-100 p-3";

        // Fila superior con las dos insignias (Crédito #ID y Saldo Pendiente / Pagado)
        const headerRow = document.createElement("div");
        headerRow.className = "d-flex justify-content-between align-items-center mb-3";

        // Insignia con el número identificador del crédito
        const badgeCredito = document.createElement("span");
        badgeCredito.className = "badge badge-credito-id";
        badgeCredito.textContent = `Crédito #${prestamo.idPrestamos}`;

        // Insignia que indica si el crédito está Pagado o con Saldo Pendiente
        const badgeEstado = document.createElement("span");
        badgeEstado.className = estaPagado
            ? "badge badge-credito-pagado"
            : "badge badge-saldo-pendiente";
        badgeEstado.textContent = estaPagado ? "Pagado" : "Saldo Pendiente";

        // Inserta ambas insignias en la cabecera de la tarjeta
        headerRow.append(badgeCredito, badgeEstado);

        // Detalles de valor acordado y total abonado
        const lineaAcordado = document.createElement("div");
        lineaAcordado.className = "saldo-linea";
        lineaAcordado.innerHTML = `Valor Acordado: <strong>${formatearMoneda(valorAcordado)}</strong>`;

        // Línea informativa del monto total abonado hasta la fecha
        const lineaAbonado = document.createElement("div");
        lineaAbonado.className = "saldo-linea mb-2";
        lineaAbonado.innerHTML = `Abonado: <strong class="texto-abonado">${formatearMoneda(abonado)}</strong>`;

        // Saldo principal destacado con estilo según si ya está pagado o pendiente
        const lineaSaldo = document.createElement("div");
        lineaSaldo.className = estaPagado ? "saldo-monto-pagado mb-2" : "saldo-monto-pendiente mb-2";
        lineaSaldo.textContent = `Saldo: ${formatearMoneda(saldo)}`;

        // Barra de progreso de pago
        const progress = document.createElement("div");
        progress.className = "progress progress-saldo mb-1";
        // Barra interna cuyo ancho refleja el porcentaje abonado
        const progressBar = document.createElement("div");
        progressBar.className = "progress-bar bg-success";
        progressBar.style.width = `${porcentaje}%`;
        // Atributos ARIA de accesibilidad para la barra de progreso
        progressBar.setAttribute("role", "progressbar");
        progressBar.setAttribute("aria-valuenow", String(porcentaje));
        progressBar.setAttribute("aria-valuemin", "0");
        progressBar.setAttribute("aria-valuemax", "100");
        progress.append(progressBar);

        // Porcentaje pagado alineado a la derecha
        const textoPorcentaje = document.createElement("div");
        textoPorcentaje.className = "text-end small text-muted fw-medium";
        textoPorcentaje.textContent = `${porcentaje}% pagado`;

        // Ensambla todos los elementos en la tarjeta y los agrega al contenedor
        card.append(headerRow, lineaAcordado, lineaAbonado, lineaSaldo, progress, textoPorcentaje);
        col.append(card);
        tarjetasSaldosPrestamos.append(col);
    });
}

// Instancia del modal para ver la foto del comprobante y pago seleccionado actualmente
let modalVerComprobanteInstancia = null;
// Almacena temporalmente el objeto del pago cuyo comprobante está abierto en el modal
let pagoComprobanteEnModal = null;

// Obtiene o inicializa la instancia única del modal de Bootstrap para ver comprobantes
function obtenerModalVerComprobante() {
    if (!modalVerComprobanteInstancia) {
        const el = document.getElementById("modalVerComprobante");
        if (el && window.bootstrap) {
            modalVerComprobanteInstancia = new bootstrap.Modal(el);
        }
    }
    return modalVerComprobanteInstancia;
}

// Crea la insignia visual de estado del pago ("Pendiente" o "Aprobado")
function crearBadgeEstadoPago(estadoPago) {
    // Determina si el estado del pago corresponde a "pendiente"
    const esPendiente = String(estadoPago || "").toLowerCase() === "pendiente";
    // Crea el elemento span con la clase visual correspondiente
    const badge = document.createElement("span");
    badge.className = esPendiente ? "badge badge-estado-pendiente" : "badge badge-estado-aprobado";
    // Inserta el icono y texto acordes al estado del pago
    badge.innerHTML = esPendiente
        ? '<i class="bi bi-clock-history me-1"></i>Pendiente'
        : '<i class="bi bi-check-circle me-1"></i>Aprobado';
    return badge;
}

// Muestra la foto del comprobante en grande dentro del modal (con botón Aprobar si es Admin y está Pendiente)
function abrirModalVerComprobante(pago) {
    // Guarda la referencia del pago activo para poder aprobarlo desde el modal
    pagoComprobanteEnModal = pago;
    // Obtiene referencias a la imagen, texto informativo y botón de aprobación del modal
    const img = document.getElementById("imgModalComprobante");
    const info = document.getElementById("infoModalComprobante");
    const btnAprobarModal = document.getElementById("btnAprobarDesdeModal");

    // Carga la imagen agregando una marca de tiempo para evitar caché desactualizada
    if (img) {
        img.src = `${pago.comprobante}?t=${Date.now()}`;
    }
    // Renderiza el resumen detallado del pago en el pie o cabecera del modal
    if (info) {
        const estadoTexto = String(pago.estadoPago || "Aprobado");
        const titular = pago.nombreAsociado ? `${pago.nombreAsociado} (Doc: ${pago.documento})` : "";
        info.innerHTML = `
            <strong>Pago #${pago.idPago}</strong> · Crédito #${pago.idPrestamo} ·
            <strong>${formatearMoneda(pago.ValorCuota)}</strong> · Fecha: ${pago.FechaPago || "-"}
            ${titular ? ` · ${titular}` : ""} · Estado: <strong>${estadoTexto}</strong>`;
    }
    // Muestra el botón de aprobación únicamente si el usuario es Admin y el pago está Pendiente
    if (btnAprobarModal) {
        const puedeAprobar = esAdministrador && String(pago.estadoPago || "").toLowerCase() === "pendiente";
        btnAprobarModal.classList.toggle("d-none", !puedeAprobar);
        btnAprobarModal.disabled = false;
    }

    // Abre el modal de visualización de comprobante
    const modal = obtenerModalVerComprobante();
    if (modal) modal.show();
}

// Envía al servidor la verificación/aprobación de un comprobante pendiente (solo Admin)
async function aprobarComprobantePago(pago, boton) {
    // Solicita confirmación explícita al administrador antes de aprobar el pago
    if (!window.confirm(`¿Confirmas que verificaste el comprobante del pago #${pago.idPago} por ${formatearMoneda(pago.ValorCuota)}?`)) {
        return;
    }

    // Deshabilita el botón mientras se procesa la solicitud para evitar envíos duplicados
    if (boton) boton.disabled = true;
    try {
        // Envía petición PUT al servidor indicando la acción de aprobar el pago
        const resultado = await solicitarApiPagos("PUT", {
            accion: "aprobar",
            idPago: pago.idPago
        });

        // Cierra el modal de comprobante si estaba abierto
        const modal = obtenerModalVerComprobante();
        if (modal) modal.hide();

        // Muestra notificación de éxito y recarga el listado actualizado
        mostrarAlertaAdminPagos(resultado.mensaje || "Comprobante aprobado correctamente.", "success");
        await cargarPagos();
    } catch (error) {
        // Muestra el error en la alerta superior y rehabilita el botón para reintentar
        mostrarAlertaAdminPagos(error.message, "danger");
        if (boton) boton.disabled = false;
    }
}

// Construye la tabla "Comprobantes de Cuotas Pagadas Mensualmente" para el rol Asociado
function mostrarPagosAsociado() {
    // Verifica que exista el tbody del asociado
    if (!listaPagosAsociado) return;
    // Limpia las filas previas de la tabla
    listaPagosAsociado.replaceChildren();

    // Actualiza el contador numérico de pagos del asociado
    if (totalPagosAsociado) {
        totalPagosAsociado.textContent = String(pagosLista.length);
    }

    // Si no hay pagos registrados, inserta una fila informativa vacía
    if (pagosLista.length === 0) {
        const fila = document.createElement("tr");
        const celda = document.createElement("td");
        celda.colSpan = 6;
        celda.className = "text-center py-4 text-muted";
        celda.textContent = "Aún no tienes comprobantes de pago registrados.";
        fila.append(celda);
        listaPagosAsociado.append(fila);
        return;
    }

    // Recorre cada pago para construir su fila correspondiente en la tabla
    pagosLista.forEach((pago) => {
        const fila = document.createElement("tr");

        // Columna Comprobante (foto)
        const celdaFoto = document.createElement("td");
        celdaFoto.className = "text-center text-nowrap";
        if (pago.comprobante) {
            // Crea el botón "Ver foto" que abre la imagen del comprobante en el modal
            const btnVer = document.createElement("button");
            btnVer.type = "button";
            btnVer.className = "btn btn-sm btn-volver-panel";
            btnVer.style.padding = "4px 10px";
            btnVer.style.fontSize = "0.8rem";
            btnVer.innerHTML = '<i class="bi bi-image me-1"></i>Ver foto';
            // Asocia el evento click para abrir el modal con este pago
            btnVer.addEventListener("click", () => abrirModalVerComprobante(pago));
            celdaFoto.append(btnVer);
        } else {
            // Muestra un texto neutro cuando el pago no tiene foto adjunta
            const sinFoto = document.createElement("span");
            sinFoto.className = "small text-muted";
            sinFoto.textContent = "Sin foto";
            celdaFoto.append(sinFoto);
        }

        // Columna Estado (Pendiente / Aprobado)
        const celdaEstado = document.createElement("td");
        celdaEstado.className = "text-center text-nowrap";
        celdaEstado.append(crearBadgeEstadoPago(pago.estadoPago));

        // Agrega las 6 celdas ordenadas a la fila
        fila.append(
            crearCelda(`#${pago.idPago}`, "fw-bold"),
            crearCelda(`Crédito #${pago.idPrestamo}`),
            crearCelda(formatearMoneda(pago.ValorCuota), "fw-bold texto-abonado"),
            crearCelda(pago.FechaPago),
            celdaFoto,
            celdaEstado
        );

        // Inserta la fila completa dentro del tbody del asociado
        listaPagosAsociado.append(fila);
    });
}

// Construye la tabla de visualización y verificación de comprobantes para el rol Admin
function mostrarPagosAdmin() {
    // Verifica que exista el tbody de la vista administrador
    if (!listaPagos) return;
    // Limpia el contenido previo de la tabla
    listaPagos.replaceChildren();

    // Actualiza el badge con la cantidad total de pagos listados
    if (totalPagos) {
        totalPagos.textContent = String(pagosLista.length);
    }

    // Si no existen pagos, muestra una fila informativa abarcando las 9 columnas
    if (pagosLista.length === 0) {
        const fila = document.createElement("tr");
        const celda = document.createElement("td");
        celda.colSpan = 9;
        celda.className = "text-center py-4 text-muted";
        celda.textContent = "No hay pagos de cuotas registrados.";
        fila.append(celda);
        listaPagos.append(fila);
        return;
    }

    // Recorre cada pago y genera su fila con comprobante, estado y botón de verificación
    pagosLista.forEach((pago, indice) => {
        const fila = document.createElement("tr");
        // Formatea el nombre y documento del asociado titular del préstamo
        const asociadoTexto = pago.nombreAsociado
            ? `${pago.nombreAsociado} (${pago.documento})`
            : String(pago.documento ?? "-");
        // Evalúa si el pago aún está pendiente de aprobación
        const esPendiente = String(pago.estadoPago || "").toLowerCase() === "pendiente";

        // Columna Comprobante (botón para revisar la foto subida por el asociado)
        const celdaComprobante = document.createElement("td");
        celdaComprobante.className = "text-center text-nowrap";
        if (pago.comprobante) {
            // Botón para abrir la imagen del comprobante en el modal
            const btnVer = document.createElement("button");
            btnVer.type = "button";
            btnVer.className = "btn btn-sm btn-outline-primary";
            btnVer.style.flex = "0 0 auto";
            btnVer.style.padding = "4px 10px";
            btnVer.innerHTML = '<i class="bi bi-image me-1"></i>Ver foto';
            // Escucha el clic para desplegar el comprobante
            btnVer.addEventListener("click", () => abrirModalVerComprobante(pago));
            celdaComprobante.append(btnVer);
        } else {
            // Texto alternativo si no existe comprobante fotográfico
            const sinFoto = document.createElement("span");
            sinFoto.className = "small text-muted";
            sinFoto.textContent = "Sin foto";
            celdaComprobante.append(sinFoto);
        }

        // Columna Estado (Pendiente / Aprobado)
        const celdaEstado = document.createElement("td");
        celdaEstado.className = "text-center text-nowrap";
        celdaEstado.append(crearBadgeEstadoPago(pago.estadoPago));

        // Columna Verificación (Admin solo aprueba comprobantes pendientes)
        const celdaVerif = document.createElement("td");
        celdaVerif.className = "text-center text-nowrap";
        if (esPendiente) {
            // Crea el botón "Aprobar" para validar el pago pendiente
            const btnAprobar = document.createElement("button");
            btnAprobar.type = "button";
            btnAprobar.className = "btn-aceptar-admin";
            btnAprobar.innerHTML = '<i class="bi bi-check2-circle"></i> Aprobar';
            // Dispara la aprobación del comprobante al hacer clic
            btnAprobar.addEventListener("click", () => aprobarComprobantePago(pago, btnAprobar));
            celdaVerif.append(btnAprobar);
        } else {
            // Muestra etiqueta de verificación completada cuando el pago ya fue aprobado
            const verificado = document.createElement("span");
            verificado.className = "small fw-semibold text-success";
            verificado.innerHTML = '<i class="bi bi-patch-check-fill me-1"></i>Verificado';
            celdaVerif.append(verificado);
        }

        // Añade las 9 columnas en orden a la fila de la tabla de administrador
        fila.append(
            crearCelda(indice + 1),
            crearCelda(pago.idPago),
            crearCelda(`#${pago.idPrestamo}`),
            crearCelda(asociadoTexto),
            crearCelda(formatearMoneda(pago.ValorCuota)),
            crearCelda(pago.FechaPago),
            celdaComprobante,
            celdaEstado,
            celdaVerif
        );

        // Inserta la fila construida en la tabla principal
        listaPagos.append(fila);
    });
}

// Consulta pagos y préstamos por GET y renderiza la interfaz según el rol (Admin o Asociado)
async function cargarPagos() {
    try {
        // Solicita al backend la lista de pagos, préstamos y rol activo de la sesión
        const resultado = await solicitarApiPagos("GET");
        // Sincroniza el estado local del rol según lo devuelto por el servidor
        esAdministrador = (resultado.rol || "").toLowerCase() === "admin";

        // Alterna la visibilidad del encabezado de acciones según el rol
        const encabezadoAcciones = document.getElementById("encabezadoAccionesPago");
        if (encabezadoAcciones) {
            encabezadoAcciones.classList.toggle("d-none", !esAdministrador);
        }
        // Muestra u oculta los bloques exclusivos de administrador
        document.querySelectorAll("[data-solo-admin]").forEach((elemento) => {
            elemento.classList.toggle("d-none", !esAdministrador);
        });
        // Muestra u oculta los bloques exclusivos de asociado
        document.querySelectorAll("[data-solo-asociado]").forEach((elemento) => {
            elemento.classList.toggle("d-none", esAdministrador);
        });

        // Almacena en memoria los arreglos recibidos asegurando que sean arrays válidos
        pagosLista = Array.isArray(resultado.pagos) ? resultado.pagos : [];
        prestamosDisponibles = Array.isArray(resultado.prestamos) ? resultado.prestamos : [];

        // Renderiza los componentes correspondientes a cada rol
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
        // Registra el error en consola y lo muestra dentro de la tabla activa
        console.error("Error al cargar pagos:", error);
        if (esAdministrador && listaPagos) {
            listaPagos.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-danger">${error.message}</td></tr>`;
        } else if (listaPagosAsociado) {
            listaPagosAsociado.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">${error.message}</td></tr>`;
        }
    }
}

// Instancia del modal Bootstrap para registrar/editar pagos (Admin)
let modalPagoInstancia = null;
// Devuelve o crea la instancia del modal de registro/edición de pagos
function obtenerModalPago() {
    if (!modalPagoInstancia) {
        const el = document.getElementById("modalPagoAdmin");
        if (el && window.bootstrap) {
            modalPagoInstancia = new bootstrap.Modal(el);
        }
    }
    return modalPagoInstancia;
}

// Muestra alerta de confirmación encima de la tabla de pagos (Admin)
function mostrarAlertaAdminPagos(texto, tipo = "success") {
    const alerta = document.getElementById("alertaAdminPagos");
    if (!alerta) return;
    // Aplica la clase de Bootstrap según el tipo de alerta y asigna el mensaje
    alerta.className = `alert alert-${tipo} mb-3`;
    alerta.textContent = texto;
}

// Restaura el formulario modal de Admin al modo registro
function resetearFormularioPago() {
    if (!formPago) return;
    // Limpia todos los inputs del formulario
    formPago.reset();
    // Borra el campo oculto de ID de pago para volver al modo creación
    document.getElementById("idPago").value = "";
    // Restablece el selector de préstamos sin opción seleccionada
    renderizarSelectPrestamosAdmin("");
    // Restaura el título y el texto del botón al estado de nuevo registro
    if (tituloFormPago) {
        tituloFormPago.innerHTML = '<i class="bi bi-wallet2 me-2"></i>Registro de Pago';
    }
    if (btnGuardarPago) {
        btnGuardarPago.textContent = "Registrar Pago";
    }
}

// Abre el modal vacío en modo creación de pago
function abrirCreacionPago() {
    resetearFormularioPago();
    // Limpia cualquier mensaje de error previo
    if (mensajePago) mensajePago.textContent = "";
    const modal = obtenerModalPago();
    if (modal) modal.show();
}

// Carga los datos de un pago en el modal de Admin para editarlos
function abrirEdicionPago(pago) {
    if (!formPago) return;
    // Reinicia el formulario antes de precargar los valores
    formPago.reset();

    // Rellena los campos con los valores actuales del pago seleccionado
    document.getElementById("idPago").value = pago.idPago;
    renderizarSelectPrestamosAdmin(pago.idPrestamo);
    document.getElementById("ValorCuota").value =
        pago.ValorCuota !== null && pago.ValorCuota !== undefined ? Number(pago.ValorCuota) : "";
    document.getElementById("FechaPago").value = pago.FechaPago ?? "";

    // Actualiza título y botón del modal al modo edición
    if (tituloFormPago) {
        tituloFormPago.innerHTML = '<i class="bi bi-pencil-square me-2"></i>Editar Pago';
    }
    if (btnGuardarPago) {
        btnGuardarPago.textContent = "Guardar cambios";
    }
    if (mensajePago) mensajePago.textContent = "";

    // Muestra el modal cargado con los datos
    const modal = obtenerModalPago();
    if (modal) modal.show();
}

// Elimina un pago (acción exclusiva de Admin) y recarga la tabla
async function eliminarPago(pago) {
    // Pide confirmación al usuario antes de enviar la eliminación
    const confirmar = window.confirm(
        `¿Desea eliminar el pago #${pago.idPago} de ${formatearMoneda(pago.ValorCuota)} (Préstamo #${pago.idPrestamo})?`
    );
    if (!confirmar) return;

    try {
        // Envía la petición DELETE con el ID del pago a eliminar
        const resultado = await solicitarApiPagos("DELETE", { idPago: pago.idPago });
        // Si ese pago estaba cargado en el formulario, lo limpia
        if (document.getElementById("idPago").value === String(pago.idPago)) {
            resetearFormularioPago();
        }
        // Muestra alerta de confirmación y refresca los datos
        mostrarAlertaAdminPagos(resultado.mensaje || "Pago eliminado correctamente.", "success");
        await cargarPagos();
    } catch (error) {
        alert(error.message);
    }
}

// Botón "+ Nuevo" del encabezado de la tabla de pagos
const btnNuevoPagoHeader = document.getElementById("btnNuevoPagoHeader");
if (btnNuevoPagoHeader) {
    // Al hacer clic abre el modal limpio para crear un nuevo pago
    btnNuevoPagoHeader.addEventListener("click", () => abrirCreacionPago());
}

// Botón Cancelar edición (vista Admin)
if (btnCancelarEdicionPago) {
    // Al hacer clic restaura el formulario y borra mensajes de error
    btnCancelarEdicionPago.addEventListener("click", () => {
        resetearFormularioPago();
        if (mensajePago) mensajePago.textContent = "";
    });
}

// Envío del formulario de Admin (POST o PUT)
if (formPago) {
    formPago.addEventListener("submit", async (evento) => {
        // Evita la recarga tradicional de la página al enviar el formulario
        evento.preventDefault();

        // Lee el ID oculto para determinar si es creación o actualización
        const idPago = document.getElementById("idPago").value;
        // Construye el objeto con los datos del pago ingresados en el formulario
        const datos = {
            idPrestamo: Number(document.getElementById("idPrestamo").value),
            ValorCuota: Number(document.getElementById("ValorCuota").value),
            FechaPago: document.getElementById("FechaPago").value
        };

        // Incluye el ID del pago en el cuerpo si se trata de una edición
        if (idPago) {
            datos.idPago = Number(idPago);
        }

        // Deshabilita el botón de guardado y limpia mensajes previos durante la petición
        if (btnGuardarPago) btnGuardarPago.disabled = true;
        if (mensajePago) mensajePago.textContent = "";

        try {
            // Envía PUT si existe idPago o POST si es un registro nuevo
            const resultado = await solicitarApiPagos(idPago ? "PUT" : "POST", datos);
            // Limpia el formulario y cierra el modal al completarse con éxito
            resetearFormularioPago();
            const modal = obtenerModalPago();
            if (modal) modal.hide();
            // Muestra alerta de éxito y recarga la tabla de pagos
            mostrarAlertaAdminPagos(
                resultado.mensaje ||
                    (idPago ? "Pago actualizado correctamente." : "Comprobante de pago registrado con éxito."),
                "success"
            );
            await cargarPagos();
        } catch (error) {
            // Muestra el mensaje de error en el formulario o mediante alerta
            if (mensajePago) {
                mensajePago.textContent = error.message;
            } else {
                alert(error.message);
            }
        } finally {
            // Reactiva el botón de envío al finalizar la operación
            if (btnGuardarPago) btnGuardarPago.disabled = false;
        }
    });
}

// Vista previa instantánea al seleccionar la foto del comprobante en el formulario del Asociado
// Referencia al input de archivo del comprobante
const inputComprobanteAsoc = document.getElementById("asocComprobantePago");
// Contenedor que envuelve la miniatura de vista previa
const previewComprobanteWrap = document.getElementById("previewComprobanteWrap");
// Elemento <img> donde se previsualiza la foto elegida
const previewComprobanteImg = document.getElementById("previewComprobanteImg");

// Registra el evento change para mostrar u ocultar la vista previa al seleccionar un archivo
if (inputComprobanteAsoc && previewComprobanteWrap && previewComprobanteImg) {
    inputComprobanteAsoc.addEventListener("change", () => {
        // Obtiene el primer archivo seleccionado por el usuario
        const archivo = inputComprobanteAsoc.files?.[0];
        if (!archivo) {
            // Oculta la vista previa si el usuario cancela la selección
            previewComprobanteWrap.classList.add("d-none");
            previewComprobanteImg.src = "";
            return;
        }
        // Genera una URL temporal local para previsualizar la imagen inmediatamente
        previewComprobanteImg.src = URL.createObjectURL(archivo);
        previewComprobanteWrap.classList.remove("d-none");
    });
}

// Botón "Aprobar comprobante" dentro del modal de visualización de foto (Admin)
const btnAprobarDesdeModal = document.getElementById("btnAprobarDesdeModal");
if (btnAprobarDesdeModal) {
    // Al hacer clic aprueba el pago que está abierto actualmente en el modal
    btnAprobarDesdeModal.addEventListener("click", () => {
        if (pagoComprobanteEnModal) {
            aprobarComprobantePago(pagoComprobanteEnModal, btnAprobarDesdeModal);
        }
    });
}

// Envío del formulario "Registrar Pago de Cuota" de la vista Asociado (POST multipart/form-data con foto del comprobante)
if (formPagoAsociado) {
    formPagoAsociado.addEventListener("submit", async (evento) => {
        // Evita el envío estándar del formulario
        evento.preventDefault();

        // Valida que el asociado haya adjuntado una imagen del comprobante
        const archivo = inputComprobanteAsoc?.files?.[0];
        if (!archivo) {
            if (mensajePagoAsociado) {
                mensajePagoAsociado.style.color = "#b91c1c";
                mensajePagoAsociado.textContent = "Debes adjuntar la foto del comprobante de pago.";
            }
            return;
        }

        // Construye el FormData con los campos del pago y el archivo adjunto
        const formData = new FormData();
        formData.append("idPrestamo", document.getElementById("asocSelectPrestamoPago").value);
        formData.append("ValorCuota", document.getElementById("asocValorCuota").value);
        formData.append("FechaPago", document.getElementById("asocFechaPago").value);
        formData.append("comprobante", archivo);

        // Deshabilita el botón y muestra estado de carga mientras sube el archivo
        if (btnGuardarPagoAsociado) btnGuardarPagoAsociado.disabled = true;
        if (mensajePagoAsociado) {
            mensajePagoAsociado.style.color = "#7c5c50";
            mensajePagoAsociado.textContent = "Subiendo comprobante...";
        }

        try {
            // Envía la petición POST multipart/form-data incluyendo credenciales de sesión
            const respuesta = await fetch("../Modelo/gestionarPagos.php", {
                method: "POST",
                credentials: "include",
                body: formData
            });
            // Lee la respuesta como texto para parsearla de forma controlada
            const texto = await respuesta.text();
            let resultado = {};
            try {
                // Convierte la respuesta a JSON
                resultado = JSON.parse(texto);
            } catch {
                throw new Error(`Respuesta inválida del servidor (HTTP ${respuesta.status})`);
            }

            // Si la sesión expiró, limpia el almacenamiento y redirige al Login
            if (respuesta.status === 401) {
                localStorage.clear();
                window.location.href = "Login.html";
                return;
            }

            // Verifica si el servidor reportó un error al registrar el comprobante
            if (!respuesta.ok || !resultado.success) {
                throw new Error(resultado.mensaje || "No se pudo enviar el comprobante");
            }

            // Limpia el formulario y oculta la vista previa tras el envío exitoso
            formPagoAsociado.reset();
            if (previewComprobanteWrap) previewComprobanteWrap.classList.add("d-none");
            if (previewComprobanteImg) previewComprobanteImg.src = "";

            // Muestra el mensaje de confirmación en verde y recarga tarjetas y tabla
            if (mensajePagoAsociado) {
                mensajePagoAsociado.style.color = "#198754";
                mensajePagoAsociado.textContent =
                    resultado.mensaje ||
                    "Comprobante enviado correctamente. Queda en estado Pendiente hasta aprobación del administrador.";
            }
            await cargarPagos();
        } catch (error) {
            // Muestra el error en rojo debajo del formulario o en un alert de respaldo
            if (mensajePagoAsociado) {
                mensajePagoAsociado.style.color = "#b91c1c";
                mensajePagoAsociado.textContent = error.message;
            } else {
                alert(error.message);
            }
        } finally {
            // Rehabilita el botón de envío sin importar si la petición tuvo éxito o falló
            if (btnGuardarPagoAsociado) btnGuardarPagoAsociado.disabled = false;
        }
    });
}

// Carga inicial al abrir el apartado Pagos
cargarPagos();
