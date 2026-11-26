// Referencias a los elementos HTML del módulo Préstamos (vista Admin - solo aprobación)
// Cuerpo de la tabla donde se muestran todas las solicitudes de préstamo para el administrador
const listaPrestamos = document.getElementById("listaPrestamos");
// Contador total de préstamos mostrados en el encabezado de la tabla de administrador
const totalPrestamos = document.getElementById("totalPrestamos");

// Referencias a los elementos HTML de la vista de 2 columnas (rol Asociado)
// Formulario principal para que el asociado solicite un nuevo préstamo
const formPrestamoAsociado = document.getElementById("formPrestamoAsociado");
// Selector que muestra el nombre y documento del asociado autenticado
const asocSelectAsociado = document.getElementById("asocSelectAsociado");
// Botón de envío de nueva solicitud de préstamo
const btnGuardarPrestamoAsociado = document.getElementById("btnGuardarPrestamoAsociado");
// Elemento de texto para mostrar errores o avisos en el formulario del asociado
const mensajePrestamoAsociado = document.getElementById("mensajePrestamoAsociado");
// Cuerpo de la tabla del historial de créditos del asociado
const listaPrestamosAsociado = document.getElementById("listaPrestamosAsociado");
// Contador total de créditos del asociado
const totalPrestamosAsociado = document.getElementById("totalPrestamosAsociado");

// Estado local del rol del usuario y arreglo de préstamos cargados
// Bandera que indica si el usuario actual tiene rol de administrador
let esAdministrador = (localStorage.getItem("rol") || "").toLowerCase() === "admin";
// Arreglo en memoria con los préstamos consultados desde el backend
let prestamosLista = [];

// Envía peticiones GET, POST, PUT o DELETE al endpoint ../Modelo/gestionarPrestamos.php
async function solicitarApiPrestamos(metodo, datos) {
    // Configura método HTTP, cabeceras JSON y envío de cookies de sesión
    const opciones = {
        method: metodo,
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        credentials: "include"
    };

    // Adjunta el cuerpo JSON cuando la petición envía datos
    if (datos) {
        opciones.body = JSON.stringify(datos);
    }

    // Realiza la llamada HTTP al endpoint de préstamos
    const respuesta = await fetch("../Modelo/gestionarPrestamos.php", opciones);
    // Lee la respuesta como texto para manejar respuestas no JSON de forma segura
    const texto = await respuesta.text();

    // Variable que guardará el objeto JSON decodificado
    let resultado = {};
    try {
        // Parsea la cadena recibida a objeto JSON
        resultado = JSON.parse(texto);
    } catch {
        // Lanza error si el servidor devolvió HTML o texto no válido
        throw new Error(`Respuesta inválida del servidor (HTTP ${respuesta.status})`);
    }

    // Si la sesión caducó (HTTP 401), limpia localStorage y redirige al Login
    if (respuesta.status === 401) {
        localStorage.clear();
        window.location.href = "Login.html";
        throw new Error(resultado.mensaje || "Sesión expirada");
    }

    // Lanza excepción si el estado HTTP no es exitoso o success es false
    if (!respuesta.ok || !resultado.success) {
        throw new Error(resultado.mensaje || resultado.message || "Error en la solicitud");
    }

    // Devuelve la respuesta validada
    return resultado;
}

// Crea una celda <td> con texto plano seguro y usa "-" si el dato está vacío
function crearCelda(texto, clase = "") {
    // Crea el elemento <td>
    const td = document.createElement("td");
    // Asigna clases CSS opcionales
    if (clase) td.className = clase;
    // Inserta texto plano evitando XSS y usa "-" para valores nulos o vacíos
    td.textContent = texto !== null && texto !== undefined && String(texto).trim() !== "" ? String(texto) : "-";
    return td;
}

