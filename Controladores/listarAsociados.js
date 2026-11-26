// Referencias a los elementos HTML del módulo Asociados (tabla, contador y formulario)
// Cuerpo de la tabla donde se muestran todos los asociados en la vista Admin
const listaAsociados = document.getElementById("listaAsociados");
// Insignia con el conteo total de asociados registrados
const totalAsociados = document.getElementById("totalAsociados");
// Formulario modal del administrador para registrar o editar asociados
const formAsociado = document.getElementById("formAsociado");
// Elemento de texto para mostrar errores dentro del modal de asociado
const mensajeAsociado = document.getElementById("mensajeAsociado");
// Botón principal de guardado del formulario de asociado (Admin)
const btnGuardarAsociado = document.getElementById("btnGuardarAsociado");
// Botón para cancelar la edición y limpiar el formulario
const btnCancelarEdicion = document.getElementById("cancelarEdicionAsociado");
// Título del modal de asociado que alterna entre creación y edición
const tituloFormAsociado = document.getElementById("tituloFormAsociado");
// Contenedor del campo Rol (se muestra solo al editar un asociado existente)
const campoRolAsociado = document.getElementById("campoRolAsociado");

// Estado local: determina si el usuario es administrador, guarda la lista (Admin) o el perfil propio (Asociado)
// Bandera booleana que indica si el usuario actual es administrador
let esAdministrador = (localStorage.getItem("rol") || "").toLowerCase() === "admin";
// Arreglo en memoria con los asociados cargados (vista Admin)
let asociadosLista = [];
// Objeto en memoria con los datos del perfil del asociado autenticado
let perfilActual = null;
// Ruta actual de la foto de perfil guardada en localStorage o sincronizada desde BD
let fotoPerfilActual = localStorage.getItem("fotoPerfil") || null;
// Clase CSS del tono de fondo del avatar cuando se muestra la inicial del nombre
let tonoAvatarActual = localStorage.getItem("avatarTono") || "avatar-tono-vino";

// Referencias a los elementos de la Ficha del Asociado unificada (foto + edición directa)
// Formulario de edición directa de "Mis Datos Personales" para el asociado
const formEditarPerfil = document.getElementById("formEditarPerfil");
// Botón para guardar los cambios del perfil propio
const btnGuardarPerfil = document.getElementById("btnGuardarPerfil");
// Alerta visual para mostrar resultados o errores al actualizar el perfil
const alertaPerfil = document.getElementById("alertaPerfil");
// Contenedor circular del avatar del asociado en su ficha personal
const fichaAvatarPerfil = document.getElementById("fichaAvatarPerfil");
// Elemento donde se despliega el nombre completo en el encabezado de la ficha
const fichaNombreCompleto = document.getElementById("fichaNombreCompleto");
// Input de tipo file oculto para elegir una nueva foto de perfil
const fichaInputFoto = document.getElementById("fichaInputFoto");
// Botón que dispara el selector de imagen para subir foto de perfil
const btnFichaSubirFoto = document.getElementById("btnFichaSubirFoto");
// Botón para eliminar la foto de perfil actual y volver a la inicial
const btnFichaQuitarFoto = document.getElementById("btnFichaQuitarFoto");
// Contenedor de botones de selección de color de fondo del avatar
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
    // Lee la respuesta como texto para validar si es JSON correcto
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

    // Retorna el objeto JSON procesado
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
    // Sale si no existe la tabla de asociados en el DOM
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
            // Escucha el clic para abrir el modal precargado con los datos del asociado
            botonEditar.addEventListener("click", () => abrirEdicionAsociado(asociado));

            // Botón rojo para eliminar este asociado previa confirmación
            const botonEliminar = document.createElement("button");
            botonEliminar.type = "button";
            botonEliminar.className = "btn btn-sm btn-outline-danger";
            botonEliminar.style.flex = "0 0 auto";
            botonEliminar.style.padding = "4px 8px";
            botonEliminar.innerHTML = '<i class="bi bi-trash"></i>';
            botonEliminar.title = "Eliminar asociado";
            // Escucha el clic para solicitar confirmación y eliminar al asociado
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
    // Remueve cualquier clase de tono previa y aplica el tono activo
    fichaAvatarPerfil.classList.remove("avatar-tono-vino", "avatar-tono-terracota", "avatar-tono-cobre", "avatar-tono-ciruela");
    fichaAvatarPerfil.classList.add(tonoAvatarActual || "avatar-tono-vino");
    // Limpia el contenido previo del círculo de avatar
    fichaAvatarPerfil.replaceChildren();

    if (fotoPerfilActual) {
        // Crea el elemento <img> con marca de tiempo para evitar caché obsoleta
        const img = document.createElement("img");
        img.src = `${fotoPerfilActual}?t=${Date.now()}`;
        img.alt = `Foto de perfil de ${nombreCompleto}`;
        // Si la imagen falla al cargar, muestra la inicial del nombre como respaldo
        img.onerror = () => {
            fichaAvatarPerfil.textContent = obtenerInicialPerfil(nombreCompleto);
        };
        fichaAvatarPerfil.append(img);
    } else {
        // Si no hay foto, coloca la inicial del nombre
        fichaAvatarPerfil.textContent = obtenerInicialPerfil(nombreCompleto);
    }

    // Muestra "Quitar foto" solo si hay foto subida y el selector de color solo si se usa inicial
    if (btnFichaQuitarFoto) {
        btnFichaQuitarFoto.classList.toggle("d-none", !fotoPerfilActual);
    }
    if (fichaSelectorColor) {
        fichaSelectorColor.classList.toggle("d-none", Boolean(fotoPerfilActual));
    }
    // Marca visualmente el botón de tono seleccionado actualmente
    document.querySelectorAll(".btn-tono-ficha").forEach((btn) => {
        btn.classList.toggle("activo", btn.dataset.tono === tonoAvatarActual);
    });
}

