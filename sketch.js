// 📡 Canal de comunicación entre la notebook y el proyector
const canalProyector = new BroadcastChannel('instalacion_diálogo');
let ventanaProyector = null;

// 🎛️ Parámetros interactivos
const params = {
    // Visuales
    distConexion: 160,
    probConexion: 0.015,
    velGlobal: 2.5,
    tamanoBase: 1.0,
    opacidadLineas: 3.0,
    brilloParticulas: 1.0,
    // Sonoras
    volDrone: 0.7,
    volMedia: 0.6,
    volGrave: 0.7,
    pulsosEntidades: true,
};

// Sliders de p5
let sDistConexion,
    sProbConexion,
    sVelGlobal,
    sTamanoBase,
    sOpacidadLineas,
    sBrilloParticulas;
let sVolDrone, sVolMedia, sVolGrave;
let cbPulsosEntidades;

const entidades = [];
const conexiones = [];

let debugMode = true;
let guiDiv;
let port; // Puerto serial

// ⚡ influencias
const influencias = [];

// 📡 serial log
const LOG_MAX = 6;
let serialLogEl;
 
function setup() {
    createCanvas(windowWidth, windowHeight);
 
    serialLogEl = document.getElementById("serial-log");
 
    // Configurar GUI con p5
    guiDiv = createDiv();
    guiDiv.position(10, 10);
    guiDiv.style("background", "rgba(0,0,0,0.5)");
    guiDiv.style("padding", "10px");
    guiDiv.style("color", "white");
    guiDiv.style("font-family", "sans-serif");
    guiDiv.style("font-size", "12px");
    guiDiv.style("display", "flex");
    guiDiv.style("flex-direction", "column");
    guiDiv.style("gap", "5px");
    guiDiv.style("z-index", "100");
 
    function crearControl(nombre, min, max, val, step) {
        const contenedor = createDiv();
        contenedor.style("display", "flex");
        contenedor.style("justify-content", "space-between");
        contenedor.style("align-items", "center");
        contenedor.style("width", "260px");
 
        const etiqueta = createSpan(nombre);
        etiqueta.style("width", "100px");
 
        const slider = createSlider(min, max, val, step);
        slider.style("width", "100px");
 
        const valor = createSpan(val.toString());
        valor.style("width", "35px");
        valor.style("text-align", "right");
 
        // Actualizar el texto cuando se mueve el slider
        slider.input(() => {
            valor.html(slider.value());
        });
 
        contenedor.child(etiqueta);
        contenedor.child(slider);
        contenedor.child(valor);
        guiDiv.child(contenedor);
 
        return slider;
    }
 
    createDiv("<b>Visuales</b>").parent(guiDiv);
    sDistConexion = crearControl(
        "Dist. Conexión",
        50,
        300,
        params.distConexion,
        1,
    );
    sProbConexion = crearControl(
        "Prob. Conexión",
        0.001,
        0.1,
        params.probConexion,
        0.001,
    );
    sVelGlobal = crearControl("Velocidad Gral", 0.1, 3.0, params.velGlobal, 0.1);
    sTamanoBase = crearControl("Tamaño Part.", 0.1, 3.0, params.tamanoBase, 0.1);
    sOpacidadLineas = crearControl(
        "Opacidad Líneas",
        0.0,
        5.0,
        params.opacidadLineas,
        0.1,
    );
    sBrilloParticulas = crearControl(
        "Brillo Part.",
        0.1,
        3.0,
        params.brilloParticulas,
        0.1,
    );
 
    createDiv("<br><b>Sonido (Multipl.)</b>").parent(guiDiv);
    sVolDrone = crearControl("Vol. Drone", 0, 3, params.volDrone, 0.1);
    sVolMedia = crearControl("Vol. Media", 0, 3, params.volMedia, 0.1);
    sVolGrave = crearControl("Vol. Grave", 0, 3, params.volGrave, 0.1);
 
    cbPulsosEntidades = createCheckbox(' Pulsos (Entidades)', params.pulsosEntidades);
    cbPulsosEntidades.parent(guiDiv);
    cbPulsosEntidades.style('margin-top', '5px');
 
    reverb = new p5.Reverb();
 
    // Configuración del puerto serial
    port = createSerial();
 
    // Intentar abrir el último puerto usado si lo hay
    const usedPorts = usedSerialPorts();
    if (usedPorts.length > 0) {
        port.open(usedPorts[0], 115200);
    }
 
    iniciarDrone();
    iniciarCapa();
    iniciarCapaGrave();
    iniciarPulso();
}
 