// Formatea cifras numéricas como moneda en pesos colombianos (COP) sin decimales innecesarios
function formatearMoneda(valor) {
    // Si el valor no existe, retorna un guion
    if (valor === null || valor === undefined || valor === "") return "-";
    // Convierte el valor a número
    const numero = Number(valor);
    // Verifica si es entero para omitir decimales innecesarios
    const esEntero = Number.isInteger(numero);
    // Retorna la cadena formateada en pesos colombianos
    return numero.toLocaleString("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: esEntero ? 0 : 2,
        maximumFractionDigits: 2
    });
}

// Determina automáticamente la tasa de interés mensual (%) según el valor del préstamo en COP
function obtenerTasaSegunMonto(valor) {
    // Convierte el valor ingresado a número
    const monto = Number(valor);
    // Valida que sea un número finito y positivo
    if (!Number.isFinite(monto) || monto <= 0) {
        return null;
    }
    // Asigna 1.0% para montos hasta $500.000
    if (monto <= 500000) {
        return { tasa: 1.0, rango: "Hasta $500.000" };
    }
    // Asigna 1.5% para montos entre $500.001 y $2.000.000
    if (monto <= 2000000) {
        return { tasa: 1.5, rango: "$500.001 – $2.000.000" };
    }
    // Asigna 2.0% para montos entre $2.000.001 y $5.000.000
    if (monto <= 5000000) {
        return { tasa: 2.0, rango: "$2.000.001 – $5.000.000" };
    }
    // Asigna 2.5% para montos entre $5.000.001 y $10.000.000
    if (monto <= 10000000) {
        return { tasa: 2.5, rango: "$5.000.001 – $10.000.000" };
    }
    // Asigna 3.0% para montos superiores a $10.000.000
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
    // Sale si falta alguno de los elementos esenciales del formulario
    if (!inputMonto || !inputTasa || !contenedorResumen) return;

    // Lee el monto ingresado y el número de cuotas como entero
    const monto = Number(inputMonto.value);
    const cuotas = parseInt(inputCuotas?.value || "0", 10);
    // Consulta la tasa correspondiente según el rango del monto
    const infoTasa = obtenerTasaSegunMonto(monto);

    // Si el monto no es válido, limpia la tasa y oculta el cuadro de resumen
    if (!infoTasa) {
        inputTasa.value = "";
        if (elementoInfoTasa) {
            elementoInfoTasa.textContent = "La tasa de interés se asigna automáticamente según el valor del préstamo.";
        }
        contenedorResumen.classList.add("d-none");
        contenedorResumen.replaceChildren();
        return;
    }

    // Rellena el campo de tasa de interés automáticamente
    inputTasa.value = String(infoTasa.tasa);
    const tasaFinal = infoTasa.tasa;

    // Muestra el texto informativo con el rango y tasa asignada
    if (elementoInfoTasa) {
        elementoInfoTasa.textContent = `Rango ${infoTasa.rango}: tasa automática del ${tasaFinal}% mensual.`;
    }

    // Calcula el valor adicional por interés mensual redondeado a 2 decimales
    const adicionalPorCuota = Math.round(monto * (tasaFinal / 100) * 100) / 100;

    // Si aún no se ha ingresado un número válido de cuotas, muestra solo la tasa y el interés por cuota
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

    // Calcula cuota base (capital), cuota total (capital + interés), interés acumulado y total del crédito
    const cuotaBase = Math.round((monto / cuotas) * 100) / 100;
    const cuotaTotal = Math.round((cuotaBase + adicionalPorCuota) * 100) / 100;
    const interesTotal = Math.round(adicionalPorCuota * cuotas * 100) / 100;
    const totalConInteres = Math.round((monto + interesTotal) * 100) / 100;

    // Muestra el panel resumen completo con el desglose de cuotas e intereses
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
    // Crea el span de insignia y obtiene tipo de solicitud y estado de aprobación
    const span = document.createElement("span");
    const tipo = prestamo.solicitudTipo || null;
    const estado = prestamo.estadoAprobacion || "Aprobado";

    // Caso 1: solicitud pendiente de eliminación
    if (tipo === "eliminar") {
        span.className = "badge badge-estado-eliminacion";
        span.innerHTML = '<i class="bi bi-trash3 me-1"></i>Eliminación pendiente';
        return span;
    }
    // Caso 2: solicitud pendiente de edición
    if (tipo === "editar") {
        span.className = "badge badge-estado-edicion";
        span.innerHTML = '<i class="bi bi-pencil-square me-1"></i>Edición pendiente';
        return span;
    }
    // Caso 3: préstamo nuevo pendiente de aprobación
    if (estado === "Pendiente" || tipo === "crear") {
        span.className = "badge badge-estado-pendiente";
        span.innerHTML = '<i class="bi bi-clock-history me-1"></i>Pendiente de aprobación';
        return span;
    }
    // Caso 4: préstamo aprobado sin solicitudes pendientes
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
    // Sale si no existe la tabla de administrador en el DOM
    if (!listaPrestamos) return;
    // Limpia las filas existentes
    listaPrestamos.replaceChildren();

    // Actualiza el contador total de préstamos
    if (totalPrestamos) {
        totalPrestamos.textContent = String(prestamosLista.length);
    }

    // Si la lista está vacía, renderiza una fila informativa
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

    // Recorre cada préstamo para construir su fila en la tabla de administrador
    prestamosLista.forEach((prestamo, indice) => {
        const fila = document.createElement("tr");
        // Formatea el plazo en meses y la tasa en porcentaje
        const plazoTexto = prestamo.NumeroCuotas ? `${prestamo.NumeroCuotas} meses` : "-";
        const tasaTexto =
            prestamo.TasaInteres !== null && prestamo.TasaInteres !== undefined
                ? `${Number(prestamo.TasaInteres)}%`
                : "-";

        // Crea la celda del plazo con una insignia visual
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

        // Verifica si existe alguna solicitud pendiente (creación, edición o eliminación)
        const tienePendiente =
            prestamo.estadoAprobacion === "Pendiente" ||
            prestamo.solicitudTipo === "crear" ||
            prestamo.solicitudTipo === "editar" ||
            prestamo.solicitudTipo === "eliminar";

        if (tienePendiente) {
            // Crea el botón de aceptación adaptado al tipo de solicitud pendiente
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
            // Registra el evento click para aprobar la solicitud en el backend
            botonAceptar.addEventListener("click", () => aprobarSolicitudPrestamo(prestamo, botonAceptar));
            celdaAccion.append(botonAceptar);
        } else {
            // Muestra la etiqueta "Aceptado" cuando no hay acciones pendientes
            const aprobadoSpan = document.createElement("span");
            aprobadoSpan.className = "small fw-semibold text-success";
            aprobadoSpan.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i>Aceptado';
            celdaAccion.append(aprobadoSpan);
        }

        // Ensambla las 9 columnas en la fila del administrador
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

        // Añade la fila al tbody
        listaPrestamos.append(fila);
    });
}

