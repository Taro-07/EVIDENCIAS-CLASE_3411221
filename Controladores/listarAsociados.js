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
let fotoPerfilActual = localStorage.getItem("fotoPerfil") || null;
let tonoAvatarActual = localStorage.getItem("avatarTono") || "avatar-tono-vino";

// Referencias a los elementos de la Ficha del Asociado unificada (foto + edición directa)
const formEditarPerfil = document.getElementById("formEditarPerfil");
const btnGuardarPerfil = document.getElementById("btnGuardarPerfil");
const alertaPerfil = document.getElementById("alertaPerfil");
const fichaAvatarPerfil = document.getElementById("fichaAvatarPerfil");
const fichaNombreCompleto = document.getElementById("fichaNombreCompleto");
const fichaInputFoto = document.getElementById("fichaInputFoto");
const btnFichaSubirFoto = document.getElementById("btnFichaSubirFoto");
const btnFichaQuitarFoto = document.getElementById("btnFichaQuitarFoto");
const fichaSelectorColor = document.getElementById("fichaSelectorColor");

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

        // Solo si el usuario autenticado es administrador agrega los botones Editar y Eliminar
        if (esAdministrador) {
            const acciones = document.createElement("td");
            acciones.className = "text-nowrap";

            // Botón azul para cargar los datos de este asociado en el modal de edición
            const botonEditar = document.createElement("button");
            botonEditar.type = "button";
            botonEditar.className = "btn btn-sm btn-outline-primary me-1";
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

// Obtiene la inicial en mayúscula del nombre para mostrarla por defecto cuando no hay foto
function obtenerInicialPerfil(nombre) {
    const limpio = String(nombre || "").trim();
    return limpio.length > 0 ? limpio.charAt(0).toUpperCase() : "A";
}

// Renderiza la foto de perfil o la inicial del nombre con el tono seleccionado
function renderizarAvatarFicha(nombreCompleto) {
    if (!fichaAvatarPerfil) return;
    fichaAvatarPerfil.classList.remove("avatar-tono-vino", "avatar-tono-terracota", "avatar-tono-cobre", "avatar-tono-ciruela");
    fichaAvatarPerfil.classList.add(tonoAvatarActual || "avatar-tono-vino");
    fichaAvatarPerfil.replaceChildren();

    if (fotoPerfilActual) {
        const img = document.createElement("img");
        img.src = `${fotoPerfilActual}?t=${Date.now()}`;
        img.alt = `Foto de perfil de ${nombreCompleto}`;
        img.onerror = () => {
            fichaAvatarPerfil.textContent = obtenerInicialPerfil(nombreCompleto);
        };
        fichaAvatarPerfil.append(img);
    } else {
        fichaAvatarPerfil.textContent = obtenerInicialPerfil(nombreCompleto);
    }

    // Muestra "Quitar foto" solo si hay foto subida y el selector de color solo si se usa inicial
    if (btnFichaQuitarFoto) {
        btnFichaQuitarFoto.classList.toggle("d-none", !fotoPerfilActual);
    }
    if (fichaSelectorColor) {
        fichaSelectorColor.classList.toggle("d-none", Boolean(fotoPerfilActual));
    }
    document.querySelectorAll(".btn-tono-ficha").forEach((btn) => {
        btn.classList.toggle("activo", btn.dataset.tono === tonoAvatarActual);
    });
}

// Rellena directamente el encabezado, avatar y todos los campos editables de "Mis Datos Personales"
function mostrarFichaPersonal(perfil) {
    perfilActual = perfil;
    const nombreCompleto = `${perfil?.nombres ?? ""} ${perfil?.apellidos ?? ""}`.trim() || "Asociado";

    if (fichaNombreCompleto) fichaNombreCompleto.textContent = nombreCompleto;
    const docEl = document.getElementById("fichaDocumento");
    if (docEl) docEl.textContent = perfil?.documento ?? "-";
    const rolEl = document.getElementById("fichaRol");
    if (rolEl) rolEl.textContent = perfil?.rol || "Asociado";

    // Sincroniza la foto de perfil con el valor real almacenado en la base de datos
    fotoPerfilActual = perfil?.fotoPerfil || null;
    if (fotoPerfilActual) {
        localStorage.setItem("fotoPerfil", fotoPerfilActual);
    } else {
        localStorage.removeItem("fotoPerfil");
    }
    renderizarAvatarFicha(nombreCompleto);

    // Carga los valores directamente en los campos editables del formulario único
    const setVal = (id, valor) => {
        const el = document.getElementById(id);
        if (el) el.value = valor ?? "";
    };
    setVal("perfilNombres", perfil?.nombres);
    setVal("perfilApellidos", perfil?.apellidos);
    setVal("perfilFechaNacimiento", perfil?.FechaNacimiento);
    setVal("perfilDireccion", perfil?.DireccionResidencia);
    setVal("perfilTelefono", perfil?.telefono);
    setVal("perfilEmail", perfil?.email);

    const selectGenero = document.getElementById("perfilGenero");
    if (selectGenero) {
        selectGenero.value = perfil?.genero || "Otro";
    }

    const selectCiudad = document.getElementById("perfilCiudad");
    if (selectCiudad) {
        const ciudadValor = perfil?.ciudad || "";
        const existe = Array.from(selectCiudad.options).some((opt) => opt.value === ciudadValor);
        if (ciudadValor && !existe) {
            const nuevaOpcion = document.createElement("option");
            nuevaOpcion.value = ciudadValor;
            nuevaOpcion.textContent = ciudadValor;
            selectCiudad.append(nuevaOpcion);
        }
        selectCiudad.value = ciudadValor;
    }
}

// Muestra un aviso temporal en la sección Mis Datos Personales
function mostrarAlertaPerfil(texto, tipo = "success") {
    if (!alertaPerfil) return;
    alertaPerfil.className = `alert alert-${tipo} mb-3`;
    alertaPerfil.textContent = texto;
}

// Consulta la API por GET, sincroniza la vista según el rol (Admin = tabla, Asociado = ficha personal editable)
async function cargarAsociados() {
    try {
        const resultado = await solicitarApiAsociados("GET");
        esAdministrador = (resultado.rol || "").toLowerCase() === "admin";

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
            asociadosLista = Array.isArray(resultado.asociados) ? resultado.asociados : [];
            mostrarAsociados();
        } else if (resultado.perfil) {
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

// Dispara el selector de archivo al pulsar "Subir foto de perfil"
if (btnFichaSubirFoto && fichaInputFoto) {
    btnFichaSubirFoto.addEventListener("click", () => {
        fichaInputFoto.value = "";
        fichaInputFoto.click();
    });

    // Sube la imagen seleccionada automáticamente a ../Modelo/perfilFoto.php
    fichaInputFoto.addEventListener("change", async () => {
        const archivo = fichaInputFoto.files?.[0];
        if (!archivo) return;

        const formData = new FormData();
        formData.append("foto", archivo);

        btnFichaSubirFoto.disabled = true;
        try {
            const respuesta = await fetch("../Modelo/perfilFoto.php", {
                method: "POST",
                credentials: "include",
                body: formData
            });
            const resultado = await respuesta.json();
            if (!respuesta.ok || !resultado.success) {
                throw new Error(resultado.mensaje || "No se pudo subir la foto de perfil");
            }

            fotoPerfilActual = resultado.fotoPerfil;
            localStorage.setItem("fotoPerfil", fotoPerfilActual);
            const nombreActual = fichaNombreCompleto ? fichaNombreCompleto.textContent : "Asociado";
            renderizarAvatarFicha(nombreActual);
            mostrarAlertaPerfil(resultado.mensaje || "Foto de perfil actualizada correctamente.", "success");
        } catch (error) {
            mostrarAlertaPerfil(error.message, "danger");
        } finally {
            btnFichaSubirFoto.disabled = false;
        }
    });
}

// Elimina la foto subida y vuelve automáticamente a la inicial del nombre
if (btnFichaQuitarFoto) {
    btnFichaQuitarFoto.addEventListener("click", async () => {
        btnFichaQuitarFoto.disabled = true;
        try {
            const respuesta = await fetch("../Modelo/perfilFoto.php", {
                method: "DELETE",
                credentials: "include"
            });
            const resultado = await respuesta.json();
            if (!respuesta.ok || !resultado.success) {
                throw new Error(resultado.mensaje || "No se pudo quitar la foto");
            }

            fotoPerfilActual = null;
            localStorage.removeItem("fotoPerfil");
            const nombreActual = fichaNombreCompleto ? fichaNombreCompleto.textContent : "Asociado";
            renderizarAvatarFicha(nombreActual);
            mostrarAlertaPerfil("Foto eliminada. Se muestra la inicial de tu nombre.", "success");
        } catch (error) {
            mostrarAlertaPerfil(error.message, "danger");
        } finally {
            btnFichaQuitarFoto.disabled = false;
        }
    });
}

// Cambia el tono de fondo de la inicial y lo sincroniza con el dashboard
document.querySelectorAll(".btn-tono-ficha").forEach((boton) => {
    boton.addEventListener("click", () => {
        tonoAvatarActual = boton.dataset.tono || "avatar-tono-vino";
        localStorage.setItem("avatarTono", tonoAvatarActual);
        const nombreActual = fichaNombreCompleto ? fichaNombreCompleto.textContent : "Asociado";
        renderizarAvatarFicha(nombreActual);
    });
});

// Guarda los cambios editados directamente en la Ficha del Asociado mediante PUT
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
            mostrarAlertaPerfil(resultado.mensaje || "Tus datos personales se actualizaron correctamente.", "success");
        } catch (error) {
            mostrarAlertaPerfil(error.message, "danger");
        } finally {
            if (btnGuardarPerfil) btnGuardarPerfil.disabled = false;
        }
    });
}

