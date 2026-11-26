// Referencias a los elementos HTML del módulo Actividades (tabla, contador y formulario)
const listaActividades = document.getElementById("listaActividades");
const totalActividades = document.getElementById("totalActividades");
const formularioActividad = document.getElementById("formActividad");
const mensajeActividad = document.getElementById("mensajeActividad");
const botonCancelarEdicion = document.getElementById("cancelarEdicion");
const tituloFormActividad = document.getElementById("tituloFormActividad");
const botonGuardarActividad = document.getElementById("guardarActividad");
const campoTotalRecaudado = document.getElementById("campoTotalRecaudado");

// Estado local del rol del usuario y arreglo en memoria de actividades cargadas
let esAdministrador = (localStorage.getItem("rol") || "").toLowerCase() === "admin";
let actividades = [];

// Función auxiliar que comunica el frontend con ../Modelo/gestionarActividades.php
async function solicitarApi(metodo, datos) {
    const opciones = {
        method: metodo,
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        // Envía la cookie de sesión PHP para autenticar la solicitud
        credentials: "include"
    };

    // Adjunta el cuerpo JSON cuando se envían datos (POST, PUT o DELETE)
    if (datos) {
        opciones.body = JSON.stringify(datos);
    }

    const respuesta = await fetch("../Modelo/gestionarActividades.php", opciones);
    const texto = await respuesta.text();

    // Convierte la respuesta del servidor de texto a objeto JSON
    let resultado = {};
    try {
        resultado = JSON.parse(texto);
    } catch {
        throw new Error(`Respuesta inválida del servidor (HTTP ${respuesta.status})`);
    }

    // Si la sesión expiró (HTTP 401), limpia localStorage y redirige al Login
    if (respuesta.status === 401) {
        localStorage.clear();
        window.location.href = "Login.html";
        throw new Error(resultado.mensaje || "Sesión expirada");
    }

    // Si ocurrió algún error HTTP o lógico, lanza excepción con el mensaje devuelto
    if (!respuesta.ok || !resultado.success) {
        throw new Error(resultado.mensaje || resultado.message || "Error en la solicitud");
    }

    return resultado;
}

// Crea una celda <td> asignando el texto con textContent para evitar XSS
function crearCelda(texto) {
    const celda = document.createElement("td");
    celda.textContent = texto;
    return celda;
}

// Formatea montos monetarios en pesos colombianos (COP) sin decimales sobrantes
function formatearMonedaActividad(valor) {
    const numero = Number(valor || 0);
    const esEntero = Number.isInteger(numero);
    return numero.toLocaleString("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: esEntero ? 0 : 2,
        maximumFractionDigits: 2
    });
}

// Consulta el resumen de cuotas pendientes para las burbujas KPI del Asociado desde perfilFoto.php
async function cargarResumenPagosAsociado() {
    try {
        const respuesta = await fetch("../Modelo/perfilFoto.php", {
            method: "GET",
            headers: { "Accept": "application/json" },
            credentials: "include"
        });
        const resultado = await respuesta.json();

        if (!respuesta.ok || !resultado.success) {
            throw new Error(resultado.mensaje || "No se pudo consultar el resumen de cuotas");
        }

        if (resultado.resumen) {
            const elPend = document.getElementById("actKpiCuotasPendientes");
            const elPag = document.getElementById("actKpiCuotasPagadas");
            const elAct = document.getElementById("actKpiCreditosActivos");
            if (elPend) elPend.textContent = String(resultado.resumen.cuotasPendientes ?? 0);
            if (elPag) elPag.textContent = String(resultado.resumen.cuotasPagadas ?? 0);
            if (elAct) elAct.textContent = String(resultado.resumen.creditosActivos ?? 0);
        }
    } catch (error) {
        console.error("Error al cargar resumen de cuotas del asociado:", error);
    }
}

// Instancia del modal para que el Asociado realice un abono a una actividad
let modalAbonoActividadInstancia = null;
function obtenerModalAbonoActividad() {
    if (!modalAbonoActividadInstancia) {
        const el = document.getElementById("modalAbonarActividad");
        if (el && window.bootstrap) {
            modalAbonoActividadInstancia = new bootstrap.Modal(el);
        }
    }
    return modalAbonoActividadInstancia;
}