// Envía la aprobación del Admin (PUT con accion: "aprobar") para aplicar la solicitud del Asociado
async function aprobarSolicitudPrestamo(prestamo, boton) {
    // Define el mensaje de confirmación acorde al tipo de solicitud
    let mensajeConfirm = `¿Desea aprobar la solicitud del préstamo #${prestamo.idPrestamos} de ${prestamo.nombreAsociado}?`;
    if (prestamo.solicitudTipo === "editar") {
        mensajeConfirm = `¿Desea aprobar y aplicar los cambios solicitados para el préstamo #${prestamo.idPrestamos}?`;
    } else if (prestamo.solicitudTipo === "eliminar") {
        mensajeConfirm = `¿Desea aprobar la eliminación definitiva del préstamo #${prestamo.idPrestamos}?`;
    }

    // Aborta si el administrador cancela la confirmación
    if (!window.confirm(mensajeConfirm)) return;

    // Deshabilita el botón durante el procesamiento
    if (boton) boton.disabled = true;
    try {
        // Envía la petición PUT para aprobar la solicitud en el servidor
        const resultado = await solicitarApiPrestamos("PUT", {
            idPrestamos: prestamo.idPrestamos,
            accion: "aprobar"
        });
        // Muestra mensaje de éxito y actualiza la tabla de préstamos
        mostrarAlertaAdminPrestamos(resultado.mensaje || "Solicitud aprobada correctamente.", "success");
        await cargarPrestamos();
    } catch (error) {
        // Informa el error y vuelve a habilitar el botón
        mostrarAlertaAdminPrestamos(error.message, "danger");
        if (boton) boton.disabled = false;
    }
}

