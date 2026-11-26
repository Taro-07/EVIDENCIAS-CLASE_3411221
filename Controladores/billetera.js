// Estado en memoria del saldo actual de la billetera para validaciones y atajos
let saldoActualBilletera = 0;

// Formatea valores numéricos en pesos colombianos (COP) sin decimales innecesarios
function formatearMonedaBilletera(valor) {
    // Convierte el valor recibido a número usando 0 si está vacío
    const numero = Number(valor || 0);
    // Verifica si la cifra es entera para evitar decimales ".00"
    const esEntero = Number.isInteger(numero);
    // Retorna la cifra con formato monetario colombiano (COP)
    return numero.toLocaleString("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: esEntero ? 0 : 2,
        maximumFractionDigits: 2
    });
}

// Formatea fecha y hora de un movimiento (YYYY-MM-DD HH:MM:SS) de forma legible
function formatearFechaMovimiento(fechaTexto) {
    // Si no hay fecha registrada, devuelve un guion
    if (!fechaTexto) return "-";
    // Convierte el espacio a "T" para que el constructor Date interprete el formato ISO
    const fecha = new Date(String(fechaTexto).replace(" ", "T"));
    // Si la fecha resulta inválida, muestra el texto original sin alterar
    if (Number.isNaN(fecha.getTime())) return String(fechaTexto);
    // Formatea fecha y hora en formato local colombiano
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
    // Actualiza el saldo en memoria con el valor devuelto por el backend
    saldoActualBilletera = Number(datos.saldoBilletera || 0);

    // Referencias a los elementos del resumen superior y contenedor de movimientos
    const elSaldo = document.getElementById("saldoTotalBilletera");
    const elTitular = document.getElementById("titularBilletera");
    const elRecargado = document.getElementById("totalRecargadoBilletera");
    const elRetirado = document.getElementById("totalRetiradoBilletera");
    const elContador = document.getElementById("contadorMovimientosBilletera");
    const contenedor = document.getElementById("contenedorMovimientosBilletera");

    // Actualiza saldo total, nombre del titular, total recargado y total retirado en el DOM
    if (elSaldo) elSaldo.textContent = formatearMonedaBilletera(saldoActualBilletera);
    if (elTitular && datos.nombre) elTitular.textContent = datos.nombre;
    if (elRecargado) elRecargado.textContent = formatearMonedaBilletera(datos.totalRecargado || 0);
    if (elRetirado) elRetirado.textContent = formatearMonedaBilletera(datos.totalRetirado || 0);

    // Obtiene el arreglo de movimientos y calcula el texto del contador en singular o plural
    const movimientos = Array.isArray(datos.movimientos) ? datos.movimientos : [];
    const totalMov = Number(datos.cantidadMovimientos ?? movimientos.length);
    if (elContador) {
        elContador.textContent = `${totalMov} MOVIMIENTO${totalMov === 1 ? "" : "S"}`;
    }

    // Sale si no existe el contenedor de historial en la página
    if (!contenedor) return;

    // Si no existen movimientos, muestra el estado vacío con indicaciones al usuario
    if (movimientos.length === 0) {
        contenedor.innerHTML = `
            <div class="estado-vacio-reciente">
                <i class="bi bi-wallet2"></i>
                <h6 class="fw-bold mb-1" style="color: #5c1d22;">Aún no tienes movimientos registrados</h6>
                <p class="small text-muted mb-0">Usa el formulario de arriba para añadir dinero a tu billetera o realizar retiros.</p>
            </div>`;
        return;
    }

    // Construye el contenedor responsivo y la estructura base de la tabla de historial
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

    // Obtiene el tbody de la tabla recién creada para poblar cada movimiento
    const tbody = tabla.querySelector("tbody");
    movimientos.forEach((mov) => {
        // Determina si el movimiento corresponde a una recarga o a un retiro
        const esRecarga = String(mov.tipo).toLowerCase() === "recarga";
        const tr = document.createElement("tr");

        // Celda con la fecha y hora formateadas del movimiento
        const tdFecha = document.createElement("td");
        tdFecha.className = "text-nowrap";
        tdFecha.textContent = formatearFechaMovimiento(mov.fechaMovimiento);

        // Celda con la insignia visual del tipo de operación (Recarga o Retiro)
        const tdTipo = document.createElement("td");
        const badge = document.createElement("span");
        badge.className = esRecarga ? "badge-mov-recarga" : "badge-mov-retiro";
        badge.innerHTML = esRecarga
            ? '<i class="bi bi-arrow-down-left me-1"></i>Recarga'
            : '<i class="bi bi-arrow-up-right me-1"></i>Retiro';
        tdTipo.append(badge);

        // Celda con la descripción o entidad bancaria asociada al movimiento
        const tdDesc = document.createElement("td");
        tdDesc.textContent = mov.descripcion || (esRecarga ? "Recarga a billetera" : "Retiro desde billetera");

        // Celda con el monto coloreado en verde (+ recarga) o rojo (- retiro)
        const tdMonto = document.createElement("td");
        tdMonto.className = "text-end fw-bold text-nowrap";
        tdMonto.style.color = esRecarga ? "#198754" : "#a82832";
        tdMonto.textContent = `${esRecarga ? "+" : "-"} ${formatearMonedaBilletera(mov.monto)}`;

        // Celda con el saldo resultante después de aplicar el movimiento
        const tdSaldo = document.createElement("td");
        tdSaldo.className = "text-end fw-semibold text-nowrap";
        tdSaldo.style.color = "#5c1d22";
        tdSaldo.textContent = formatearMonedaBilletera(mov.saldoResultante);

        // Agrega las 5 celdas a la fila y la inserta en el tbody
        tr.append(tdFecha, tdTipo, tdDesc, tdMonto, tdSaldo);
        tbody.append(tr);
    });

    // Inserta la tabla completa reemplazando el contenido anterior del contenedor
    wrap.append(tabla);
    contenedor.replaceChildren(wrap);
}

