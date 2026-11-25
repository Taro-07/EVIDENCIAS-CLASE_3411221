// Referencias a los elementos HTML del módulo Asociados (tabla, contador y formulario)
const listaAsociados = document.getElementById("listaAsociados");
const totalAsociados = document.getElementById("totalAsociados");
const formAsociado = document.getElementById("formAsociado");
const mensajeAsociado = document.getElementById("mensajeAsociado");
const btnGuardarAsociado = document.getElementById("btnGuardarAsociado");
const btnCancelarEdicion = document.getElementById("cancelarEdicionAsociado");
const tituloFormAsociado = document.getElementById("tituloFormAsociado");
const campoRolAsociado = document.getElementById("campoRolAsociado");

// Estado local: determina si el usuario es administrador, guarda la lista (Admin) o el perfil propio (Asociado)
let esAdministrador = (localStorage.getItem("rol") || "").toLowerCase() === "admin";
let asociadosLista = [];
let perfilActual = null;

// Referencias a los elementos de la Ficha del Asociado y su modal de actualización
const btnAbrirEditarPerfil = document.getElementById("btnAbrirEditarPerfil");
const formEditarPerfil = document.getElementById("formEditarPerfil");
const btnGuardarPerfil = document.getElementById("btnGuardarPerfil");
const alertaPerfil = document.getElementById("alertaPerfil");
const modalPerfilEl = document.getElementById("modalEditarPerfil");
const modalEditarPerfil = modalPerfilEl && window.bootstrap ? new bootstrap.Modal(modalPerfilEl) : null;

// Función centralizada para realizar peticiones GET, POST, PUT y DELETE a gestionarAsociados.php
async function solicitarApiAsociados(metodo, datos) {
    // Configura el método HTTP, las cabeceras JSON y el envío de cookies de sesión
    const opciones = {
        method: metodo,
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        credentials: "include"
    };

    // Si se envían datos (POST, PUT o DELETE), los serializa a cadena JSON
    if (datos) {
        opciones.body = JSON.stringify(datos);
    }

    // Ejecuta la petición HTTP contra el backend de asociados
    const respuesta = await fetch("../Modelo/gestionarAsociados.php", opciones);
    const texto = await respuesta.text();

    // Intenta convertir la respuesta en objeto JSON
    let resultado = {};
    try {
        resultado = JSON.parse(texto);
    } catch {
        throw new Error(`Respuesta inválida del servidor (HTTP ${respuesta.status})`);
    }

    // Si el servidor responde 401 (sesión vencida o no iniciada), redirige al Login
    if (respuesta.status === 401) {
        localStorage.clear();
        window.location.href = "Login.html";
        throw new Error(resultado.mensaje || "Sesión expirada");
    }

    // Si hubo cualquier otro error HTTP o success es false, lanza una excepción con el mensaje del servidor
    if (!respuesta.ok || !resultado.success) {
        throw new Error(resultado.mensaje || resultado.message || "Error en la solicitud");
    }

    return resultado;
}

// Crea una celda <td> de texto seguro (evita inyección HTML) mostrando "-" si el valor está vacío
function crearCelda(texto) {
    const td = document.createElement("td");
    td.textContent = texto !== null && texto !== undefined && String(texto).trim() !== "" ? String(texto) : "-";
    return td;
}