// Dibuja la tabla "Historial de Créditos" para el rol Asociado con botones independientes Editar y Eliminar
function mostrarPrestamosAsociado() {
    // Sale si no existe la tabla del asociado
    if (!listaPrestamosAsociado) return;
    // Borra las filas anteriores
    listaPrestamosAsociado.replaceChildren();

    // Actualiza el contador de créditos del asociado
    if (totalPrestamosAsociado) {
        totalPrestamosAsociado.textContent = String(prestamosLista.length);
    }

    // Muestra un mensaje vacío si el asociado aún no tiene préstamos
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

    // Recorre cada crédito para generar su fila con botones de solicitud de edición y eliminación
    prestamosLista.forEach((prestamo) => {
        const fila = document.createElement("tr");
        // Formatea la tasa de interés con signo de porcentaje
        const tasaTexto =
            prestamo.TasaInteres !== null && prestamo.TasaInteres !== undefined
                ? `${Number(prestamo.TasaInteres)}%`
                : "-";

        // Crea la celda con la insignia del estado de aprobación
        const celdaEstado = document.createElement("td");
        celdaEstado.append(crearBadgeEstadoPrestamo(prestamo));

        // Dos botones completamente independientes: Editar y Eliminar (cada uno abre su propia alerta emergente)
        const celdaAcciones = document.createElement("td");
        celdaAcciones.className = "text-center text-nowrap";

        // Botón para solicitar la edición del crédito
        const botonEditar = document.createElement("button");
        botonEditar.type = "button";
        botonEditar.className = "btn btn-sm btn-editar-credito me-1";
        botonEditar.innerHTML = '<i class="bi bi-pencil"></i>';
        botonEditar.title = "Solicitar edición de este préstamo";
        // Abre el modal de solicitud de edición al hacer clic
        botonEditar.addEventListener("click", () => abrirModalSolicitudEdicion(prestamo));

        // Botón para solicitar la eliminación del crédito
        const botonEliminar = document.createElement("button");
        botonEliminar.type = "button";
        botonEliminar.className = "btn btn-sm btn-eliminar-credito";
        botonEliminar.innerHTML = '<i class="bi bi-trash"></i>';
        botonEliminar.title = "Solicitar eliminación de este préstamo";
        // Abre el modal de solicitud de eliminación al hacer clic
        botonEliminar.addEventListener("click", () => abrirModalSolicitudEliminacion(prestamo));

        celdaAcciones.append(botonEditar, botonEliminar);

        // Añade las 7 celdas de información y acciones a la fila
        fila.append(
            crearCelda(`#${prestamo.idPrestamos}`, "fw-bold"),
            crearCelda(formatearMoneda(prestamo.ValorPrestamo), "fw-semibold"),
            crearCelda(tasaTexto),
            crearCelda(prestamo.NumeroCuotas),
            crearCelda(prestamo.FechaPrestamo, "text-nowrap"),
            celdaEstado,
            celdaAcciones
        );

        // Inserta la fila en la tabla del asociado
        listaPrestamosAsociado.append(fila);
    });
}

// Instancias independientes de los 2 modales emergentes de alerta del Asociado
let modalEdicionAsocInstancia = null;
let modalEliminacionAsocInstancia = null;

// Obtiene o crea la instancia del modal de solicitud de edición
function obtenerModalEdicionAsoc() {
    if (!modalEdicionAsocInstancia) {
        const el = document.getElementById("modalSolicitarEdicionAsociado");
        if (el && window.bootstrap) modalEdicionAsocInstancia = new bootstrap.Modal(el);
    }
    return modalEdicionAsocInstancia;
}