// Abre el modal de abono precargando la actividad elegida por el Asociado
function abrirModalAbonoActividad(actividad) {
    document.getElementById("abonoIdActividad").value = actividad.idActividad;
    const inputMonto = document.getElementById("montoAbonoActividad");
    if (inputMonto) inputMonto.value = "";
    const msg = document.getElementById("msgAbonoActividad");
    if (msg) msg.textContent = "";

    const detalle = document.getElementById("detalleActividadAbono");
    if (detalle) {
        const recaudadoNum = Number(actividad.totalRecaudado || 0);
        const recaudadoActual = formatearMonedaActividad(recaudadoNum);
        const tieneMeta = actividad.metaRecaudo !== null && actividad.metaRecaudo !== undefined && Number(actividad.metaRecaudo) > 0;
        const metaNum = tieneMeta ? Number(actividad.metaRecaudo) : 0;
        const faltante = tieneMeta ? Math.max(0, metaNum - recaudadoNum) : null;

        detalle.innerHTML = `
            <div class="fw-bold" style="color: #5c1d22;">${actividad.nombreActividad ?? "Actividad"}</div>
            <div>Fecha: <strong>${actividad.fechaEvento ?? "-"}</strong> · Municipio: <strong>${actividad.municipio ?? "-"}</strong></div>
            <div>Recaudado actual: <strong>${recaudadoActual}</strong>${
                tieneMeta
                    ? ` · Tope: <strong>${formatearMonedaActividad(metaNum)}</strong> · Faltan: <strong style="color: #b4232c;">${formatearMonedaActividad(faltante)}</strong>`
                    : ""
            }</div>`;
    }

    const modal = obtenerModalAbonoActividad();
    if (modal) modal.show();
}

// Renderiza la tabla de actividades con sus columnas y, si es admin, los botones de acción
function mostrarActividades() {
    if (!listaActividades) return;
    // Borra las filas anteriores
    listaActividades.replaceChildren();

    // Actualiza el contador del encabezado de la tabla y la burbuja KPI de actividades registradas
    if (totalActividades) {
        totalActividades.textContent = String(actividades.length);
    }
    const kpiActividades = document.getElementById("actKpiActividades");
    if (kpiActividades) {
        kpiActividades.textContent = String(actividades.length);
    }

    // Muestra un mensaje vacío si aún no existen actividades
    if (actividades.length === 0) {
        const fila = document.createElement("tr");
        const celda = document.createElement("td");
        celda.colSpan = 7;
        celda.className = "text-center py-4 text-muted";
        celda.textContent = "No hay actividades registradas.";
        fila.append(celda);
        listaActividades.append(fila);
        return;
    }

    // Recorre cada actividad y construye su fila en el DOM
    actividades.forEach((actividad, indice) => {
        const fila = document.createElement("tr");
        const tieneMeta = actividad.metaRecaudo !== null && actividad.metaRecaudo !== undefined && Number(actividad.metaRecaudo) > 0;
        const metaTexto = tieneMeta ? formatearMonedaActividad(actividad.metaRecaudo) : "Sin tope";
        const totalTexto =
            actividad.totalRecaudado === null || actividad.totalRecaudado === undefined
                ? "Pendiente"
                : formatearMonedaActividad(actividad.totalRecaudado);
        const metaCumplida = tieneMeta && Number(actividad.totalRecaudado || 0) >= Number(actividad.metaRecaudo);

        // Añade las 6 columnas principales (incluyendo Tope / Meta)
        fila.append(
            crearCelda(String(indice + 1)),
            crearCelda(actividad.nombreActividad ?? ""),
            crearCelda(actividad.fechaEvento ?? ""),
            crearCelda(actividad.municipio ?? ""),
            crearCelda(metaTexto),
            crearCelda(totalTexto)
        );

        // Columna Acciones: Admin (Editar y Eliminar), Asociado (botón Abonar o insignia Meta cumplida)
        const acciones = document.createElement("td");
        acciones.className = "text-nowrap text-center";

        if (esAdministrador) {
            const botonEditar = document.createElement("button");
            botonEditar.type = "button";
            botonEditar.className = "btn btn-sm btn-outline-primary me-1";
            botonEditar.style.flex = "0 0 auto";
            botonEditar.style.padding = "4px 8px";
            botonEditar.innerHTML = '<i class="bi bi-pencil"></i>';
            botonEditar.title = "Editar";
            botonEditar.addEventListener("click", () => abrirEdicion(actividad));

            const botonEliminar = document.createElement("button");
            botonEliminar.type = "button";
            botonEliminar.className = "btn btn-sm btn-outline-danger";
            botonEliminar.style.flex = "0 0 auto";
            botonEliminar.style.padding = "4px 8px";
            botonEliminar.innerHTML = '<i class="bi bi-trash"></i>';
            botonEliminar.title = "Eliminar";
            botonEliminar.addEventListener("click", () => eliminarActividad(actividad));

            acciones.append(botonEditar, botonEliminar);
        } else if (metaCumplida) {
            const badgeMeta = document.createElement("span");
            badgeMeta.className = "badge badge-estado-aprobado";
            badgeMeta.innerHTML = '<i class="bi bi-check-circle me-1"></i>Meta alcanzada';
            acciones.append(badgeMeta);
        } else {
            const botonAbonar = document.createElement("button");
            botonAbonar.type = "button";
            botonAbonar.className = "btn-accion-primaria-asoc";
            botonAbonar.style.flex = "0 0 auto";
            botonAbonar.innerHTML = '<i class="bi bi-cash-coin me-1"></i>Abonar';
            botonAbonar.title = "Abonar a esta actividad";
            botonAbonar.addEventListener("click", () => abrirModalAbonoActividad(actividad));

            acciones.append(botonAbonar);
        }

        fila.append(acciones);
        listaActividades.append(fila);
    });
}

