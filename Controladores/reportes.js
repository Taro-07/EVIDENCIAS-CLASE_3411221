// Referencias a los indicadores KPI, tablas y buscador de la vista de Reportes
const kpiTotalPrestado = document.getElementById("kpiTotalPrestado");
const kpiTotalPagado = document.getElementById("kpiTotalPagado");
const kpiCarteraPendiente = document.getElementById("kpiCarteraPendiente");
const kpiRecaudoActividades = document.getElementById("kpiRecaudoActividades");
const tablaCarteraAsociados = document.getElementById("tablaCarteraAsociados");
const tablaBalanceActividades = document.getElementById("tablaBalanceActividades");
const buscarCartera = document.getElementById("buscarCartera");
const alertaReportes = document.getElementById("alertaReportes");

// Arreglo completo en memoria para filtrar asociados en tiempo real desde el buscador
let carteraCompleta = [];

// Formatea montos en pesos colombianos (COP) sin decimales sobrantes
function formatearMoneda(valor) {
    const numero = Number(valor || 0);
    const esEntero = Number.isInteger(numero);
    return numero.toLocaleString("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: esEntero ? 0 : 2,
        maximumFractionDigits: 2
    });
}

// Crea una celda <td> de texto plano seguro con clase opcional
function crearCelda(texto, clase = "") {
    const td = document.createElement("td");
    if (clase) td.className = clase;
    td.textContent = texto !== null && texto !== undefined && String(texto).trim() !== "" ? String(texto) : "-";
    return td;
}

// Actualiza los 4 KPI superiores con los totales financieros globales
function mostrarResumen(resumen) {
    if (kpiTotalPrestado) kpiTotalPrestado.textContent = formatearMoneda(resumen?.totalPrestado);
    if (kpiTotalPagado) kpiTotalPagado.textContent = formatearMoneda(resumen?.totalPagadoCuotas);
    if (kpiCarteraPendiente) kpiCarteraPendiente.textContent = formatearMoneda(resumen?.carteraPendiente);
    if (kpiRecaudoActividades) kpiRecaudoActividades.textContent = formatearMoneda(resumen?.recaudoActividades);
}

// Dibuja la tabla "Estados de Cuenta y Cartera por Asociado" (con soporte para filtrado por búsqueda)
function mostrarCartera(lista) {
    if (!tablaCarteraAsociados) return;
    tablaCarteraAsociados.replaceChildren();

    if (lista.length === 0) {
        const fila = document.createElement("tr");
        const celda = document.createElement("td");
        celda.colSpan = 8;
        celda.className = "text-center py-4 text-muted";
        celda.textContent = "No se encontraron asociados con ese criterio.";
        fila.append(celda);
        tablaCarteraAsociados.append(fila);
        return;
    }

    lista.forEach((item) => {
        const fila = document.createElement("tr");
        const numCreditos = Number(item.numCreditos || 0);
        const saldo = Number(item.saldoPendiente || 0);

        // Construye la insignia de estado de cartera (Sin Créditos, Saldado o Saldo Pendiente)
        const celdaEstado = document.createElement("td");
        const badge = document.createElement("span");
        if (numCreditos === 0) {
            badge.className = "badge badge-sin-creditos";
            badge.textContent = "Sin Créditos";
        } else if (saldo <= 0) {
            badge.className = "badge badge-cartera-aldia";
            badge.textContent = "Al Día / Saldado";
        } else {
            badge.className = "badge badge-cartera-pendiente";
            badge.textContent = `Saldo Pendiente (${formatearMoneda(saldo)})`;
        }
        celdaEstado.append(badge);

        fila.append(
            crearCelda(item.documento, "fw-bold"),
            crearCelda(item.nombreAsociado),
            crearCelda(item.telefono),
            crearCelda(String(numCreditos), "text-center fw-semibold"),
            crearCelda(formatearMoneda(item.totalPrestado), "fw-semibold"),
            crearCelda(formatearMoneda(item.totalPagado), "fw-semibold text-success"),
            crearCelda(
                formatearMoneda(saldo),
                saldo > 0 ? "fw-bold text-danger" : "text-muted"
            ),
            celdaEstado
        );

        tablaCarteraAsociados.append(fila);
    });
}