// Consulta el saldo e historial actual desde ../Modelo/gestionarBilletera.php
async function cargarBilletera() {
    try {
        // Realiza la petición GET autenticada con cookie de sesión
        const respuesta = await fetch("../Modelo/gestionarBilletera.php", {
            method: "GET",
            headers: { "Accept": "application/json" },
            credentials: "include"
        });
        // Parsea la respuesta JSON
        const resultado = await respuesta.json();

        // Si la sesión expiró (HTTP 401), limpia localStorage y redirige al Login
        if (respuesta.status === 401) {
            localStorage.clear();
            window.location.href = "Login.html";
            return;
        }

        // Valida que la respuesta sea exitosa
        if (!respuesta.ok || !resultado.success) {
            throw new Error(resultado.mensaje || "No se pudo consultar la billetera");
        }

        // Renderiza el saldo, totales y tabla de movimientos
        renderizarBilletera(resultado);
    } catch (error) {
        // Muestra el error en consola y dentro del contenedor de movimientos
        console.error("Error al cargar billetera:", error);
        const contenedor = document.getElementById("contenedorMovimientosBilletera");
        if (contenedor) {
            contenedor.innerHTML = `<p class="text-danger text-center mb-0 py-3">${error.message}</p>`;
        }
    }
}

// Envía una recarga o un retiro al servidor y refresca la vista
async function enviarMovimientoBilletera(tipo, monto, descripcion, boton, elementoMensaje, formulario) {
    // Valida que el monto sea un número finito y mayor a cero
    if (!Number.isFinite(monto) || monto <= 0) {
        if (elementoMensaje) {
            elementoMensaje.style.color = "#b91c1c";
            elementoMensaje.textContent = "Ingresa un monto válido mayor a cero.";
        }
        return;
    }

    // Valida que el monto del retiro no supere el saldo actual disponible
    if (tipo === "retiro" && monto > saldoActualBilletera) {
        if (elementoMensaje) {
            elementoMensaje.style.color = "#b91c1c";
            elementoMensaje.textContent = "Saldo insuficiente en tu billetera para realizar este retiro.";
        }
        return;
    }

    // Deshabilita el botón y muestra estado de procesamiento mientras responde el servidor
    if (boton) boton.disabled = true;
    if (elementoMensaje) {
        elementoMensaje.style.color = "#7c5c50";
        elementoMensaje.textContent = tipo === "recarga" ? "Procesando recarga..." : "Procesando retiro...";
    }

    try {
        // Envía el movimiento (recarga o retiro) mediante POST JSON a gestionarBilletera.php
        const respuesta = await fetch("../Modelo/gestionarBilletera.php", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({ tipo, monto, descripcion })
        });
        // Parsea la respuesta del servidor
        const resultado = await respuesta.json();

        // Redirige al Login si la sesión expiró
        if (respuesta.status === 401) {
            localStorage.clear();
            window.location.href = "Login.html";
            return;
        }

        // Lanza excepción si hubo error HTTP o lógico
        if (!respuesta.ok || !resultado.success) {
            throw new Error(resultado.mensaje || "No se pudo procesar el movimiento");
        }

        // Limpia el formulario y actualiza toda la billetera con la nueva respuesta
        if (formulario) formulario.reset();
        renderizarBilletera(resultado);

        // Muestra el mensaje de éxito en color verde
        if (elementoMensaje) {
            elementoMensaje.style.color = "#198754";
            elementoMensaje.textContent = resultado.mensaje || "Movimiento registrado correctamente.";
        }
    } catch (error) {
        // Muestra el error en color rojo
        if (elementoMensaje) {
            elementoMensaje.style.color = "#b91c1c";
            elementoMensaje.textContent = error.message;
        }
    } finally {
        // Reactiva el botón al finalizar la operación
        if (boton) boton.disabled = false;
    }
}

