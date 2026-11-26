// Referencias a los elementos HTML del módulo Actividades (tabla, contador y formulario)
// Cuerpo de la tabla donde se renderizan las actividades registradas
const listaActividades = document.getElementById("listaActividades");
// Insignia con el contador total de actividades en el encabezado de la tabla
const totalActividades = document.getElementById("totalActividades");
// Formulario modal para crear o editar una actividad (vista Admin)
const formularioActividad = document.getElementById("formActividad");
// Contenedor para mostrar mensajes de validación o error en el formulario modal
const mensajeActividad = document.getElementById("mensajeActividad");
// Botón para cancelar la edición y limpiar el formulario
const botonCancelarEdicion = document.getElementById("cancelarEdicion");
// Título del modal que cambia entre "Nueva Actividad" y "Editar Actividad"
const tituloFormActividad = document.getElementById("tituloFormActividad");
// Botón principal de envío del formulario de actividad
const botonGuardarActividad = document.getElementById("guardarActividad");
// Contenedor del campo Total Recaudado (visible únicamente al editar una actividad)
const campoTotalRecaudado = document.getElementById("campoTotalRecaudado");

// Estado local del rol del usuario y arreglo en memoria de actividades cargadas
// Bandera booleana que determina si el usuario autenticado es administrador
let esAdministrador = (localStorage.getItem("rol") || "").toLowerCase() === "admin";
// Arreglo en memoria con el listado de actividades devuelto por el backend
let actividades = [];

// Función auxiliar que comunica el frontend con ../Modelo/gestionarActividades.php
async function solicitarApi(metodo, datos) {
    // Configura método HTTP, cabeceras JSON y envío de cookies de sesión
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

    // Ejecuta la petición HTTP contra el backend de actividades
    const respuesta = await fetch("../Modelo/gestionarActividades.php", opciones);
    // Obtiene la respuesta como texto para validarla antes de parsear
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

    // Devuelve el objeto JSON resultante
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
    // Convierte el valor a número usando 0 como respaldo
    const numero = Number(valor || 0);
    // Verifica si la cifra es entera para omitir decimales innecesarios
    const esEntero = Number.isInteger(numero);
    // Formatea el número como moneda colombiana (COP)
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
        // Petición GET al endpoint de perfil para obtener los indicadores de cuotas del asociado
        const respuesta = await fetch("../Modelo/perfilFoto.php", {
            method: "GET",
            headers: { "Accept": "application/json" },
            credentials: "include"
        });
        // Decodifica la respuesta JSON
        const resultado = await respuesta.json();

        // Verifica que la solicitud haya sido exitosa
        if (!respuesta.ok || !resultado.success) {
            throw new Error(resultado.mensaje || "No se pudo consultar el resumen de cuotas");
        }

        // Si el backend incluye el objeto resumen, actualiza las tarjetas KPI en el DOM
        if (resultado.resumen) {
            const elPend = document.getElementById("actKpiCuotasPendientes");
            const elPag = document.getElementById("actKpiCuotasPagadas");
            const elAct = document.getElementById("actKpiCreditosActivos");
            if (elPend) elPend.textContent = String(resultado.resumen.cuotasPendientes ?? 0);
            if (elPag) elPag.textContent = String(resultado.resumen.cuotasPagadas ?? 0);
            if (elAct) elAct.textContent = String(resultado.resumen.creditosActivos ?? 0);
        }
    } catch (error) {
        // Registra el fallo en consola sin bloquear la interfaz
        console.error("Error al cargar resumen de cuotas del asociado:", error);
    }
}

// Instancia del modal para que el Asociado realice un abono a una actividad
let modalAbonoActividadInstancia = null;
// Obtiene o inicializa la instancia Bootstrap del modal de abono
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
    // Asigna el ID oculto de la actividad seleccionada
    document.getElementById("abonoIdActividad").value = actividad.idActividad;
    // Limpia el campo de monto y cualquier mensaje de error previo
    const inputMonto = document.getElementById("montoAbonoActividad");
    if (inputMonto) inputMonto.value = "";
    const msg = document.getElementById("msgAbonoActividad");
    if (msg) msg.textContent = "";

    // Rellena el detalle informativo de la actividad (nombre, fecha, municipio, recaudado y faltante)
    const detalle = document.getElementById("detalleActividadAbono");
    if (detalle) {
        const recaudadoNum = Number(actividad.totalRecaudado || 0);
        const recaudadoActual = formatearMonedaActividad(recaudadoNum);
        // Comprueba si la actividad tiene definida una meta de recaudo positiva
        const tieneMeta = actividad.metaRecaudo !== null && actividad.metaRecaudo !== undefined && Number(actividad.metaRecaudo) > 0;
        const metaNum = tieneMeta ? Number(actividad.metaRecaudo) : 0;
        // Calcula cuánto falta para alcanzar la meta sin permitir valores negativos
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

    // Abre el modal de abono para el asociado
    const modal = obtenerModalAbonoActividad();
    if (modal) modal.show();
}