// Obtiene o crea la instancia del modal de solicitud de eliminación
function obtenerModalEliminacionAsoc() {
    if (!modalEliminacionAsocInstancia) {
        const el = document.getElementById("modalSolicitarEliminacionAsociado");
        if (el && window.bootstrap) modalEliminacionAsocInstancia = new bootstrap.Modal(el);
    }
    return modalEliminacionAsocInstancia;
}

// Abre la alerta emergente independiente de Editar (Asociado) con los datos actuales del préstamo
function abrirModalSolicitudEdicion(prestamo) {
    // Si ya hay una edición pendiente, precarga los valores propuestos; si no, los actuales del préstamo
    const origen = prestamo.solicitudTipo === "editar" && prestamo.solicitudDatos ? prestamo.solicitudDatos : prestamo;

    // Rellena los campos del formulario de edición
    document.getElementById("editAsocIdPrestamo").value = prestamo.idPrestamos;
    document.getElementById("editAsocValorPrestamo").value = Number(origen.ValorPrestamo ?? 0);
    document.getElementById("editAsocNumeroCuotas").value = Number(origen.NumeroCuotas ?? 1);
    document.getElementById("editAsocFechaPrestamo").value = origen.FechaPrestamo ?? "";

    // Limpia cualquier mensaje de error previo en el modal
    const msg = document.getElementById("msgModalEdicionAsoc");
    if (msg) msg.textContent = "";

    // Recalcula la tasa automática y el resumen de cuotas con los datos precargados
    actualizarCalculoPrestamo({
        inputMonto: document.getElementById("editAsocValorPrestamo"),
        inputTasa: document.getElementById("editAsocTasaInteres"),
        inputCuotas: document.getElementById("editAsocNumeroCuotas"),
        contenedorResumen: document.getElementById("resumenCalculoEdicionAsociado"),
        elementoInfoTasa: document.getElementById("infoTasaEdicionAsociado")
    });

    // Muestra el modal de edición
    const modal = obtenerModalEdicionAsoc();
    if (modal) modal.show();
}

// Abre la alerta emergente independiente de Eliminar (Asociado)
function abrirModalSolicitudEliminacion(prestamo) {
    // Guarda el ID del préstamo a eliminar en el campo oculto del modal
    document.getElementById("deleteAsocIdPrestamo").value = prestamo.idPrestamos;

    // Muestra el resumen del crédito que se desea eliminar
    const resumen = document.getElementById("resumenEliminarPrestamoAsoc");
    if (resumen) {
        resumen.innerHTML = `
            <div><strong>Crédito #${prestamo.idPrestamos}</strong></div>
            <div>Valor: <strong>${formatearMoneda(prestamo.ValorPrestamo)}</strong> · Plazo: <strong>${prestamo.NumeroCuotas} cuotas</strong> · Fecha: <strong>${prestamo.FechaPrestamo || "-"}</strong></div>`;
    }

    // Limpia el mensaje de error previo
    const msg = document.getElementById("msgModalEliminacionAsoc");
    if (msg) msg.textContent = "";

    // Despliega el modal de confirmación de eliminación
    const modal = obtenerModalEliminacionAsoc();
    if (modal) modal.show();
}

// Llena el selector de Asociado en la tarjeta izquierda con los datos del usuario autenticado
function mostrarAsociadoActual(asociadoActual) {
    if (!asocSelectAsociado) return;
    // Limpia las opciones previas del selector
    asocSelectAsociado.replaceChildren();

    // Determina el nombre y documento del asociado actual con respaldo de localStorage
    const nombre = asociadoActual?.nombreCompleto || localStorage.getItem("nombre") || "Asociado";
    const documento = asociadoActual?.documento ?? "";
    // Crea la única opción seleccionada con la identidad del asociado
    const opcion = document.createElement("option");
    opcion.value = String(documento);
    opcion.textContent = documento ? `${nombre} (Doc: ${documento})` : nombre;
    opcion.selected = true;
    asocSelectAsociado.append(opcion);
}