// Dibuja todas las filas de asociados dentro del <tbody> de la tabla HTML
function mostrarAsociados() {
    if (!listaAsociados) return;
    // Limpia el contenido anterior (como "Cargando asociados...")
    listaAsociados.replaceChildren();

    // Actualiza la insignia con la cantidad total de asociados
    if (totalAsociados) {
        totalAsociados.textContent = String(asociadosLista.length);
    }

    // Si no existen registros, muestra una fila informativa centrada
    if (asociadosLista.length === 0) {
        const fila = document.createElement("tr");
        const celda = document.createElement("td");
        celda.colSpan = esAdministrador ? 12 : 11;
        celda.className = "text-center py-4 text-muted";
        celda.textContent = "No hay asociados registrados.";
        fila.append(celda);
        listaAsociados.append(fila);
        return;
    }

    // Recorre cada asociado y construye su fila <tr> con sus columnas
    asociadosLista.forEach((asociado, indice) => {
        const fila = document.createElement("tr");

        // Crea una insignia de color para el rol (azul para Admin, verde para Asociado)
        const celdaRol = document.createElement("td");
        const badge = document.createElement("span");
        const esAdminFila = (asociado.rol || "").toLowerCase() === "admin";
        badge.className = esAdminFila ? "badge bg-primary" : "badge bg-success";
        badge.textContent = asociado.rol || "Asociado";
        celdaRol.append(badge);

        // Agrega las 11 columnas con los datos del asociado
        fila.append(
            crearCelda(indice + 1),
            crearCelda(asociado.documento),
            crearCelda(asociado.nombres),
            crearCelda(asociado.apellidos),
            crearCelda(asociado.FechaNacimiento),
            crearCelda(asociado.genero),
            crearCelda(asociado.DireccionResidencia),
            crearCelda(asociado.ciudad),
            crearCelda(asociado.telefono),
            crearCelda(asociado.email),
            celdaRol
        );

        // Solo si el usuario autenticado es administrador agrega los botones de Editar y Eliminar
        if (esAdministrador) {
            const acciones = document.createElement("td");
            acciones.className = "text-nowrap";

            // Botón azul para cargar los datos de este asociado en el formulario superior
            const botonEditar = document.createElement("button");
            botonEditar.type = "button";
            botonEditar.className = "btn btn-sm btn-outline-primary me-2";
            botonEditar.style.flex = "0 0 auto";
            botonEditar.style.padding = "4px 8px";
            botonEditar.innerHTML = '<i class="bi bi-pencil"></i>';
            botonEditar.title = "Editar asociado";
            botonEditar.addEventListener("click", () => abrirEdicionAsociado(asociado));

            // Botón rojo para eliminar este asociado previa confirmación
            const botonEliminar = document.createElement("button");
            botonEliminar.type = "button";
            botonEliminar.className = "btn btn-sm btn-outline-danger";
            botonEliminar.style.flex = "0 0 auto";
            botonEliminar.style.padding = "4px 8px";
            botonEliminar.innerHTML = '<i class="bi bi-trash"></i>';
            botonEliminar.title = "Eliminar asociado";
            botonEliminar.addEventListener("click", () => eliminarAsociado(asociado));

            acciones.append(botonEditar, botonEliminar);
            fila.append(acciones);
        }

        // Inserta la fila completa en la tabla
        listaAsociados.append(fila);
    });
}

// Rellena todos los campos visibles de la tarjeta "Ficha del Asociado" con el perfil autenticado
function mostrarFichaPersonal(perfil) {
    perfilActual = perfil;
    const ponerTexto = (id, valor) => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = valor !== null && valor !== undefined && String(valor).trim() !== "" ? String(valor) : "-";
        }
    };

    ponerTexto("fichaDocumento", perfil?.documento);
    ponerTexto("fichaRol", perfil?.rol || "Asociado");
    ponerTexto("fichaNombres", perfil?.nombres);
    ponerTexto("fichaApellidos", perfil?.apellidos);
    ponerTexto("fichaFechaNacimiento", perfil?.FechaNacimiento);
    ponerTexto("fichaGenero", perfil?.genero);
    ponerTexto("fichaCiudad", perfil?.ciudad);
    ponerTexto("fichaDireccion", perfil?.DireccionResidencia);
    ponerTexto("fichaTelefono", perfil?.telefono);
    ponerTexto("fichaEmail", perfil?.email);
}

