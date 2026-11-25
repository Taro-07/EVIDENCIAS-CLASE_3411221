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

// Renderiza la tabla de actividades con sus columnas y, si es admin, los botones de acción
function mostrarActividades() {
    if (!listaActividades) return;
    // Borra las filas anteriores
    listaActividades.replaceChildren();

    // Actualiza el contador del encabezado de la tabla
    if (totalActividades) {
        totalActividades.textContent = String(actividades.length);
    }

    // Muestra un mensaje vacío si aún no existen actividades
    if (actividades.length === 0) {
        const fila = document.createElement("tr");
        const celda = document.createElement("td");
        celda.colSpan = esAdministrador ? 6 : 5;
        celda.className = "text-center py-4 text-muted";
        celda.textContent = "No hay actividades registradas.";
        fila.append(celda);
        listaActividades.append(fila);
        return;
    }

    // Recorre cada actividad y construye su fila en el DOM
    actividades.forEach((actividad, indice) => {
        const fila = document.createElement("tr");
        // Formatea el total recaudado en pesos colombianos (COP) o muestra "Pendiente" si es null
        const totalTexto =
            actividad.totalRecaudado === null || actividad.totalRecaudado === undefined
                ? "Pendiente"
                : Number(actividad.totalRecaudado).toLocaleString("es-CO", {
                      style: "currency",
                      currency: "COP"
                  });

        // Añade las 5 columnas principales
        fila.append(
            crearCelda(String(indice + 1)),
            crearCelda(actividad.nombreActividad ?? ""),
            crearCelda(actividad.fechaEvento ?? ""),
            crearCelda(actividad.municipio ?? ""),
            crearCelda(totalTexto)
        );

        // Si el usuario es administrador, añade los botones Editar y Eliminar
        if (esAdministrador) {
            const acciones = document.createElement("td");
            acciones.className = "text-nowrap";

            // Botón Editar: carga la actividad en el formulario superior
            const botonEditar = document.createElement("button");
            botonEditar.type = "button";
            botonEditar.className = "btn btn-sm btn-outline-primary me-2";
            botonEditar.style.flex = "0 0 auto";
            botonEditar.style.padding = "4px 8px";
            botonEditar.innerHTML = '<i class="bi bi-pencil"></i>';
            botonEditar.title = "Editar";
            botonEditar.addEventListener("click", () => abrirEdicion(actividad));

            // Botón Eliminar: pide confirmación y borra la actividad
            const botonEliminar = document.createElement("button");
            botonEliminar.type = "button";
            botonEliminar.className = "btn btn-sm btn-outline-danger";
            botonEliminar.style.flex = "0 0 auto";
            botonEliminar.style.padding = "4px 8px";
            botonEliminar.innerHTML = '<i class="bi bi-trash"></i>';
            botonEliminar.title = "Eliminar";
            botonEliminar.addEventListener("click", () => eliminarActividad(actividad));

            acciones.append(botonEditar, botonEliminar);
            fila.append(acciones);
        }

        listaActividades.append(fila);
    });
}

// Consulta las actividades al servidor mediante GET y sincroniza la visibilidad según el rol
async function cargarActividades() {
    try {
        const resultado = await solicitarApi("GET");
        esAdministrador = (resultado.rol || "").toLowerCase() === "admin";

        // Muestra u oculta el encabezado Acciones y el formulario superior según si es admin
        const encabezadoAcciones = document.getElementById("encabezadoAcciones");
        if (encabezadoAcciones) encabezadoAcciones.classList.toggle("d-none", !esAdministrador);

        document.querySelectorAll("[data-solo-admin]").forEach((elemento) => {
            elemento.classList.toggle("d-none", !esAdministrador);
        });

        // Guarda el arreglo recibido y dibuja la tabla
        actividades = Array.isArray(resultado.actividades) ? resultado.actividades : [];
        mostrarActividades();
    } catch (error) {
        console.error("Error al cargar actividades:", error);
        if (listaActividades) {
            listaActividades.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger">${error.message}</td></tr>`;
        }
    }
}

// Restablece el formulario superior al modo de creación de nueva actividad
function resetearFormulario() {
    if (!formularioActividad) return;
    formularioActividad.reset();
    document.getElementById("idActividad").value = "";
    if (campoTotalRecaudado) campoTotalRecaudado.classList.add("d-none");
    if (botonCancelarEdicion) botonCancelarEdicion.classList.add("d-none");
    if (tituloFormActividad) {
        tituloFormActividad.innerHTML = '<i class="bi bi-calendar-plus"></i> Nueva Actividad';
    }
    if (botonGuardarActividad) {
        botonGuardarActividad.textContent = "Crear Actividad";
    }
}

// Carga los valores de la actividad seleccionada en el formulario superior para editarla
function abrirEdicion(actividad) {
    if (!formularioActividad) return;
    formularioActividad.reset();
    document.getElementById("idActividad").value = actividad.idActividad;
    document.getElementById("nombreActividad").value = actividad.nombreActividad ?? "";
    document.getElementById("fechaEvento").value = actividad.fechaEvento ?? "";
    document.getElementById("municipio").value = actividad.municipio ?? "";
    document.getElementById("totalRecaudo").value = actividad.totalRecaudado ?? "";

    // Muestra el campo Total Recaudado y el botón Cancelar solo en modo edición
    if (campoTotalRecaudado) campoTotalRecaudado.classList.remove("d-none");
    if (botonCancelarEdicion) botonCancelarEdicion.classList.remove("d-none");
    if (tituloFormActividad) {
        tituloFormActividad.innerHTML = '<i class="bi bi-pencil-square"></i> Editar Actividad';
    }
    if (botonGuardarActividad) {
        botonGuardarActividad.textContent = "Guardar cambios";
    }
    // Sube la vista suavemente hacia el formulario
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// Elimina la actividad tras confirmación del administrador y actualiza la tabla
async function eliminarActividad(actividad) {
    const confirmar = window.confirm(`¿Desea eliminar la actividad "${actividad.nombreActividad}"?`);
    if (!confirmar) return;

    try {
        await solicitarApi("DELETE", { idActividad: actividad.idActividad });
        if (mensajeActividad) {
            mensajeActividad.textContent = "Actividad eliminada correctamente.";
        }
        await cargarActividades();
    } catch (error) {
        alert(error.message);
    }
}

// Al pulsar Cancelar, limpia el formulario y vuelve al modo creación
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

        // Lee el ID oculto para decidir si se crea o se edita
        const idActividad = document.getElementById("idActividad").value;
        const datos = {
            nombreActividad: document.getElementById("nombreActividad").value.trim(),
            fechaEvento: document.getElementById("fechaEvento").value,
            municipio: document.getElementById("municipio").value.trim()
        };

        // Si está editando, agrega el ID y el total recaudado (o null si quedó vacío)
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
            if (mensajeActividad) {
                mensajeActividad.textContent =
                    resultado.mensaje ||
                    (idActividad ? "Actividad actualizada correctamente." : "Actividad creada exitosamente.");
            }
            // Recarga el listado desde el servidor
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

// Ejecuta la carga inicial al abrir la vista de Actividades
cargarActividades();