// Consulta las actividades al servidor mediante GET y sincroniza la visibilidad según el rol
async function cargarActividades() {
    try {
        const resultado = await solicitarApi("GET");
        esAdministrador = (resultado.rol || "").toLowerCase() === "admin";

        // Muestra u oculta los bloques exclusivos de cada rol (la columna Acciones se mantiene visible para ambos)
        document.querySelectorAll("[data-solo-admin]").forEach((elemento) => {
            elemento.classList.toggle("d-none", !esAdministrador);
        });
        document.querySelectorAll("[data-solo-asociado]").forEach((elemento) => {
            elemento.classList.toggle("d-none", esAdministrador);
        });

        // Guarda el arreglo recibido y dibuja la tabla y la burbuja de Actividades Registradas
        actividades = Array.isArray(resultado.actividades) ? resultado.actividades : [];
        mostrarActividades();
    } catch (error) {
        console.error("Error al cargar actividades:", error);
        if (listaActividades) {
            listaActividades.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger">${error.message}</td></tr>`;
        }
    }
}

// Instancia del modal Bootstrap para crear/editar actividades (Admin)
let modalActividadInstancia = null;
function obtenerModalActividad() {
    if (!modalActividadInstancia) {
        const el = document.getElementById("modalActividadAdmin");
        if (el && window.bootstrap) {
            modalActividadInstancia = new bootstrap.Modal(el);
        }
    }
    return modalActividadInstancia;
}

// Muestra alerta de confirmación encima de la tabla de actividades
function mostrarAlertaAdminActividades(texto, tipo = "success") {
    const alerta = document.getElementById("alertaAdminActividades");
    if (!alerta) return;
    alerta.className = `alert alert-${tipo} mb-3`;
    alerta.textContent = texto;
}

// Restablece el formulario modal al modo de creación de nueva actividad
function resetearFormulario() {
    if (!formularioActividad) return;
    formularioActividad.reset();
    document.getElementById("idActividad").value = "";
    if (campoTotalRecaudado) campoTotalRecaudado.classList.add("d-none");
    if (tituloFormActividad) {
        tituloFormActividad.innerHTML = '<i class="bi bi-calendar-plus me-2"></i>Nueva Actividad';
    }
    if (botonGuardarActividad) {
        botonGuardarActividad.textContent = "Crear Actividad";
    }
}

// Abre el modal vacío en modo creación de actividad
function abrirCreacionActividad() {
    resetearFormulario();
    if (mensajeActividad) mensajeActividad.textContent = "";
    const modal = obtenerModalActividad();
    if (modal) modal.show();
}

// Carga los valores de la actividad seleccionada en el modal para editarla (incluyendo tope metaRecaudo y totalRecaudado)
function abrirEdicion(actividad) {
    if (!formularioActividad) return;
    formularioActividad.reset();
    document.getElementById("idActividad").value = actividad.idActividad;
    document.getElementById("nombreActividad").value = actividad.nombreActividad ?? "";
    document.getElementById("fechaEvento").value = actividad.fechaEvento ?? "";
    document.getElementById("municipio").value = actividad.municipio ?? "";
    const inputMeta = document.getElementById("metaRecaudo");
    if (inputMeta) inputMeta.value = actividad.metaRecaudo ?? "";
    document.getElementById("totalRecaudo").value = actividad.totalRecaudado ?? "";

    if (campoTotalRecaudado) campoTotalRecaudado.classList.remove("d-none");
    if (tituloFormActividad) {
        tituloFormActividad.innerHTML = '<i class="bi bi-pencil-square me-2"></i>Editar Actividad';
    }
    if (botonGuardarActividad) {
        botonGuardarActividad.textContent = "Guardar cambios";
    }
    if (mensajeActividad) mensajeActividad.textContent = "";

    const modal = obtenerModalActividad();
    if (modal) modal.show();
}