// Muestra un aviso temporal en la sección Mis Datos Personales
function mostrarAlertaPerfil(texto, tipo = "success") {
    if (!alertaPerfil) return;
    alertaPerfil.className = `alert alert-${tipo} mb-3`;
    alertaPerfil.textContent = texto;
}

// Abre el modal de actualización de perfil cargado con los datos actuales del asociado
function abrirModalEditarPerfil() {
    if (!perfilActual || !formEditarPerfil) return;
    formEditarPerfil.reset();

    document.getElementById("perfilNombres").value = perfilActual.nombres ?? "";
    document.getElementById("perfilApellidos").value = perfilActual.apellidos ?? "";
    document.getElementById("perfilFechaNacimiento").value = perfilActual.FechaNacimiento ?? "";
    document.getElementById("perfilDireccion").value = perfilActual.DireccionResidencia ?? "";
    document.getElementById("perfilTelefono").value = perfilActual.telefono ?? "";
    document.getElementById("perfilEmail").value = perfilActual.email ?? "";

    const selectGenero = document.getElementById("perfilGenero");
    if (selectGenero) {
        selectGenero.value = perfilActual.genero || "Otro";
    }

    const selectCiudad = document.getElementById("perfilCiudad");
    if (selectCiudad) {
        const ciudadValor = perfilActual.ciudad || "";
        const existe = Array.from(selectCiudad.options).some((opt) => opt.value === ciudadValor);
        if (ciudadValor && !existe) {
            const nuevaOpcion = document.createElement("option");
            nuevaOpcion.value = ciudadValor;
            nuevaOpcion.textContent = ciudadValor;
            selectCiudad.append(nuevaOpcion);
        }
        selectCiudad.value = ciudadValor;
    }

    if (modalEditarPerfil) {
        modalEditarPerfil.show();
    }
}

// Consulta la API por GET, sincroniza la vista según el rol (Admin = tabla, Asociado = ficha personal)
async function cargarAsociados() {
    try {
        const resultado = await solicitarApiAsociados("GET");
        // Confirma el rol real devuelto por la sesión PHP del servidor
        esAdministrador = (resultado.rol || "").toLowerCase() === "admin";

        // Muestra u oculta los bloques según si es administrador o asociado
        const encabezadoAcciones = document.getElementById("encabezadoAccionesAsociado");
        if (encabezadoAcciones) {
            encabezadoAcciones.classList.toggle("d-none", !esAdministrador);
        }
        document.querySelectorAll("[data-solo-admin]").forEach((elemento) => {
            elemento.classList.toggle("d-none", !esAdministrador);
        });
        document.querySelectorAll("[data-solo-asociado]").forEach((elemento) => {
            elemento.classList.toggle("d-none", esAdministrador);
        });

        if (esAdministrador) {
            // Almacena los asociados recibidos y actualiza la tabla de administración
            asociadosLista = Array.isArray(resultado.asociados) ? resultado.asociados : [];
            mostrarAsociados();
        } else if (resultado.perfil) {
            // Muestra únicamente la ficha personal del asociado autenticado
            mostrarFichaPersonal(resultado.perfil);
        }
    } catch (error) {
        console.error("Error al cargar asociados:", error);
        if (esAdministrador && listaAsociados) {
            listaAsociados.innerHTML = `<tr><td colspan="12" class="text-center py-4 text-danger">${error.message}</td></tr>`;
        } else {
            mostrarAlertaPerfil(error.message, "danger");
        }
    }
}

// Conecta el botón "Actualizar Mis Datos" con la apertura del modal de perfil
if (btnAbrirEditarPerfil) {
    btnAbrirEditarPerfil.addEventListener("click", abrirModalEditarPerfil);
}

