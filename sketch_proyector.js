const entidades = [];
const conexiones = [];
const canal = new BroadcastChannel('instalacion_diálogo');

// Mismos parámetros visuales que el sketch principal
const params = {
    distConexion: 160,
    probConexion: 0.015,
    velGlobal: 2.5,
    tamanoBase: 1.0,
    opacidadLineas: 3.0,
    brilloParticulas: 1.0
};

function setup() {
    createCanvas(windowWidth, windowHeight);
    
    // Escuchar cuando el sketch principal envía una nueva entidad
    canal.onmessage = (event) => {
        if (event.data.tipo === 'NUEVA_ENTIDAD') {
            // Escalar la posición X e Y a la resolución del proyector
            const x = map(event.data.x, 0, 1920, 0, width);
            const y = map(event.data.y, 0, 1080, 0, height);
            entidades.push(new Entidad(x, y, event.data.rssi));
        }
    };
}

function draw() {
    background(0);
    const ahora = millis();
    const FADE_DURACION = 3000;

    // Eliminar expiradas y dibujar entidades
    for (let i = entidades.length - 1; i >= 0; i--) {
        const edad = ahora - entidades[i].nacimiento;
        if (edad > entidades[i].vidaTotal) {
            entidades.splice(i, 1);
        }
    }

    for (const e of entidades) {
        const edad = ahora - e.nacimiento;
        e.opacidad = edad > e.vidaTotal - FADE_DURACION
            ? map(edad, e.vidaTotal - FADE_DURACION, e.vidaTotal, 1, 0)
            : 1;
        e.mover();
        e.dibujar();
    }

    // Dibujar Conexiones
    for (let i = conexiones.length - 1; i >= 0; i--) {
        conexiones[i].vida -= 0.015;
        if (conexiones[i].vida <= 0.02) conexiones.splice(i, 1);
    }

    for (let i = 0; i < entidades.length; i++) {
        for (let j = i + 1; j < entidades.length; j++) {
            const a = entidades[i];
            const b = entidades[j];
            const d = dist(a.x, a.y, b.x, b.y);

            if (d < params.distConexion && random() < params.probConexion) {
                conexiones.push(new Conexion(a, b, d));
            }
        }
    }

    for (const c of conexiones) {
        c.dibujar();
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}