// Dibuja la tabla "Balance Histórico de Actividades y Distribución (50% Club / 50% Asociados)"
function mostrarBalanceActividades(lista) {
    if (!tablaBalanceActividades) return;
    tablaBalanceActividades.replaceChildren();

    if (lista.length === 0) {
        const fila = document.createElement("tr");
        const celda = document.createElement("td");
        celda.colSpan = 8;
        celda.className = "text-center py-4 text-muted";
        celda.textContent = "No hay actividades registradas para mostrar en el balance.";
        fila.append(celda);
        tablaBalanceActividades.append(fila);
        return;
    }

    lista.forEach((act) => {
        const fila = document.createElement("tr");

        // Insignia morada con el número de participantes de la actividad
        const celdaParticipantes = document.createElement("td");
        celdaParticipantes.className = "text-center";
        const badgePart = document.createElement("span");
        badgePart.className = "badge badge-participantes";
        badgePart.textContent = String(act.participantes ?? 0);
        celdaParticipantes.append(badgePart);

        fila.append(
            crearCelda(act.nombreActividad, "fw-bold"),
            crearCelda(act.fechaEvento),
            crearCelda(act.municipio),
            crearCelda(formatearMoneda(act.totalRecaudado), "fw-bold"),
            celdaParticipantes,
            crearCelda(formatearMoneda(act.mitadClub), "fw-semibold texto-club-mitad"),
            crearCelda(formatearMoneda(act.mitadDistribuido), "fw-semibold text-success"),
            crearCelda(formatearMoneda(act.gananciaPorAsociado), "fw-bold")
        );

        tablaBalanceActividades.append(fila);
    });
}

// Consulta ../Modelo/gestionarReportes.php y protege el acceso exclusivo para rol Admin
async function cargarReportes() {
    // Si un Asociado intenta entrar por URL directa, lo devuelve al panel principal
    const rolLocal = (localStorage.getItem("rol") || "").toLowerCase();
    if (rolLocal !== "admin") {
        window.location.href = "dashboard.html?v=4";
        return;
    }

    try {
        const respuesta = await fetch("../Modelo/gestionarReportes.php", {
            method: "GET",
            headers: { "Accept": "application/json" },
            credentials: "include"
        });

        const resultado = await respuesta.json();

        if (respuesta.status === 401) {
            localStorage.clear();
            window.location.href = "Login.html";
            return;
        }

        if (respuesta.status === 403) {
            window.location.href = "dashboard.html?v=4";
            return;
        }

        if (!respuesta.ok || !resultado.success) {
            throw new Error(resultado.mensaje || "No fue posible cargar los reportes");
        }

        mostrarResumen(resultado.resumen || {});
        carteraCompleta = Array.isArray(resultado.cartera) ? resultado.cartera : [];
        mostrarCartera(carteraCompleta);
        mostrarBalanceActividades(Array.isArray(resultado.actividades) ? resultado.actividades : []);
    } catch (error) {
        console.error("Error al cargar reportes:", error);
        if (alertaReportes) {
            alertaReportes.textContent = error.message;
            alertaReportes.classList.remove("d-none");
        }
    }
}

// Filtra la tabla de cartera en tiempo real por nombre o número de documento
if (buscarCartera) {
    buscarCartera.addEventListener("input", () => {
        const termino = buscarCartera.value.trim().toLowerCase();
        if (!termino) {
            mostrarCartera(carteraCompleta);
            return;
        }
        const filtrados = carteraCompleta.filter((item) => {
            const nombre = String(item.nombreAsociado || "").toLowerCase();
            const doc = String(item.documento || "").toLowerCase();
            return nombre.includes(termino) || doc.includes(termino);
        });
        mostrarCartera(filtrados);
    });
}

// Ejecuta la carga inicial al abrir Reportes
cargarReportes();