function draw() {
    // Actualizar parámetros desde los sliders
    params.distConexion = sDistConexion.value();
    params.probConexion = sProbConexion.value();
    params.velGlobal = sVelGlobal.value();
    params.tamanoBase = sTamanoBase.value();
    params.opacidadLineas = sOpacidadLineas.value();
    params.brilloParticulas = sBrilloParticulas.value();
 
    params.volDrone = sVolDrone.value();
    params.volMedia = sVolMedia.value();
    params.volGrave = sVolGrave.value();
    params.pulsosEntidades = cbPulsosEntidades.checked();
 
    background(0);
 
    const ahora = millis();
    const FADE_DURACION = 3000; // últimos 3 segundos de vida se desvanece
 
    // ---------------- SERIAL ----------------
    if (port && port.availableBytes() > 0) {
        let str = port.readUntil("\n");
        if (str.length > 0) {
            str = str.trim();
            const partes = str.split(",");
 
            // Formato esperado: PROBE, MAC, RSSI, SSID
            if (partes.length >= 3 && partes[0] === "PROBE") {
                const x = random(width);
                const y = random(height);
 
                const rssi = int(partes[2].trim());
                const ssid = partes.length >= 4 ? partes[3].trim() : "";
                const mac = partes[1].trim();
 
                const nuevaEntidad = new Entidad(x, y, rssi);
                entidades.push(nuevaEntidad);
 
                // Mostrar en el log HTML
                logSerialData(mac, rssi, ssid);

                // 📡 Transmitir evento al proyector
                canalProyector.postMessage({
                    tipo: 'NUEVA_ENTIDAD',
                    x: x,
                    y: y,
                    rssi: rssi
                });
 
                userStartAudio();
            }
        }
    }
 
    // ---------------- ENTIDADES ----------------
    for (let i = entidades.length - 1; i >= 0; i--) {
        const edad = ahora - entidades[i].nacimiento;
        if (edad > entidades[i].vidaTotal) {
            entidades.splice(i, 1);
        }
    }
 
    for (const e of entidades) {
        const edad = ahora - e.nacimiento;
        e.opacidad =
            edad > e.vidaTotal - FADE_DURACION
                ? map(edad, e.vidaTotal - FADE_DURACION, e.vidaTotal, 1, 0)
                : 1;
        e.mover();
        e.dibujar();
    }
 
    // ---------------- CONEXIONES ----------------
    for (let i = conexiones.length - 1; i >= 0; i--) {
        conexiones[i].vida -= 0.015;
        if (conexiones[i].vida <= 0.02) {
            conexiones.splice(i, 1);
        }
    }
 
    for (let i = 0; i < entidades.length; i++) {
        for (let j = i + 1; j < entidades.length; j++) {
            const a = entidades[i];
            const b = entidades[j];
            const d = dist(a.x, a.y, b.x, b.y);
 
            if (d < params.distConexion && random() < params.probConexion) {
                conexiones.push(new Conexion(a, b, d));
 
                a.energia += 0.6;
                b.energia += 0.6;
 
                influencias.push({
                    fuerza: map(d, 0, params.distConexion, 0.6, 0.2),
                    vida: 1.0,
                });
            }
        }
    }
 
    for (const c of conexiones) {
        c.dibujar();
    }

    // ---------------- INFLUENCIAS ----------------
    for (let i = influencias.length - 1; i >= 0; i--) {
        influencias[i].vida *= 0.96;
        if (influencias[i].vida < 0.03) {
            influencias.splice(i, 1);
        }
    }
 
    // ---------------- PULSO ----------------
    if (params.pulsosEntidades) {
        energiaPulso += influencias.length * 0.002;
    }
 
    energiaPulso *= 0.98;
    energiaPulso = constrain(energiaPulso, 0, 1);
 
    const intervalo = map(energiaPulso, 0, 1, 2200, 600);
 
    if (ahora - ultimoPulso > intervalo && energiaPulso > 0.05) {
        dispararPulso();
        ultimoPulso = ahora;
    }
 
    // ---------------- SONIDO ----------------
    let densidad = conexiones.length / 60;
    densidad = constrain(densidad, 0, 1);
 
    actualizarCampo(densidad);
}
 
// ---------------- INPUT ----------------
function mousePressed() {
    userStartAudio();
}
 
function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}
 
function keyPressed() {
    // Tecla C: Conectar/Desconectar Serial
    if (key === "c" || key === "C") {
        userStartAudio();
        if (!port.opened()) {
            port.open(115200);
        } else {
            port.close();
        }
    }
    
    // Tecla H: Ocultar / Mostrar GUI y Consola Log
    if (key === "h" || key === "H") {
        debugMode = !debugMode;
        if (guiDiv) {
            guiDiv.style("display", debugMode ? "flex" : "none");
        }
        if (serialLogEl) {
            serialLogEl.style.display = debugMode ? "block" : "none";
        }
    }

    // Tecla P: Abrir ventana secundaria de Proyector
    if (key === "p" || key === "P") {
        ventanaProyector = window.open("proyector.html", "Proyector", "width=1920,height=1080");
    }
}
 
// ---------------- SERIAL LOG (HTML) ----------------
function logSerialData(mac, rssi, ssid) {
    if (!serialLogEl) return;
 
    let texto = `${mac}  ${rssi}dBm`;
    if (ssid && ssid !== "BROADCAST") {
        texto += `  ${ssid}`;
    }
 
    const entry = document.createElement("div");
    entry.className = "log-entry";
    entry.textContent = texto;
 
    serialLogEl.appendChild(entry);
 
    const activeLogs = serialLogEl.querySelectorAll(".log-entry:not(.removing)");
    if (activeLogs.length > LOG_MAX) {
        const diff = activeLogs.length - LOG_MAX;
        for (let i = 0; i < diff; i++) {
            const oldest = activeLogs[i];
            oldest.classList.add("removing");
            oldest.addEventListener("animationend", () => oldest.remove(), {
                once: true,
            });
            setTimeout(() => {
                if (oldest.parentNode) oldest.remove();
            }, 500);
        }
    }
}