// Obtiene o crea la instancia del modal Bootstrap para crear/editar asociados (Admin)
let modalAsociadoInstancia = null;
function obtenerModalAsociado() {
    if (!modalAsociadoInstancia) {
        const el = document.getElementById("modalAsociadoAdmin");
        if (el && window.bootstrap) {
            modalAsociadoInstancia = new bootstrap.Modal(el);
        }
    }
    return modalAsociadoInstancia;
}

// Muestra una alerta breve encima de la tabla de asociados en la vista Admin
function mostrarAlertaAdminAsociados(texto, tipo = "success") {
    const alerta = document.getElementById("alertaAdminAsociados");
    if (!alerta) return;
    alerta.className = `alert alert-${tipo} mb-3`;
    alerta.textContent = texto;
}

// Restaura el formulario modal a su modo inicial de creación de asociado
function resetearFormularioAsociado() {
    if (!formAsociado) return;
    formAsociado.reset();
    document.getElementById("idAsociado").value = "";
    if (campoRolAsociado) campoRolAsociado.classList.add("d-none");
    if (tituloFormAsociado) {
        tituloFormAsociado.innerHTML = '<i class="bi bi-person-plus me-2"></i>Registro de Asociado';
    }
    if (btnGuardarAsociado) {
        btnGuardarAsociado.textContent = "Guardar Asociado";
    }
}