// Estado de la operación pendiente de confirmación en la alerta emergente
let movimientoPendienteConfirmacion = null;
// Instancia reutilizable del modal Bootstrap de confirmación
let modalConfirmarBilleteraInstancia = null;

// Obtiene o crea la instancia del modal de confirmación de billetera
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
    // Valida que el monto sea positivo y numérico
    if (!Number.isFinite(monto) || monto <= 0) {
        if (elementoMensaje) {
            elementoMensaje.style.color = "#b91c1c";
            elementoMensaje.textContent = "Ingresa un monto válido mayor a cero.";
        }
        return;
    }

    // Valida que el usuario haya seleccionado una entidad bancaria
    if (!banco) {
        if (elementoMensaje) {
            elementoMensaje.style.color = "#b91c1c";
            elementoMensaje.textContent = "Selecciona una entidad bancaria nacional.";
        }
        return;
    }

    // Valida que el saldo sea suficiente cuando la operación es un retiro
    if (tipo === "retiro" && monto > saldoActualBilletera) {
        if (elementoMensaje) {
            elementoMensaje.style.color = "#b91c1c";
            elementoMensaje.textContent = "Saldo insuficiente en tu billetera para realizar este retiro.";
        }
        return;
    }

    // Limpia mensajes de error previos si todas las validaciones pasan
    if (elementoMensaje) elementoMensaje.textContent = "";

    // Calcula el saldo estimado resultante tras aplicar la operación
    const esRecarga = tipo === "recarga";
    const saldoEstimado = esRecarga
        ? Math.round((saldoActualBilletera + monto) * 100) / 100
        : Math.round((saldoActualBilletera - monto) * 100) / 100;

    // Inserta el texto principal de pregunta de confirmación en el modal
    const texto = document.getElementById("textoConfirmacionBilletera");
    if (texto) {
        texto.textContent = esRecarga
            ? `¿Confirmas la solicitud para añadir dinero a tu billetera desde ${banco}?`
            : `¿Confirmas la solicitud para retirar dinero de tu billetera hacia ${banco}?`;
    }

    // Inserta el desglose visual de la operación, banco, monto y saldo resultante estimado
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

    // Guarda la operación pendiente en memoria para ejecutarla al pulsar "Confirmar"
    const descripcion = esRecarga ? `Recarga desde ${banco}` : `Retiro hacia ${banco}`;
    movimientoPendienteConfirmacion = { tipo, monto, descripcion, boton, elementoMensaje, formulario };

    // Muestra el modal de confirmación
    const modal = obtenerModalConfirmarBilletera();
    if (modal) modal.show();
}