// Renderiza la tabla de actividades con sus columnas y, si es admin, los botones de acción
function mostrarActividades() {
    // Sale si el tbody de actividades no existe en el DOM
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
        // Evalúa si existe meta de recaudo y formatea los montos para mostrar
        const tieneMeta = actividad.metaRecaudo !== null && actividad.metaRecaudo !== undefined && Number(actividad.metaRecaudo) > 0;
        const metaTexto = tieneMeta ? formatearMonedaActividad(actividad.metaRecaudo) : "Sin tope";
        const totalTexto =
            actividad.totalRecaudado === null || actividad.totalRecaudado === undefined
                ? "Pendiente"
                : formatearMonedaActividad(actividad.totalRecaudado);
        // Comprueba si el recaudo ya igualó o superó la meta establecida
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
            // Botón de edición exclusivo del administrador
            const botonEditar = document.createElement("button");
            botonEditar.type = "button";
            botonEditar.className = "btn btn-sm btn-outline-primary me-1";
            botonEditar.style.flex = "0 0 auto";
            botonEditar.style.padding = "4px 8px";
            botonEditar.innerHTML = '<i class="bi bi-pencil"></i>';
            botonEditar.title = "Editar";
            // Al hacer clic carga la actividad en el modal de edición
            botonEditar.addEventListener("click", () => abrirEdicion(actividad));

            // Botón de eliminación exclusivo del administrador
            const botonEliminar = document.createElement("button");
            botonEliminar.type = "button";
            botonEliminar.className = "btn btn-sm btn-outline-danger";
            botonEliminar.style.flex = "0 0 auto";
            botonEliminar.style.padding = "4px 8px";
            botonEliminar.innerHTML = '<i class="bi bi-trash"></i>';
            botonEliminar.title = "Eliminar";
            // Al hacer clic solicita confirmación y elimina la actividad
            botonEliminar.addEventListener("click", () => eliminarActividad(actividad));

            acciones.append(botonEditar, botonEliminar);
        } else if (metaCumplida) {
            // Para asociado: si la actividad ya cumplió la meta, muestra la insignia correspondiente
            const badgeMeta = document.createElement("span");
            badgeMeta.className = "badge badge-estado-aprobado";
            badgeMeta.innerHTML = '<i class="bi bi-check-circle me-1"></i>Meta alcanzada';
            acciones.append(badgeMeta);
        } else {
            // Para asociado: muestra el botón "Abonar" si todavía acepta aportes
            const botonAbonar = document.createElement("button");
            botonAbonar.type = "button";
            botonAbonar.className = "btn-accion-primaria-asoc";
            botonAbonar.style.flex = "0 0 auto";
            botonAbonar.innerHTML = '<i class="bi bi-cash-coin me-1"></i>Abonar';
            botonAbonar.title = "Abonar a esta actividad";
            // Abre el modal de abono precargado con esta actividad
            botonAbonar.addEventListener("click", () => abrirModalAbonoActividad(actividad));

            acciones.append(botonAbonar);
        }

        // Agrega la celda de acciones a la fila y la inserta en la tabla
        fila.append(acciones);
        listaActividades.append(fila);
    });
}

// Consulta las actividades al servidor mediante GET y sincroniza la visibilidad según el rol
async function cargarActividades() {
    try {
        // Obtiene las actividades y el rol verificado desde el backend
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
        // Registra el error y muestra un aviso dentro de la tabla
        console.error("Error al cargar actividades:", error);
        if (listaActividades) {
            listaActividades.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger">${error.message}</td></tr>`;
        }
    }
}

// Instancia del modal Bootstrap para crear/editar actividades (Admin)
let modalActividadInstancia = null;
// Obtiene o crea la instancia del modal de creación/edición de actividad
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
    // Limpia todos los campos del formulario
    formularioActividad.reset();
    // Borra el ID oculto para indicar que el próximo envío será una creación
    document.getElementById("idActividad").value = "";
    // Oculta el campo de Total Recaudado (solo aplica en edición)
    if (campoTotalRecaudado) campoTotalRecaudado.classList.add("d-none");
    // Restaura el título y el texto del botón al modo creación
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
    // Limpia el formulario antes de cargar los datos
    formularioActividad.reset();
    // Rellena cada input con la información actual de la actividad
    document.getElementById("idActividad").value = actividad.idActividad;
    document.getElementById("nombreActividad").value = actividad.nombreActividad ?? "";
    document.getElementById("fechaEvento").value = actividad.fechaEvento ?? "";
    document.getElementById("municipio").value = actividad.municipio ?? "";
    const inputMeta = document.getElementById("metaRecaudo");
    if (inputMeta) inputMeta.value = actividad.metaRecaudo ?? "";
    document.getElementById("totalRecaudo").value = actividad.totalRecaudado ?? "";

    // Muestra el campo Total Recaudado y actualiza los textos a modo edición
    if (campoTotalRecaudado) campoTotalRecaudado.classList.remove("d-none");
    if (tituloFormActividad) {
        tituloFormActividad.innerHTML = '<i class="bi bi-pencil-square me-2"></i>Editar Actividad';
    }
    if (botonGuardarActividad) {
        botonGuardarActividad.textContent = "Guardar cambios";
    }
    if (mensajeActividad) mensajeActividad.textContent = "";

    // Despliega el modal de edición
    const modal = obtenerModalActividad();
    if (modal) modal.show();
}