// Consulta todos los préstamos al servidor por GET y actualiza la vista correspondiente al rol
async function cargarPrestamos() {
    try {
        // Pide el listado de préstamos y metadatos de sesión al servidor
        const resultado = await solicitarApiPrestamos("GET");
        // Sincroniza el rol actual según la respuesta del servidor
        esAdministrador = (resultado.rol || "").toLowerCase() === "admin";

        // Ajusta la visibilidad del encabezado y bloques específicos por rol
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

        // Guarda el arreglo de préstamos validando que sea un array
        prestamosLista = Array.isArray(resultado.prestamos) ? resultado.prestamos : [];

        // Renderiza la tabla de administrador o la vista de asociado
        if (esAdministrador) {
            mostrarPrestamosAdmin();
        } else {
            mostrarAsociadoActual(resultado.asociadoActual);
            mostrarPrestamosAsociado();
        }
    } catch (error) {
        // Registra el fallo en consola y muestra el error en la tabla correspondiente
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
        // Previene el envío nativo del formulario
        evento.preventDefault();

        // Recopila los valores ingresados por el asociado para crear el préstamo
        const datos = {
            ValorPrestamo: Number(document.getElementById("asocValorPrestamo").value),
            TasaInteres: Number(document.getElementById("asocTasaInteres").value),
            NumeroCuotas: Number(document.getElementById("asocNumeroCuotas").value),
            FechaPrestamo: document.getElementById("asocFechaPrestamo").value,
            Proposito: ""
        };

        // Deshabilita el botón y limpia mensajes previos durante el envío
        if (btnGuardarPrestamoAsociado) btnGuardarPrestamoAsociado.disabled = true;
        if (mensajePrestamoAsociado) mensajePrestamoAsociado.textContent = "";

        try {
            // Envía la solicitud POST para registrar el nuevo préstamo pendiente
            const resultado = await solicitarApiPrestamos("POST", datos);
            // Reinicia el formulario y oculta el panel de cálculo de cuotas
            formPrestamoAsociado.reset();
            const resumenAsoc = document.getElementById("resumenCalculoPrestamoAsociado");
            if (resumenAsoc) {
                resumenAsoc.classList.add("d-none");
                resumenAsoc.replaceChildren();
            }
            // Restaura el texto explicativo inicial de la tasa automática
            const infoTasaAsoc = document.getElementById("infoTasaAsociado");
            if (infoTasaAsoc) {
                infoTasaAsoc.textContent = "La tasa de interés se asigna automáticamente según el valor del préstamo.";
            }
            // Muestra alerta de confirmación y recarga el historial de créditos
            mostrarAlertaAsociadoPrestamos(
                resultado.mensaje || "Solicitud de préstamo enviada. Debes esperar a que el administrador la apruebe.",
                "warning"
            );
            await cargarPrestamos();
        } catch (error) {
            // Muestra el error en el contenedor de mensajes o como alerta del navegador
            if (mensajePrestamoAsociado) {
                mensajePrestamoAsociado.textContent = error.message;
            } else {
                alert(error.message);
            }
        } finally {
            // Reactiva el botón de solicitud al terminar
            if (btnGuardarPrestamoAsociado) btnGuardarPrestamoAsociado.disabled = false;
        }
    });
}

