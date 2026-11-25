// Referencias a los elementos HTML del módulo Préstamos (vista Admin)
const listaPrestamos = document.getElementById("listaPrestamos");
const totalPrestamos = document.getElementById("totalPrestamos");
const formPrestamo = document.getElementById("formPrestamo");
const mensajePrestamo = document.getElementById("mensajePrestamo");
const btnGuardarPrestamo = document.getElementById("btnGuardarPrestamo");
const btnCancelarEdicionPrestamo = document.getElementById("cancelarEdicionPrestamo");
const tituloFormPrestamo = document.getElementById("tituloFormPrestamo");
const cardFormPrestamoAdmin = document.getElementById("cardFormPrestamoAdmin");

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

    // Si la sesión expiró (HTTP 401), limpia localStorage y vuelve al Login
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

// Dibuja todas las solicitudes de préstamo en la tabla HTML de administración
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

        fila.append(
            crearCelda(indice + 1, "fw-bold text-muted"),
            crearCelda(prestamo.documento, "fw-semibold"),
            crearCelda(prestamo.nombreAsociado),
            crearCelda(formatearMoneda(prestamo.ValorPrestamo), "fw-bold texto-monto-admin"),
            celdaPlazo,
            crearCelda(tasaTexto, "fw-medium"),
            crearCelda(prestamo.FechaPrestamo, "text-nowrap"),
            crearCelda(prestamo.Proposito)
        );

        const acciones = document.createElement("td");
        acciones.className = "text-nowrap text-center";

        const botonEditar = document.createElement("button");
        botonEditar.type = "button";
        botonEditar.className = "btn btn-sm btn-outline-primary me-1";
        botonEditar.style.flex = "0 0 auto";
        botonEditar.style.padding = "4px 8px";
        botonEditar.innerHTML = '<i class="bi bi-pencil"></i>';
        botonEditar.title = "Editar préstamo";
        botonEditar.addEventListener("click", () => abrirEdicionPrestamo(prestamo));

        const botonEliminar = document.createElement("button");
        botonEliminar.type = "button";
        botonEliminar.className = "btn btn-sm btn-outline-danger";
        botonEliminar.style.flex = "0 0 auto";
        botonEliminar.style.padding = "4px 8px";
        botonEliminar.innerHTML = '<i class="bi bi-trash"></i>';
        botonEliminar.title = "Eliminar préstamo";
        botonEliminar.addEventListener("click", () => eliminarPrestamo(prestamo));

        acciones.append(botonEditar, botonEliminar);
        fila.append(acciones);
        listaPrestamos.append(fila);
    });
}

// Dibuja la tabla "Historial de Créditos" para el rol Asociado (ID, Asociado, Valor, Tasa, Cuotas, Fecha, Acciones)
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

        // Columnas con la estructura exacta del Historial de Créditos
        fila.append(
            crearCelda(`#${prestamo.idPrestamos}`, "fw-bold"),
            crearCelda(prestamo.nombreAsociado),
            crearCelda(formatearMoneda(prestamo.ValorPrestamo), "fw-semibold"),
            crearCelda(tasaTexto),
            crearCelda(prestamo.NumeroCuotas),
            crearCelda(prestamo.FechaPrestamo)
        );

        // Botón para eliminar el crédito propio del asociado
        const celdaAcciones = document.createElement("td");
        celdaAcciones.className = "text-center";

        const botonEliminar = document.createElement("button");
        botonEliminar.type = "button";
        botonEliminar.className = "btn btn-sm btn-eliminar-credito";
        botonEliminar.innerHTML = '<i class="bi bi-trash"></i>';
        botonEliminar.title = "Eliminar préstamo";
        botonEliminar.addEventListener("click", () => eliminarPrestamo(prestamo));

        celdaAcciones.append(botonEliminar);
        fila.append(celdaAcciones);
        listaPrestamosAsociado.append(fila);
    });
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

        // Sincroniza los bloques exclusivos de Admin y de Asociado con el rol real de la sesión
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

// Limpia el formulario superior de Admin y lo devuelve al modo de nueva solicitud
function resetearFormularioPrestamo() {
    if (!formPrestamo) return;
    formPrestamo.reset();
    document.getElementById("idPrestamos").value = "";
    if (cardFormPrestamoAdmin) cardFormPrestamoAdmin.classList.remove("modo-edicion-card");
    if (btnCancelarEdicionPrestamo) btnCancelarEdicionPrestamo.classList.add("d-none");
    if (tituloFormPrestamo) {
        tituloFormPrestamo.innerHTML = '<i class="bi bi-cash-stack me-2"></i>Solicitud de Préstamo';
    }
    if (btnGuardarPrestamo) {
        btnGuardarPrestamo.textContent = "Solicitar Préstamo";
    }
    document.querySelectorAll("#listaPrestamos tr.fila-editando").forEach((tr) => tr.classList.remove("fila-editando"));
}