// Envía la actualización de los datos propios del asociado autenticado mediante PUT
if (formEditarPerfil) {
    formEditarPerfil.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        const datos = {
            nombres: document.getElementById("perfilNombres").value.trim(),
            apellidos: document.getElementById("perfilApellidos").value.trim(),
            FechaNacimiento: document.getElementById("perfilFechaNacimiento").value,
            genero: document.getElementById("perfilGenero").value,
            ciudad: document.getElementById("perfilCiudad").value,
            DireccionResidencia: document.getElementById("perfilDireccion").value.trim(),
            telefono: document.getElementById("perfilTelefono").value.trim(),
            email: document.getElementById("perfilEmail").value.trim()
        };

        if (btnGuardarPerfil) btnGuardarPerfil.disabled = true;

        try {
            const resultado = await solicitarApiAsociados("PUT", datos);
            if (resultado.nombre) {
                localStorage.setItem("nombre", resultado.nombre);
            }
            if (resultado.perfil) {
                mostrarFichaPersonal(resultado.perfil);
            } else {
                await cargarAsociados();
            }
            if (modalEditarPerfil) {
                modalEditarPerfil.hide();
            }
            mostrarAlertaPerfil(resultado.mensaje || "Tus datos personales se actualizaron correctamente.", "success");
        } catch (error) {
            mostrarAlertaPerfil(error.message, "danger");
        } finally {
            if (btnGuardarPerfil) btnGuardarPerfil.disabled = false;
        }
    });
}

// Restaura el formulario superior a su modo inicial de creación de asociado
function resetearFormularioAsociado() {
    if (!formAsociado) return;
    formAsociado.reset();
    document.getElementById("idAsociado").value = "";
    if (campoRolAsociado) campoRolAsociado.classList.add("d-none");
    if (btnCancelarEdicion) btnCancelarEdicion.classList.add("d-none");
    if (tituloFormAsociado) {
        tituloFormAsociado.innerHTML = '<i class="bi bi-person-plus"></i> Registro de Asociado';
    }
    if (btnGuardarAsociado) {
        btnGuardarAsociado.textContent = "Guardar Asociado";
    }
}