// Elimina la actividad tras confirmación del administrador y actualiza la tabla
async function eliminarActividad(actividad) {
    const confirmar = window.confirm(`¿Desea eliminar la actividad "${actividad.nombreActividad}"?`);
    if (!confirmar) return;

    try {
        await solicitarApi("DELETE", { idActividad: actividad.idActividad });
        mostrarAlertaAdminActividades("Actividad eliminada correctamente.", "success");
        await cargarActividades();
    } catch (error) {
        alert(error.message);
    }
}

// Botón "+ Nueva" del encabezado de la tabla de actividades
const btnNuevaActividadHeader = document.getElementById("btnNuevaActividadHeader");
if (btnNuevaActividadHeader) {
    btnNuevaActividadHeader.addEventListener("click", () => abrirCreacionActividad());
}

// Al pulsar Cancelar, limpia el formulario
if (botonCancelarEdicion) {
    botonCancelarEdicion.addEventListener("click", () => {
        resetearFormulario();
        if (mensajeActividad) mensajeActividad.textContent = "";
    });
}

// Procesa el envío del formulario para crear (POST) o actualizar (PUT) una actividad
if (formularioActividad) {
    formularioActividad.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        const idActividad = document.getElementById("idActividad").value;
        const metaValor = document.getElementById("metaRecaudo")?.value ?? "";
        const datos = {
            nombreActividad: document.getElementById("nombreActividad").value.trim(),
            fechaEvento: document.getElementById("fechaEvento").value,
            municipio: document.getElementById("municipio").value.trim(),
            metaRecaudo: metaValor === "" ? null : Number(metaValor)
        };

        if (idActividad) {
            datos.idActividad = Number(idActividad);
            const total = document.getElementById("totalRecaudo").value;
            datos.totalRecaudado = total === "" ? null : Number(total);
        }

        if (botonGuardarActividad) botonGuardarActividad.disabled = true;
        if (mensajeActividad) mensajeActividad.textContent = "";

        try {
            const resultado = await solicitarApi(idActividad ? "PUT" : "POST", datos);
            resetearFormulario();
            const modal = obtenerModalActividad();
            if (modal) modal.hide();
            mostrarAlertaAdminActividades(
                resultado.mensaje ||
                    (idActividad ? "Actividad actualizada correctamente." : "Actividad creada exitosamente."),
                "success"
            );
            await cargarActividades();
        } catch (error) {
            if (mensajeActividad) {
                mensajeActividad.textContent = error.message;
            } else {
                alert(error.message);
            }
        } finally {
            if (botonGuardarActividad) botonGuardarActividad.disabled = false;
        }
    });
}

// Procesa el abono enviado por el Asociado desde el modal #modalAbonarActividad
const formAbonarActividad = document.getElementById("formAbonarActividad");
if (formAbonarActividad) {
    formAbonarActividad.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        const idActividad = Number(document.getElementById("abonoIdActividad").value);
        const monto = Number(document.getElementById("montoAbonoActividad").value);
        const btnConfirmar = document.getElementById("btnConfirmarAbonoActividad");
        const msg = document.getElementById("msgAbonoActividad");

        if (!Number.isFinite(monto) || monto <= 0) {
            if (msg) msg.textContent = "Ingresa un monto válido mayor a cero.";
            return;
        }

        if (btnConfirmar) btnConfirmar.disabled = true;
        if (msg) msg.textContent = "";

        try {
            const resultado = await solicitarApi("POST", {
                accion: "abonar",
                idActividad,
                monto
            });
            formAbonarActividad.reset();
            const modal = obtenerModalAbonoActividad();
            if (modal) modal.hide();
            mostrarAlertaAdminActividades(
                resultado.mensaje || "Abono registrado correctamente en la actividad.",
                "success"
            );
            await cargarActividades();
        } catch (error) {
            if (msg) msg.textContent = error.message;
        } finally {
            if (btnConfirmar) btnConfirmar.disabled = false;
        }
    });
}

// Ejecuta la carga inicial al abrir la vista de Actividades
cargarActividades();