// Inicializa los eventos de formularios, chips de montos rápidos, confirmación y carga inicial
document.addEventListener("DOMContentLoaded", () => {
    // Referencias a los elementos del formulario de recarga
    const formRecarga = document.getElementById("formRecargarBilletera");
    const inputMontoRecarga = document.getElementById("montoRecarga");
    const selectBancoRecarga = document.getElementById("bancoRecarga");
    const btnRecarga = document.getElementById("btnRecargarBilletera");
    const msgRecarga = document.getElementById("msgRecarga");

    // Referencias a los elementos del formulario de retiro
    const formRetiro = document.getElementById("formRetirarBilletera");
    const inputMontoRetiro = document.getElementById("montoRetiro");
    const selectBancoRetiro = document.getElementById("bancoRetiro");
    const btnRetiro = document.getElementById("btnRetirarBilletera");
    const msgRetiro = document.getElementById("msgRetiro");

    // Botón de confirmación dentro del modal emergente
    const btnConfirmarModal = document.getElementById("btnConfirmarMovimientoModal");

    // Chips de montos rápidos para recarga
    document.querySelectorAll("[data-monto-rapido]").forEach((chip) => {
        chip.addEventListener("click", () => {
            // Lee el valor preestablecido del atributo data-monto-rapido y lo coloca en el input
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
            // Obtiene el factor decimal del botón (ej. 0.25, 0.5, 1)
            const factor = Number(chip.dataset.porcentajeRetiro || 0);
            if (!inputMontoRetiro) return;
            // Muestra aviso si el usuario no tiene saldo disponible
            if (saldoActualBilletera <= 0) {
                if (msgRetiro) {
                    msgRetiro.style.color = "#b91c1c";
                    msgRetiro.textContent = "No tienes saldo disponible en tu billetera para retirar.";
                }
                return;
            }
            // Calcula el monto proporcional redondeado a 2 decimales y lo escribe en el input
            const montoCalculado = Math.round(saldoActualBilletera * factor * 100) / 100;
            inputMontoRetiro.value = String(montoCalculado);
            if (msgRetiro) msgRetiro.textContent = "";
            inputMontoRetiro.focus();
        });
    });

    // Al pulsar "Añadir dinero", abre la alerta emergente de confirmación
    if (formRecarga) {
        formRecarga.addEventListener("submit", (e) => {
            // Evita el envío tradicional del formulario
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
            // Evita el envío tradicional del formulario
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
            // Verifica que exista una operación pendiente guardada
            if (!movimientoPendienteConfirmacion) return;
            // Extrae y limpia la referencia temporal para evitar doble ejecución
            const datos = movimientoPendienteConfirmacion;
            movimientoPendienteConfirmacion = null;

            // Deshabilita el botón de confirmación y cierra el modal
            btnConfirmarModal.disabled = true;
            const modal = obtenerModalConfirmarBilletera();
            if (modal) modal.hide();

            try {
                // Envía el movimiento confirmado al servidor
                await enviarMovimientoBilletera(
                    datos.tipo,
                    datos.monto,
                    datos.descripcion,
                    datos.boton,
                    datos.elementoMensaje,
                    datos.formulario
                );
            } finally {
                // Reactiva el botón de confirmación del modal
                btnConfirmarModal.disabled = false;
            }
        });
    }

    // Carga los datos iniciales de saldo e historial al abrir la vista de Billetera
    cargarBilletera();
});