// Abre el modal limpio en modo creación de un nuevo asociado
function abrirCreacionAsociado() {
    resetearFormularioAsociado();
    if (mensajeAsociado) mensajeAsociado.textContent = "";
    const modal = obtenerModalAsociado();
    if (modal) modal.show();
}

// Llena todos los campos del modal con los datos del asociado seleccionado para editar
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

    // Muestra el selector de rol y cambia el título/botón a modo edición
    if (campoRolAsociado) campoRolAsociado.classList.remove("d-none");
    if (tituloFormAsociado) {
        tituloFormAsociado.innerHTML = '<i class="bi bi-pencil-square me-2"></i>Editar Asociado';
    }
    if (btnGuardarAsociado) {
        btnGuardarAsociado.textContent = "Guardar cambios";
    }
    if (mensajeAsociado) mensajeAsociado.textContent = "";

    const modal = obtenerModalAsociado();
    if (modal) modal.show();
}

// Pide confirmación y envía la petición DELETE para eliminar un asociado
async function eliminarAsociado(asociado) {
    const nombreCompleto = `${asociado.nombres ?? ""} ${asociado.apellidos ?? ""}`.trim();
    const confirmar = window.confirm(`¿Desea eliminar al asociado "${nombreCompleto}" (Doc: ${asociado.documento})?`);
    if (!confirmar) return;

    try {
        const resultado = await solicitarApiAsociados("DELETE", { idAsociado: asociado.idAsociado });
        if (document.getElementById("idAsociado").value === String(asociado.idAsociado)) {
            resetearFormularioAsociado();
        }
        mostrarAlertaAdminAsociados(resultado.mensaje || "Asociado eliminado correctamente.", "success");
        await cargarAsociados();
    } catch (error) {
        alert(error.message);
    }
}

// Botón "+ Nuevo" del encabezado de la tabla de asociados
const btnNuevoAsociadoHeader = document.getElementById("btnNuevoAsociadoHeader");
if (btnNuevoAsociadoHeader) {
    btnNuevoAsociadoHeader.addEventListener("click", () => abrirCreacionAsociado());
}

// Configura el botón Cancelar para limpiar el formulario
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

        if (idAsociado) {
            datos.idAsociado = Number(idAsociado);
            datos.rol = document.getElementById("rol").value;
        }

        if (btnGuardarAsociado) btnGuardarAsociado.disabled = true;
        if (mensajeAsociado) mensajeAsociado.textContent = "";

        try {
            const resultado = await solicitarApiAsociados(idAsociado ? "PUT" : "POST", datos);
            resetearFormularioAsociado();
            const modal = obtenerModalAsociado();
            if (modal) modal.hide();
            mostrarAlertaAdminAsociados(
                resultado.mensaje ||
                    (idAsociado ? "Asociado actualizado correctamente." : "Asociado registrado con éxito."),
                "success"
            );
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