// Rellena directamente el encabezado, avatar y todos los campos editables de "Mis Datos Personales"
function mostrarFichaPersonal(perfil) {
    // Almacena el perfil en el estado local
    perfilActual = perfil;
    // Construye el nombre completo uniendo nombres y apellidos
    const nombreCompleto = `${perfil?.nombres ?? ""} ${perfil?.apellidos ?? ""}`.trim() || "Asociado";

    // Actualiza nombre, documento y rol en el encabezado de la ficha
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
    // Dibuja el avatar actualizado
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

    // Asigna el género actual en el selector correspondiente
    const selectGenero = document.getElementById("perfilGenero");
    if (selectGenero) {
        selectGenero.value = perfil?.genero || "Otro";
    }

    // Asigna la ciudad actual; si no existe en las opciones del select, la añade dinámicamente
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
        // Solicita al servidor el listado (si es Admin) o el perfil propio (si es Asociado)
        const resultado = await solicitarApiAsociados("GET");
        // Sincroniza el rol con el valor autenticado en el servidor
        esAdministrador = (resultado.rol || "").toLowerCase() === "admin";

        // Ajusta la visibilidad de la columna de acciones y secciones exclusivas por rol
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

        // Renderiza la tabla de asociados para Admin o la ficha personal para Asociado
        if (esAdministrador) {
            asociadosLista = Array.isArray(resultado.asociados) ? resultado.asociados : [];
            mostrarAsociados();
        } else if (resultado.perfil) {
            mostrarFichaPersonal(resultado.perfil);
        }
    } catch (error) {
        // Registra el fallo y presenta el error en la interfaz según el rol
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
        // Limpia el valor previo para permitir volver a elegir el mismo archivo si se desea
        fichaInputFoto.value = "";
        fichaInputFoto.click();
    });

    // Sube la imagen seleccionada automáticamente a ../Modelo/perfilFoto.php
    fichaInputFoto.addEventListener("change", async () => {
        // Obtiene el archivo elegido del input
        const archivo = fichaInputFoto.files?.[0];
        if (!archivo) return;

        // Empaqueta la imagen en un objeto FormData
        const formData = new FormData();
        formData.append("foto", archivo);

        // Deshabilita el botón mientras se sube la imagen
        btnFichaSubirFoto.disabled = true;
        try {
            // Envía la foto al servidor mediante POST con credenciales de sesión
            const respuesta = await fetch("../Modelo/perfilFoto.php", {
                method: "POST",
                credentials: "include",
                body: formData
            });
            // Lee la respuesta JSON del servidor
            const resultado = await respuesta.json();
            if (!respuesta.ok || !resultado.success) {
                throw new Error(resultado.mensaje || "No se pudo subir la foto de perfil");
            }

            // Actualiza el estado local, localStorage y el avatar en la ficha
            fotoPerfilActual = resultado.fotoPerfil;
            localStorage.setItem("fotoPerfil", fotoPerfilActual);
            const nombreActual = fichaNombreCompleto ? fichaNombreCompleto.textContent : "Asociado";
            renderizarAvatarFicha(nombreActual);
            mostrarAlertaPerfil(resultado.mensaje || "Foto de perfil actualizada correctamente.", "success");
        } catch (error) {
            // Muestra alerta de error si la subida falló
            mostrarAlertaPerfil(error.message, "danger");
        } finally {
            // Rehabilita el botón de subida
            btnFichaSubirFoto.disabled = false;
        }
    });
}