// Carga los datos de un préstamo en el formulario izquierdo de Admin para editarlo individualmente
function abrirEdicionPrestamo(prestamo) {
    if (!formPrestamo) return;
    formPrestamo.reset();

    document.getElementById("idPrestamos").value = prestamo.idPrestamos;
    document.getElementById("documento").value = prestamo.documento ?? "";
    document.getElementById("ValorPrestamo").value =
        prestamo.ValorPrestamo !== null && prestamo.ValorPrestamo !== undefined
            ? Number(prestamo.ValorPrestamo)
            : "";
    document.getElementById("NumeroCuotas").value = prestamo.NumeroCuotas ?? "";
    document.getElementById("TasaInteres").value =
        prestamo.TasaInteres !== null && prestamo.TasaInteres !== undefined
            ? Number(prestamo.TasaInteres)
            : "";
    document.getElementById("FechaPrestamo").value = prestamo.FechaPrestamo ?? "";
    document.getElementById("Proposito").value = prestamo.Proposito ?? "";

    if (cardFormPrestamoAdmin) cardFormPrestamoAdmin.classList.add("modo-edicion-card");
    if (btnCancelarEdicionPrestamo) btnCancelarEdicionPrestamo.classList.remove("d-none");
    if (tituloFormPrestamo) {
        tituloFormPrestamo.innerHTML = `<i class="bi bi-pencil-square me-2"></i>Editando Préstamo #${prestamo.idPrestamos}`;
    }
    if (btnGuardarPrestamo) {
        btnGuardarPrestamo.textContent = "Guardar cambios";
    }
    if (mensajePrestamo) {
        mensajePrestamo.textContent = `Editando el préstamo #${prestamo.idPrestamos}. Modifica los campos y pulsa "Guardar cambios".`;
    }

    const inputMonto = document.getElementById("ValorPrestamo");
    if (inputMonto) inputMonto.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// Elimina un préstamo (y sus cuotas asociadas si las tuviera) tras confirmación del usuario
async function eliminarPrestamo(prestamo) {
    const confirmar = window.confirm(
        `¿Desea eliminar el préstamo #${prestamo.idPrestamos} de ${formatearMoneda(prestamo.ValorPrestamo)}?\nSi tiene pagos de cuotas registrados, también se eliminarán.`
    );
    if (!confirmar) return;

    try {
        const resultado = await solicitarApiPrestamos("DELETE", { idPrestamos: prestamo.idPrestamos });
        if (esAdministrador && document.getElementById("idPrestamos")?.value === String(prestamo.idPrestamos)) {
            resetearFormularioPrestamo();
        }
        const destinoMensaje = esAdministrador ? mensajePrestamo : mensajePrestamoAsociado;
        if (destinoMensaje) {
            destinoMensaje.textContent = resultado.mensaje || "Préstamo eliminado correctamente.";
        }
        await cargarPrestamos();
    } catch (error) {
        const destinoMensaje = esAdministrador ? mensajePrestamo : mensajePrestamoAsociado;
        if (destinoMensaje) {
            destinoMensaje.textContent = error.message;
        }
        alert(error.message);
    }
}

// Botón Cancelar de la vista Admin
if (btnCancelarEdicionPrestamo) {
    btnCancelarEdicionPrestamo.addEventListener("click", () => {
        resetearFormularioPrestamo();
        if (mensajePrestamo) mensajePrestamo.textContent = "";
    });
}

// Envío del formulario de administración (POST para crear o PUT para editar)
if (formPrestamo) {
    formPrestamo.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        const idPrestamos = document.getElementById("idPrestamos").value;
        const datos = {
            documento: document.getElementById("documento").value.trim(),
            ValorPrestamo: Number(document.getElementById("ValorPrestamo").value),
            NumeroCuotas: Number(document.getElementById("NumeroCuotas").value),
            TasaInteres: Number(document.getElementById("TasaInteres").value),
            FechaPrestamo: document.getElementById("FechaPrestamo").value,
            Proposito: document.getElementById("Proposito").value.trim()
        };

        if (idPrestamos) {
            datos.idPrestamos = Number(idPrestamos);
        }

        if (btnGuardarPrestamo) btnGuardarPrestamo.disabled = true;
        if (mensajePrestamo) mensajePrestamo.textContent = "";

        try {
            const resultado = await solicitarApiPrestamos(idPrestamos ? "PUT" : "POST", datos);
            resetearFormularioPrestamo();
            if (mensajePrestamo) {
                mensajePrestamo.textContent =
                    resultado.mensaje ||
                    (idPrestamos
                        ? "Préstamo actualizado correctamente."
                        : "Solicitud de préstamo registrada con éxito.");
            }
            await cargarPrestamos();
        } catch (error) {
            if (mensajePrestamo) {
                mensajePrestamo.textContent = error.message;
            } else {
                alert(error.message);
            }
        } finally {
            if (btnGuardarPrestamo) btnGuardarPrestamo.disabled = false;
        }
    });
}

// Envío del formulario "Solicitar / Registrar Préstamo" de la vista Asociado (POST)
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
            if (mensajePrestamoAsociado) {
                mensajePrestamoAsociado.textContent =
                    resultado.mensaje || "Solicitud de préstamo registrada con éxito.";
            }
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

// Ejecuta la carga inicial al abrir la vista de Préstamos
cargarPrestamos();