// Envío independiente de solicitud de EDICIÓN desde el modal emergente del Asociado (PUT)
const formSolicitarEdicionAsociado = document.getElementById("formSolicitarEdicionAsociado");
if (formSolicitarEdicionAsociado) {
    formSolicitarEdicionAsociado.addEventListener("submit", async (evento) => {
        // Evita el refresco de la página
        evento.preventDefault();

        // Obtiene botón, contenedor de mensaje y construye el objeto con los nuevos valores propuestos
        const btnEnviar = document.getElementById("btnEnviarSolicitudEdicion");
        const msg = document.getElementById("msgModalEdicionAsoc");
        const datos = {
            idPrestamos: Number(document.getElementById("editAsocIdPrestamo").value),
            ValorPrestamo: Number(document.getElementById("editAsocValorPrestamo").value),
            NumeroCuotas: Number(document.getElementById("editAsocNumeroCuotas").value),
            FechaPrestamo: document.getElementById("editAsocFechaPrestamo").value,
            Proposito: ""
        };

        // Deshabilita el botón y limpia mensajes de error
        if (btnEnviar) btnEnviar.disabled = true;
        if (msg) msg.textContent = "";

        try {
            // Envía la solicitud de edición mediante PUT
            const resultado = await solicitarApiPrestamos("PUT", datos);
            // Cierra el modal de edición al completarse
            const modal = obtenerModalEdicionAsoc();
            if (modal) modal.hide();
            // Muestra aviso informativo y recarga el historial
            mostrarAlertaAsociadoPrestamos(
                resultado.mensaje || "Solicitud de edición enviada. Debes esperar a que el administrador apruebe el cambio.",
                "info"
            );
            await cargarPrestamos();
        } catch (error) {
            // Muestra el mensaje de error dentro del modal
            if (msg) msg.textContent = error.message;
        } finally {
            // Restaura el estado del botón
            if (btnEnviar) btnEnviar.disabled = false;
        }
    });
}

// Envío independiente de solicitud de ELIMINACIÓN desde el modal emergente del Asociado (DELETE)
const btnEnviarSolicitudEliminacion = document.getElementById("btnEnviarSolicitudEliminacion");
if (btnEnviarSolicitudEliminacion) {
    btnEnviarSolicitudEliminacion.addEventListener("click", async () => {
        // Lee el ID del préstamo a eliminar y el contenedor de error del modal
        const idPrestamos = Number(document.getElementById("deleteAsocIdPrestamo").value);
        const msg = document.getElementById("msgModalEliminacionAsoc");

        // Deshabilita el botón mientras se envía la solicitud
        btnEnviarSolicitudEliminacion.disabled = true;
        if (msg) msg.textContent = "";

        try {
            // Envía la petición DELETE para marcar el préstamo con solicitud de eliminación
            const resultado = await solicitarApiPrestamos("DELETE", { idPrestamos });
            // Cierra el modal de eliminación
            const modal = obtenerModalEliminacionAsoc();
            if (modal) modal.hide();
            // Muestra la alerta correspondiente y recarga la tabla
            mostrarAlertaAsociadoPrestamos(
                resultado.mensaje || "Solicitud de eliminación enviada. Debes esperar a que el administrador la apruebe.",
                "warning"
            );
            await cargarPrestamos();
        } catch (error) {
            // Muestra el error dentro del modal
            if (msg) msg.textContent = error.message;
        } finally {
            // Reactiva el botón de confirmación
            btnEnviarSolicitudEliminacion.disabled = false;
        }
    });
}

// Cálculo automático de tasa e interés adicional en el formulario de creación del Asociado
// Referencias a los inputs y contenedores de resumen del formulario de creación
const inputMontoAsoc = document.getElementById("asocValorPrestamo");
const inputTasaAsoc = document.getElementById("asocTasaInteres");
const inputCuotasAsoc = document.getElementById("asocNumeroCuotas");
const resumenAsocEl = document.getElementById("resumenCalculoPrestamoAsociado");
const infoTasaAsocEl = document.getElementById("infoTasaAsociado");

// Conecta los eventos input de monto y cuotas para recalcular en tiempo real
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
// Referencias a los inputs y contenedores de resumen dentro del modal de edición
const editMontoAsoc = document.getElementById("editAsocValorPrestamo");
const editTasaAsoc = document.getElementById("editAsocTasaInteres");
const editCuotasAsoc = document.getElementById("editAsocNumeroCuotas");
const resumenEditAsocEl = document.getElementById("resumenCalculoEdicionAsociado");
const infoTasaEditAsocEl = document.getElementById("infoTasaEdicionAsociado");

// Conecta los eventos input en el modal de edición para actualizar la tasa y cuotas al escribir
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
