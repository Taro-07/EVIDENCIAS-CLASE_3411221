// Estado en memoria del saldo actual de la billetera para validaciones y atajos
let saldoActualBilletera = 0;

// Formatea valores numéricos en pesos colombianos (COP) sin decimales innecesarios
function formatearMonedaBilletera(valor) {
    const numero = Number(valor || 0);
    const esEntero = Number.isInteger(numero);
    return numero.toLocaleString("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: esEntero ? 0 : 2,
        maximumFractionDigits: 2
    });
}

// Formatea fecha y hora de un movimiento (YYYY-MM-DD HH:MM:SS) de forma legible
function formatearFechaMovimiento(fechaTexto) {
    if (!fechaTexto) return "-";
    const fecha = new Date(String(fechaTexto).replace(" ", "T"));
    if (Number.isNaN(fecha.getTime())) return String(fechaTexto);
    return fecha.toLocaleString("es-CO", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}

// Actualiza los indicadores principales y la tabla de historial con los datos recibidos del servidor
function renderizarBilletera(datos) {
    saldoActualBilletera = Number(datos.saldoBilletera || 0);

    const elSaldo = document.getElementById("saldoTotalBilletera");
    const elTitular = document.getElementById("titularBilletera");
    const elRecargado = document.getElementById("totalRecargadoBilletera");
    const elRetirado = document.getElementById("totalRetiradoBilletera");
    const elContador = document.getElementById("contadorMovimientosBilletera");
    const contenedor = document.getElementById("contenedorMovimientosBilletera");

    if (elSaldo) elSaldo.textContent = formatearMonedaBilletera(saldoActualBilletera);
    if (elTitular && datos.nombre) elTitular.textContent = datos.nombre;
    if (elRecargado) elRecargado.textContent = formatearMonedaBilletera(datos.totalRecargado || 0);
    if (elRetirado) elRetirado.textContent = formatearMonedaBilletera(datos.totalRetirado || 0);

    const movimientos = Array.isArray(datos.movimientos) ? datos.movimientos : [];
    const totalMov = Number(datos.cantidadMovimientos ?? movimientos.length);
    if (elContador) {
        elContador.textContent = `${totalMov} MOVIMIENTO${totalMov === 1 ? "" : "S"}`;
    }

    if (!contenedor) return;

    if (movimientos.length === 0) {
        contenedor.innerHTML = `
            <div class="estado-vacio-reciente">
                <i class="bi bi-wallet2"></i>
                <h6 class="fw-bold mb-1" style="color: #5c1d22;">Aún no tienes movimientos registrados</h6>
                <p class="small text-muted mb-0">Usa el formulario de arriba para añadir dinero a tu billetera o realizar retiros.</p>
            </div>`;
        return;
    }

    const wrap = document.createElement("div");
    wrap.className = "table-responsive";
    const tabla = document.createElement("table");
    tabla.className = "table table-hover align-middle mb-0";
    tabla.innerHTML = `
        <thead>
            <tr style="background-color: #f6e9df; color: #5c1d22;">
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Entidad Bancaria</th>
                <th class="text-end">Monto</th>
                <th class="text-end">Saldo Resultante</th>
            </tr>
        </thead>
        <tbody></tbody>`;

    const tbody = tabla.querySelector("tbody");
    movimientos.forEach((mov) => {
        const esRecarga = String(mov.tipo).toLowerCase() === "recarga";
        const tr = document.createElement("tr");

        const tdFecha = document.createElement("td");
        tdFecha.className = "text-nowrap";
        tdFecha.textContent = formatearFechaMovimiento(mov.fechaMovimiento);

        const tdTipo = document.createElement("td");
        const badge = document.createElement("span");
        badge.className = esRecarga ? "badge-mov-recarga" : "badge-mov-retiro";
        badge.innerHTML = esRecarga
            ? '<i class="bi bi-arrow-down-left me-1"></i>Recarga'
            : '<i class="bi bi-arrow-up-right me-1"></i>Retiro';
        tdTipo.append(badge);

        const tdDesc = document.createElement("td");
        tdDesc.textContent = mov.descripcion || (esRecarga ? "Recarga a billetera" : "Retiro desde billetera");

        const tdMonto = document.createElement("td");
        tdMonto.className = "text-end fw-bold text-nowrap";
        tdMonto.style.color = esRecarga ? "#198754" : "#a82832";
        tdMonto.textContent = `${esRecarga ? "+" : "-"} ${formatearMonedaBilletera(mov.monto)}`;

        const tdSaldo = document.createElement("td");
        tdSaldo.className = "text-end fw-semibold text-nowrap";
        tdSaldo.style.color = "#5c1d22";
        tdSaldo.textContent = formatearMonedaBilletera(mov.saldoResultante);

        tr.append(tdFecha, tdTipo, tdDesc, tdMonto, tdSaldo);
        tbody.append(tr);
    });

    wrap.append(tabla);
    contenedor.replaceChildren(wrap);
}

// Consulta el saldo e historial actual desde ../Modelo/gestionarBilletera.php
async function cargarBilletera() {
    try {
        const respuesta = await fetch("../Modelo/gestionarBilletera.php", {
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

        if (!respuesta.ok || !resultado.success) {
            throw new Error(resultado.mensaje || "No se pudo consultar la billetera");
        }

        renderizarBilletera(resultado);
    } catch (error) {
        console.error("Error al cargar billetera:", error);
        const contenedor = document.getElementById("contenedorMovimientosBilletera");
        if (contenedor) {
            contenedor.innerHTML = `<p class="text-danger text-center mb-0 py-3">${error.message}</p>`;
        }
    }
}

// Envía una recarga o un retiro al servidor y refresca la vista
async function enviarMovimientoBilletera(tipo, monto, descripcion, boton, elementoMensaje, formulario) {
    if (!Number.isFinite(monto) || monto <= 0) {
        if (elementoMensaje) {
            elementoMensaje.style.color = "#b91c1c";
            elementoMensaje.textContent = "Ingresa un monto válido mayor a cero.";
        }
        return;
    }

    if (tipo === "retiro" && monto > saldoActualBilletera) {
        if (elementoMensaje) {
            elementoMensaje.style.color = "#b91c1c";
            elementoMensaje.textContent = "Saldo insuficiente en tu billetera para realizar este retiro.";
        }
        return;
    }

    if (boton) boton.disabled = true;
    if (elementoMensaje) {
        elementoMensaje.style.color = "#7c5c50";
        elementoMensaje.textContent = tipo === "recarga" ? "Procesando recarga..." : "Procesando retiro...";
    }

    try {
        const respuesta = await fetch("../Modelo/gestionarBilletera.php", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({ tipo, monto, descripcion })
        });
        const resultado = await respuesta.json();

        if (respuesta.status === 401) {
            localStorage.clear();
            window.location.href = "Login.html";
            return;
        }

        if (!respuesta.ok || !resultado.success) {
            throw new Error(resultado.mensaje || "No se pudo procesar el movimiento");
        }

        if (formulario) formulario.reset();
        renderizarBilletera(resultado);

        if (elementoMensaje) {
            elementoMensaje.style.color = "#198754";
            elementoMensaje.textContent = resultado.mensaje || "Movimiento registrado correctamente.";
        }
    } catch (error) {
        if (elementoMensaje) {
            elementoMensaje.style.color = "#b91c1c";
            elementoMensaje.textContent = error.message;
        }
    } finally {
        if (boton) boton.disabled = false;
    }
}

// Estado de la operación pendiente de confirmación en la alerta emergente
let movimientoPendienteConfirmacion = null;
let modalConfirmarBilleteraInstancia = null;

function obtenerModalConfirmarBilletera() {
    if (!modalConfirmarBilleteraInstancia) {
        const el = document.getElementById("modalConfirmarBilletera");
        if (el && window.bootstrap) {
            modalConfirmarBilleteraInstancia = new bootstrap.Modal(el);
        }
    }
    return modalConfirmarBilleteraInstancia;
}

// Valida la solicitud y abre la alerta emergente para confirmar antes de ejecutar la recarga o retiro
function abrirAlertaConfirmacion({ tipo, monto, banco, boton, elementoMensaje, formulario }) {
    if (!Number.isFinite(monto) || monto <= 0) {
        if (elementoMensaje) {
            elementoMensaje.style.color = "#b91c1c";
            elementoMensaje.textContent = "Ingresa un monto válido mayor a cero.";
        }
        return;
    }

    if (!banco) {
        if (elementoMensaje) {
            elementoMensaje.style.color = "#b91c1c";
            elementoMensaje.textContent = "Selecciona una entidad bancaria nacional.";
        }
        return;
    }

    if (tipo === "retiro" && monto > saldoActualBilletera) {
        if (elementoMensaje) {
            elementoMensaje.style.color = "#b91c1c";
            elementoMensaje.textContent = "Saldo insuficiente en tu billetera para realizar este retiro.";
        }
        return;
    }

    if (elementoMensaje) elementoMensaje.textContent = "";

    const esRecarga = tipo === "recarga";
    const saldoEstimado = esRecarga
        ? Math.round((saldoActualBilletera + monto) * 100) / 100
        : Math.round((saldoActualBilletera - monto) * 100) / 100;

    const texto = document.getElementById("textoConfirmacionBilletera");
    if (texto) {
        texto.textContent = esRecarga
            ? `¿Confirmas la solicitud para añadir dinero a tu billetera desde ${banco}?`
            : `¿Confirmas la solicitud para retirar dinero de tu billetera hacia ${banco}?`;
    }

    const resumen = document.getElementById("resumenConfirmacionBilletera");
    if (resumen) {
        resumen.innerHTML = `
            <div class="d-flex justify-content-between py-1">
                <span>Operación:</span>
                <strong>${esRecarga ? "Añadir dinero / Recarga" : "Retiro de dinero"}</strong>
            </div>
            <div class="d-flex justify-content-between py-1">
                <span>${esRecarga ? "Entidad de origen:" : "Entidad de destino:"}</span>
                <strong>${banco}</strong>
            </div>
            <div class="d-flex justify-content-between py-1">
                <span>Monto:</span>
                <strong style="color: ${esRecarga ? "#198754" : "#a82832"};">${esRecarga ? "+" : "-"} ${formatearMonedaBilletera(monto)}</strong>
            </div>
            <div class="d-flex justify-content-between pt-2 mt-1 border-top">
                <span>Saldo resultante estimado:</span>
                <strong style="color: #5c1d22;">${formatearMonedaBilletera(saldoEstimado)}</strong>
            </div>`;
    }

    const descripcion = esRecarga ? `Recarga desde ${banco}` : `Retiro hacia ${banco}`;
    movimientoPendienteConfirmacion = { tipo, monto, descripcion, boton, elementoMensaje, formulario };

    const modal = obtenerModalConfirmarBilletera();
    if (modal) modal.show();
}

// Inicializa los eventos de formularios, chips de montos rápidos, confirmación y carga inicial
document.addEventListener("DOMContentLoaded", () => {
    const formRecarga = document.getElementById("formRecargarBilletera");
    const inputMontoRecarga = document.getElementById("montoRecarga");
    const selectBancoRecarga = document.getElementById("bancoRecarga");
    const btnRecarga = document.getElementById("btnRecargarBilletera");
    const msgRecarga = document.getElementById("msgRecarga");

    const formRetiro = document.getElementById("formRetirarBilletera");
    const inputMontoRetiro = document.getElementById("montoRetiro");
    const selectBancoRetiro = document.getElementById("bancoRetiro");
    const btnRetiro = document.getElementById("btnRetirarBilletera");
    const msgRetiro = document.getElementById("msgRetiro");

    const btnConfirmarModal = document.getElementById("btnConfirmarMovimientoModal");

    // Chips de montos rápidos para recarga
    document.querySelectorAll("[data-monto-rapido]").forEach((chip) => {
        chip.addEventListener("click", () => {
            const valor = Number(chip.dataset.montoRapido || 0);
            if (inputMontoRecarga && valor > 0) {
                inputMontoRecarga.value = String(valor);
                inputMontoRecarga.focus();
            }
        });
    });

    // Atajos de porcentaje (25%, 50%, 100%) para retiro según el saldo actual
    document.querySelectorAll("[data-porcentaje-retiro]").forEach((chip) => {
        chip.addEventListener("click", () => {
            const factor = Number(chip.dataset.porcentajeRetiro || 0);
            if (!inputMontoRetiro) return;
            if (saldoActualBilletera <= 0) {
                if (msgRetiro) {
                    msgRetiro.style.color = "#b91c1c";
                    msgRetiro.textContent = "No tienes saldo disponible en tu billetera para retirar.";
                }
                return;
            }
            const montoCalculado = Math.round(saldoActualBilletera * factor * 100) / 100;
            inputMontoRetiro.value = String(montoCalculado);
            if (msgRetiro) msgRetiro.textContent = "";
            inputMontoRetiro.focus();
        });
    });

    // Al pulsar "Añadir dinero", abre la alerta emergente de confirmación
    if (formRecarga) {
        formRecarga.addEventListener("submit", (e) => {
            e.preventDefault();
            abrirAlertaConfirmacion({
                tipo: "recarga",
                monto: Number(inputMontoRecarga?.value || 0),
                banco: (selectBancoRecarga?.value || "").trim(),
                boton: btnRecarga,
                elementoMensaje: msgRecarga,
                formulario: formRecarga
            });
        });
    }

    // Al pulsar "Retirar dinero", abre la alerta emergente de confirmación
    if (formRetiro) {
        formRetiro.addEventListener("submit", (e) => {
            e.preventDefault();
            abrirAlertaConfirmacion({
                tipo: "retiro",
                monto: Number(inputMontoRetiro?.value || 0),
                banco: (selectBancoRetiro?.value || "").trim(),
                boton: btnRetiro,
                elementoMensaje: msgRetiro,
                formulario: formRetiro
            });
        });
    }

    // Ejecuta la recarga o retiro únicamente cuando el usuario confirma en la alerta emergente
    if (btnConfirmarModal) {
        btnConfirmarModal.addEventListener("click", async () => {
            if (!movimientoPendienteConfirmacion) return;
            const datos = movimientoPendienteConfirmacion;
            movimientoPendienteConfirmacion = null;

            btnConfirmarModal.disabled = true;
            const modal = obtenerModalConfirmarBilletera();
            if (modal) modal.hide();

            try {
                await enviarMovimientoBilletera(
                    datos.tipo,
                    datos.monto,
                    datos.descripcion,
                    datos.boton,
                    datos.elementoMensaje,
                    datos.formulario
                );
            } finally {
                btnConfirmarModal.disabled = false;
            }
        });
    }

    cargarBilletera();
});