// Llena todos los campos del formulario superior con los datos del asociado seleccionado para editar
function abrirEdicionAsociado(asociado) {
    if (!formAsociado) return;
    formAsociado.reset();

    // Carga cada campo individual en su input correspondiente
    document.getElementById("idAsociado").value = asociado.idAsociado;
    document.getElementById("documento").value = asociado.documento ?? "";
    document.getElementById("nombres").value = asociado.nombres ?? "";
    document.getElementById("apellidos").value = asociado.apellidos ?? "";
    document.getElementById("email").value = asociado.email ?? "";
    document.getElementById("telefono").value = asociado.telefono ?? "";
    document.getElementById("FechaNacimiento").value = asociado.FechaNacimiento ?? "";
    document.getElementById("DireccionResidencia").value = asociado.DireccionResidencia ?? "";

    // Selecciona el género actual del asociado
    const selectGenero = document.getElementById("genero");
    if (selectGenero) {
        selectGenero.value = asociado.genero || "Otro";
    }

    // Selecciona la ciudad actual; si no existe en las opciones del select, la añade dinámicamente
    const selectCiudad = document.getElementById("ciudad");
    if (selectCiudad) {
        const valorCiudad = asociado.ciudad || "";
        const existeOpcion = Array.from(selectCiudad.options).some((opt) => opt.value === valorCiudad);
        if (valorCiudad && !existeOpcion) {
            const nuevaOpcion = document.createElement("option");
            nuevaOpcion.value = valorCiudad;
            nuevaOpcion.textContent = valorCiudad;
            selectCiudad.append(nuevaOpcion);
        }
        selectCiudad.value = valorCiudad;
    }

    // Selecciona el rol actual (Admin o Asociado)
    const selectRol = document.getElementById("rol");
    if (selectRol) {
        selectRol.value = (asociado.rol || "").toLowerCase() === "admin" ? "Admin" : "Asociado";
    }

    // Muestra el selector de rol, el botón Cancelar y cambia el título/botón a modo edición
    if (campoRolAsociado) campoRolAsociado.classList.remove("d-none");
    if (btnCancelarEdicion) btnCancelarEdicion.classList.remove("d-none");
    if (tituloFormAsociado) {
        tituloFormAsociado.innerHTML = '<i class="bi bi-pencil-square"></i> Editar Asociado';
    }
    if (btnGuardarAsociado) {
        btnGuardarAsociado.textContent = "Guardar cambios";
    }
    if (mensajeAsociado) mensajeAsociado.textContent = "";

    // Desplaza suavemente la pantalla hacia arriba para visualizar el formulario de edición
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// Pide confirmación y envía la petición DELETE para eliminar un asociado
async function eliminarAsociado(asociado) {
    const nombreCompleto = `${asociado.nombres ?? ""} ${asociado.apellidos ?? ""}`.trim();
    const confirmar = window.confirm(`¿Desea eliminar al asociado "${nombreCompleto}" (Doc: ${asociado.documento})?`);
    if (!confirmar) return;

    try {
        const resultado = await solicitarApiAsociados("DELETE", { idAsociado: asociado.idAsociado });
        // Si el usuario estaba editando justo ese registro, limpia el formulario
        if (document.getElementById("idAsociado").value === String(asociado.idAsociado)) {
            resetearFormularioAsociado();
        }
        if (mensajeAsociado) {
            mensajeAsociado.textContent = resultado.mensaje || "Asociado eliminado correctamente.";
        }
        // Recarga la lista actualizada desde la base de datos
        await cargarAsociados();
    } catch (error) {
        alert(error.message);
    }
}

// Configura el botón Cancelar para salir del modo edición y limpiar el formulario
if (btnCancelarEdicion) {
    btnCancelarEdicion.addEventListener("click", () => {
        resetearFormularioAsociado();
        if (mensajeAsociado) mensajeAsociado.textContent = "";
    });
}

// Maneja el envío del formulario tanto para registrar (POST) como para actualizar (PUT) un asociado
if (formAsociado) {
    formAsociado.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        // Si existe un idAsociado oculto, se trata de una edición (PUT); si no, de una creación (POST)
        const idAsociado = document.getElementById("idAsociado").value;
        const datos = {
            documento: document.getElementById("documento").value.trim(),
            nombres: document.getElementById("nombres").value.trim(),
            apellidos: document.getElementById("apellidos").value.trim(),
            email: document.getElementById("email").value.trim(),
            telefono: document.getElementById("telefono").value.trim(),
            FechaNacimiento: document.getElementById("FechaNacimiento").value,
            genero: document.getElementById("genero").value,
            DireccionResidencia: document.getElementById("DireccionResidencia").value.trim(),
            ciudad: document.getElementById("ciudad").value
        };

        // En edición, incluye también el ID del registro y el rol seleccionado
        if (idAsociado) {
            datos.idAsociado = Number(idAsociado);
            datos.rol = document.getElementById("rol").value;
        }

        // Desactiva el botón durante el envío y limpia mensajes anteriores
        if (btnGuardarAsociado) btnGuardarAsociado.disabled = true;
        if (mensajeAsociado) mensajeAsociado.textContent = "";

        try {
            // Envía PUT o POST según corresponda
            const resultado = await solicitarApiAsociados(idAsociado ? "PUT" : "POST", datos);
            resetearFormularioAsociado();
            if (mensajeAsociado) {
                mensajeAsociado.textContent =
                    resultado.mensaje ||
                    (idAsociado ? "Asociado actualizado correctamente." : "Asociado registrado con éxito.");
            }
            // Refresca la tabla con los cambios guardados
            await cargarAsociados();
        } catch (error) {
            if (mensajeAsociado) {
                mensajeAsociado.textContent = error.message;
            } else {
                alert(error.message);
            }
        } finally {
            if (btnGuardarAsociado) btnGuardarAsociado.disabled = false;
        }
    });
}

// Carga inicial de los asociados al abrir la página
cargarAsociados();