// Elimina la foto subida y vuelve automáticamente a la inicial del nombre
if (btnFichaQuitarFoto) {
    btnFichaQuitarFoto.addEventListener("click", async () => {
        // Deshabilita el botón mientras se procesa la eliminación
        btnFichaQuitarFoto.disabled = true;
        try {
            // Envía la petición DELETE al endpoint de foto de perfil
            const respuesta = await fetch("../Modelo/perfilFoto.php", {
                method: "DELETE",
                credentials: "include"
            });
            const resultado = await respuesta.json();
            if (!respuesta.ok || !resultado.success) {
                throw new Error(resultado.mensaje || "No se pudo quitar la foto");
            }

            // Borra la referencia de la foto y vuelve a dibujar la inicial del nombre
            fotoPerfilActual = null;
            localStorage.removeItem("fotoPerfil");
            const nombreActual = fichaNombreCompleto ? fichaNombreCompleto.textContent : "Asociado";
            renderizarAvatarFicha(nombreActual);
            mostrarAlertaPerfil("Foto eliminada. Se muestra la inicial de tu nombre.", "success");
        } catch (error) {
            mostrarAlertaPerfil(error.message, "danger");
        } finally {
            // Reactiva el botón al finalizar
            btnFichaQuitarFoto.disabled = false;
        }
    });
}

// Cambia el tono de fondo de la inicial y lo sincroniza con el dashboard
document.querySelectorAll(".btn-tono-ficha").forEach((boton) => {
    boton.addEventListener("click", () => {
        // Guarda el nuevo tono elegido en memoria y en localStorage
        tonoAvatarActual = boton.dataset.tono || "avatar-tono-vino";
        localStorage.setItem("avatarTono", tonoAvatarActual);
        const nombreActual = fichaNombreCompleto ? fichaNombreCompleto.textContent : "Asociado";
        // Re-renderiza el avatar con el color recién seleccionado
        renderizarAvatarFicha(nombreActual);
    });
});

