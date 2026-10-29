// JavaScript Documentconst express = require('express');
const app = express();

// Middleware para procesar JSON
app.use(express.json());

// Simulación de Base de Datos en memoria
// Aquí almacenaremos las reservas activas y su estado para cumplir con HU-02 y HU-06
let reservasDB = []; 
// Ejemplo de estructura de reserva:
// { id: "RSV-261028-031", usuarioId: "user-123", fecha: "2026-10-28", horaInicio: "10:00", horaFin: "12:00", estado: "Confirmada" }


/* ==========================================================================
   BACKEND - HU-02: AGENDAMIENTO Y RESERVA DE ESPACIOS
   ========================================================================== */

/**
 * Endpoint para crear una nueva reserva
 * Criterios evaluados:
 * - Escenario 02.1: Registro exitoso ("Confirmada") si está libre y no tiene otra reserva ese día.
 * - Escenario 02.2: Restricción de una reserva por día ("Solo se permite una reserva por día").
 * - Escenario 02.3: Restricción de horario de cierre (Finalización posterior a las 21:00 es rechazada).
 */
app.post('/api/reservas', (req, res) => {
    const { usuarioId, espacioId, fecha, horaInicio, horaFin } = req.body;

    // 1. Validar Restricción de Horario de Cierre (Escenario 02.3)
    // Comparamos si la hora de fin es mayor a las "21:00"
    if (horaFin > "21:00") {
        return res.status(400).json({
            exito: false,
            codigo: "HORARIO_CIERRE_INVALIDO",
            mensaje: "La solicitud fue rechazada. La hora de finalización no puede ser posterior a las 21:00."
        });
    }

    // 2. Validar Restricción de Una Reserva por Día (Escenario 02.2)
    // Buscamos si el usuario ya tiene una reserva con estado "Confirmada" en la misma fecha
    const reservaExistenteMismoDia = reservasDB.find(
        r => r.usuarioId === usuarioId && r.fecha === fecha && r.estado === "Confirmada"
    );

    if (reservaExistenteMismoDia) {
        return res.status(400).json({
            exito: false,
            codigo: "RESERVA_DUPLICADA_DIA",
            mensaje: "Solo se permite una reserva por día."
        });
    }

    // 3. Registro Exitoso de Reserva (Escenario 02.1)
    const nuevaReserva = {
        id: `RSV-${fecha.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
        usuarioId,
        espacioId,
        fecha,
        horaInicio,
        horaFin,
        estado: "Confirmada" // Estado inicial requerido
    };

    reservasDB.push(nuevaReserva);

    return res.status(201).json({
        exito: true,
        mensaje: "Reserva registrada con éxito.",
        reserva: nuevaReserva
    });
});


/* ==========================================================================
   BACKEND - HU-06: GENERACIÓN Y VALIDACIÓN DE PASE QR
   ========================================================================== */

/**
 * Endpoint para solicitar y consultar el Pase QR de una reserva
 * Criterios evaluados:
 * - Escenario 06.1: Generación exitosa de código QR único si está confirmada y activa.
 * - Escenario 06.2: Denegación de QR si la reserva fue cancelada ("Reserva no activa").
 * - Escenario 06.3: Expiración automática si se superó la hora de finalización de la reserva.
 */
app.get('/api/reservas/:id/qr', (req, res) => {
    const { id } = req.params;
    const reserva = reservasDB.find(r => r.id === id);

    // Si la reserva no existe en el sistema
    if (!reserva) {
        return res.status(404).json({
            exito: false,
            mensaje: "Reserva no encontrada."
        });
    }

    // 1. Validar Denegación por Estado Cancelado (Escenario 06.2)
    if (reserva.estado === "Cancelada") {
        return res.status(400).json({
            exito: false,
            codigo: "RESERVA_NO_ACTIVA",
            mensaje: "Reserva no activa"
        });
    }

    // 2. Validar Expiración Automática (Escenario 06.3)
    // Comparamos la fecha/hora actual del sistema con la fecha y horaFin de la reserva
    const fechaHoraActual = new Date(); // Fecha y hora del servidor (2026-10-29...)
    const fechaHoraFinReserva = new Date(`${reserva.fecha}T${reserva.horaFin}:00`);

    if (fechaHoraActual > fechaHoraFinReserva || reserva.estado === "Expirada") {
        reserva.estado = "Expirada";
        return res.status(400).json({
            exito: false,
            codigo: "QR_EXPIRADO",
            mensaje: "El código QR ha expirado porque se superó la hora de finalización de la reserva."
        });
    }

    // 3. Generación Exitosa de Pase QR (Escenario 06.1)
    return res.status(200).json({
        exito: true,
        mensaje: "Pase QR generado exitosamente.",
        datosQR: {
            codigoUnico: reserva.id,
            estado: reserva.estado,
            validoHasta: `${reserva.fecha} ${reserva.horaFin}`,
            urlQrGenerado: `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${reserva.id}`
        }
    });
});

/**
 * Endpoint auxiliar para simular cancelación de reservas (útil para probar HU-06 Escenario 06.2)
 */
app.patch('/api/reservas/:id/cancelar', (req, res) => {
    const { id } = req.params;
    const reserva = reservasDB.find(r => r.id === id);

    if (!reserva) {
        return res.status(404).json({ exito: false, mensaje: "Reserva no encontrada" });
    }

    reserva.estado = "Cancelada";
    return res.json({ exito: true, mensaje: "Reserva cancelada correctamente", reserva });
});

// Inicializar el servidor en el puerto 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor de WorkSpace backend corriendo en el puerto ${PORT}`);
});