// Elimina la actividad tras confirmación del administrador y actualiza la tabla
async function eliminarActividad(actividad) {
    // Pide confirmación al administrador antes de eliminar
    const confirmar = window.confirm(`¿Desea eliminar la actividad "${actividad.nombreActividad}"?`);
    if (!confirmar) return;

    try {
        // Envía la petición DELETE con el ID de la actividad
        await solicitarApi("DELETE", { idActividad: actividad.idActividad });
        // Muestra alerta de éxito y recarga la tabla
        mostrarAlertaAdminActividades("Actividad eliminada correctamente.", "success");
        await cargarActividades();
    } catch (error) {
        alert(error.message);
    }
}

// Botón "+ Nueva" del encabezado de la tabla de actividades
const btnNuevaActividadHeader = document.getElementById("btnNuevaActividadHeader");
if (btnNuevaActividadHeader) {
    // Al hacer clic abre el modal en modo creación
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
        // Evita la recarga de la página
        evento.preventDefault();

        // Lee el ID oculto y construye el objeto con los datos de la actividad
        const idActividad = document.getElementById("idActividad").value;
        const metaValor = document.getElementById("metaRecaudo")?.value ?? "";
        const datos = {
            nombreActividad: document.getElementById("nombreActividad").value.trim(),
            fechaEvento: document.getElementById("fechaEvento").value,
            municipio: document.getElementById("municipio").value.trim(),
            metaRecaudo: metaValor === "" ? null : Number(metaValor)
        };

        // Si es edición, añade el ID y el total recaudado al objeto de envío
        if (idActividad) {
            datos.idActividad = Number(idActividad);
            const total = document.getElementById("totalRecaudo").value;
            datos.totalRecaudado = total === "" ? null : Number(total);
        }

        // Deshabilita el botón de envío y limpia mensajes previos
        if (botonGuardarActividad) botonGuardarActividad.disabled = true;
        if (mensajeActividad) mensajeActividad.textContent = "";

        try {
            // Envía PUT para actualizar o POST para crear la actividad
            const resultado = await solicitarApi(idActividad ? "PUT" : "POST", datos);
            // Resetea el formulario y cierra el modal
            resetearFormulario();
            const modal = obtenerModalActividad();
            if (modal) modal.hide();
            // Muestra confirmación y recarga la tabla
            mostrarAlertaAdminActividades(
                resultado.mensaje ||
                    (idActividad ? "Actividad actualizada correctamente." : "Actividad creada exitosamente."),
                "success"
            );
            await cargarActividades();
        } catch (error) {
            // Presenta el error al usuario
            if (mensajeActividad) {
                mensajeActividad.textContent = error.message;
            } else {
                alert(error.message);
            }
        } finally {
            // Reactiva el botón al concluir
            if (botonGuardarActividad) botonGuardarActividad.disabled = false;
        }
    });
}

// Procesa el abono enviado por el Asociado desde el modal #modalAbonarActividad
const formAbonarActividad = document.getElementById("formAbonarActividad");
if (formAbonarActividad) {
    formAbonarActividad.addEventListener("submit", async (evento) => {
        // Previene el envío estándar del formulario
        evento.preventDefault();
        // Obtiene el ID de la actividad, el monto ingresado y referencias del modal
        const idActividad = Number(document.getElementById("abonoIdActividad").value);
        const monto = Number(document.getElementById("montoAbonoActividad").value);
        const btnConfirmar = document.getElementById("btnConfirmarAbonoActividad");
        const msg = document.getElementById("msgAbonoActividad");

        // Valida que el monto sea un número finito mayor que cero
        if (!Number.isFinite(monto) || monto <= 0) {
            if (msg) msg.textContent = "Ingresa un monto válido mayor a cero.";
            return;
        }

        // Deshabilita el botón y limpia mensajes mientras se procesa el abono
        if (btnConfirmar) btnConfirmar.disabled = true;
        if (msg) msg.textContent = "";

        try {
            // Envía la acción "abonar" al backend mediante POST
            const resultado = await solicitarApi("POST", {
                accion: "abonar",
                idActividad,
                monto
            });
            // Limpia el formulario y cierra el modal de abono
            formAbonarActividad.reset();
            const modal = obtenerModalAbonoActividad();
            if (modal) modal.hide();
            // Muestra alerta de éxito y actualiza la tabla con el nuevo total recaudado
            mostrarAlertaAdminActividades(
                resultado.mensaje || "Abono registrado correctamente en la actividad.",
                "success"
            );
            await cargarActividades();
        } catch (error) {
            // Muestra el mensaje de error dentro del modal
            if (msg) msg.textContent = error.message;
        } finally {
            // Vuelve a habilitar el botón de confirmación
            if (btnConfirmar) btnConfirmar.disabled = false;
        }
    });
}

// Ejecuta la carga inicial al abrir la vista de Actividades
cargarActividades();