// Guarda los cambios editados directamente en la Ficha del Asociado mediante PUT
if (formEditarPerfil) {
    formEditarPerfil.addEventListener("submit", async (evento) => {
        // Evita la recarga de la página al enviar el formulario
        evento.preventDefault();

        // Recopila todos los campos editables de la ficha personal
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

        // Deshabilita el botón mientras se guarda en el servidor
        if (btnGuardarPerfil) btnGuardarPerfil.disabled = true;

        try {
            // Envía la actualización mediante PUT al backend
            const resultado = await solicitarApiAsociados("PUT", datos);
            // Sincroniza el nombre actualizado en localStorage si el servidor lo devuelve
            if (resultado.nombre) {
                localStorage.setItem("nombre", resultado.nombre);
            }
            // Refresca los campos de la ficha con los datos retornados o recargando desde el API
            if (resultado.perfil) {
                mostrarFichaPersonal(resultado.perfil);
            } else {
                await cargarAsociados();
            }
            mostrarAlertaPerfil(resultado.mensaje || "Tus datos personales se actualizaron correctamente.", "success");
        } catch (error) {
            mostrarAlertaPerfil(error.message, "danger");
        } finally {
            // Reactiva el botón de guardado
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
    // Limpia los campos del formulario
    formAsociado.reset();
    // Vacía el ID oculto para volver al modo registro
    document.getElementById("idAsociado").value = "";
    // Oculta el selector de rol (solo visible en edición)
    if (campoRolAsociado) campoRolAsociado.classList.add("d-none");
    // Restaura título y botón al estado de nuevo registro
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

    // Abre el modal precargado
    const modal = obtenerModalAsociado();
    if (modal) modal.show();
}

// Pide confirmación y envía la petición DELETE para eliminar un asociado
async function eliminarAsociado(asociado) {
    // Construye el nombre completo para el mensaje de confirmación
    const nombreCompleto = `${asociado.nombres ?? ""} ${asociado.apellidos ?? ""}`.trim();
    const confirmar = window.confirm(`¿Desea eliminar al asociado "${nombreCompleto}" (Doc: ${asociado.documento})?`);
    if (!confirmar) return;

    try {
        // Envía la solicitud DELETE con el ID del asociado
        const resultado = await solicitarApiAsociados("DELETE", { idAsociado: asociado.idAsociado });
        // Si ese asociado estaba cargado en el formulario, lo resetea
        if (document.getElementById("idAsociado").value === String(asociado.idAsociado)) {
            resetearFormularioAsociado();
        }
        // Muestra alerta de éxito y actualiza el listado
        mostrarAlertaAdminAsociados(resultado.mensaje || "Asociado eliminado correctamente.", "success");
        await cargarAsociados();
    } catch (error) {
        alert(error.message);
    }
}

// Botón "+ Nuevo" del encabezado de la tabla de asociados
const btnNuevoAsociadoHeader = document.getElementById("btnNuevoAsociadoHeader");
if (btnNuevoAsociadoHeader) {
    // Al pulsar abre el modal limpio para registrar un nuevo asociado
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
        // Evita el comportamiento por defecto de envío de formulario
        evento.preventDefault();

        // Obtiene el ID oculto para diferenciar entre creación y edición
        const idAsociado = document.getElementById("idAsociado").value;
        // Construye el objeto con todos los campos del asociado
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

        // Si se trata de una edición, adjunta el ID numérico y el rol asignado
        if (idAsociado) {
            datos.idAsociado = Number(idAsociado);
            datos.rol = document.getElementById("rol").value;
        }

        // Deshabilita el botón y limpia mensajes previos durante el envío
        if (btnGuardarAsociado) btnGuardarAsociado.disabled = true;
        if (mensajeAsociado) mensajeAsociado.textContent = "";

        try {
            // Envía PUT para actualizar o POST para registrar al nuevo asociado
            const resultado = await solicitarApiAsociados(idAsociado ? "PUT" : "POST", datos);
            // Limpia el formulario y cierra el modal
            resetearFormularioAsociado();
            const modal = obtenerModalAsociado();
            if (modal) modal.hide();
            // Muestra confirmación y recarga la tabla de asociados
            mostrarAlertaAdminAsociados(
                resultado.mensaje ||
                    (idAsociado ? "Asociado actualizado correctamente." : "Asociado registrado con éxito."),
                "success"
            );
            await cargarAsociados();
        } catch (error) {
            // Muestra el error dentro del modal o mediante alert
            if (mensajeAsociado) {
                mensajeAsociado.textContent = error.message;
            } else {
                alert(error.message);
            }
        } finally {
            // Vuelve a habilitar el botón de guardado
            if (btnGuardarAsociado) btnGuardarAsociado.disabled = false;
        }
    });
}

// Carga inicial de los asociados al abrir la página
cargarAsociados();
