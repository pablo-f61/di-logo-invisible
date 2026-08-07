// 📡 Canal de comunicación entre la notebook y el proyector
const canalProyector = new BroadcastChannel('instalacion_diálogo');
let ventanaProyector = null;

// 🧪 MODO SIMULACIÓN (Para probar SIN la placa USB)
// Cambiar a 'true' para generar peticiones falsas
let MOCK_MODE = true; 
let ultimoMockAuto = 0; // Control de tiempo para envío automático

// 🎛️ Parámetros interactivos
const params = {
    // Visuales
    distConexion: 160,
    probConexion: 0.015,
    velGlobal: 2.5,
    tamanoBase: 1.0,
    opacidadLineas: 3.0,
    brilloParticulas: 1.0,
    mostrarParticulasEnNotebook: false, // Desactivado por defecto para modo operativo puro
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
let cbPulsosEntidades, cbVerParticulas;

const entidades = [];
const conexiones = [];

let hudVisible = true; // Control exclusivo para la H
let guiDiv;
let port; // Puerto serial

// ⚡ influencias
const influencias = [];

// 📡 serial log
const LOG_MAX = 15;
let serialLogEl;

function setup() {
    createCanvas(windowWidth, windowHeight);

    serialLogEl = document.getElementById("serial-log");

    // Configurar GUI (HUD de controles)
    guiDiv = createDiv();
    guiDiv.position(20, 20);
    guiDiv.style("background", "rgba(0, 0, 0, 0.8)");
    guiDiv.style("border", "1px solid #ffffff");
    guiDiv.style("padding", "15px");
    guiDiv.style("color", "white");
    guiDiv.style("font-family", "monospace");
    guiDiv.style("font-size", "12px");
    guiDiv.style("display", "flex");
    guiDiv.style("flex-direction", "column");
    guiDiv.style("gap", "6px");
    guiDiv.style("z-index", "100");

    function crearControl(nombre, min, max, val, step) {
        const contenedor = createDiv();
        contenedor.style("display", "flex");
        contenedor.style("justify-content", "space-between");
        contenedor.style("align-items", "center");
        contenedor.style("width", "280px");

        const etiqueta = createSpan(nombre);
        etiqueta.style("width", "110px");

        const slider = createSlider(min, max, val, step);
        slider.style("width", "110px");

        const valor = createSpan(val.toString());
        valor.style("width", "35px");
        valor.style("text-align", "right");

        slider.input(() => {
            valor.html(slider.value());
        });

        contenedor.child(etiqueta);
        contenedor.child(slider);
        contenedor.child(valor);
        guiDiv.child(contenedor);

        return slider;
    }

    createDiv("<b>CONTROLES VISUALES</b>").parent(guiDiv);
    sDistConexion = crearControl("Dist. Conexión", 50, 300, params.distConexion, 1);
    sProbConexion = crearControl("Prob. Conexión", 0.001, 0.1, params.probConexion, 0.001);
    sVelGlobal = crearControl("Velocidad Gral", 0.1, 3.0, params.velGlobal, 0.1);
    sTamanoBase = crearControl("Tamaño Part.", 0.1, 3.0, params.tamanoBase, 0.1);
    sOpacidadLineas = crearControl("Opacidad Líneas", 0.0, 5.0, params.opacidadLineas, 0.1);
    sBrilloParticulas = crearControl("Brillo Part.", 0.1, 3.0, params.brilloParticulas, 0.1);

    cbVerParticulas = createCheckbox(' Ver dibujo local', params.mostrarParticulasEnNotebook);
    cbVerParticulas.parent(guiDiv);
    cbVerParticulas.style('margin-top', '5px');

    createDiv("<br><b>MEZCLA DE AUDIO</b>").parent(guiDiv);
    sVolDrone = crearControl("Vol. Drone", 0, 3, params.volDrone, 0.1);
    sVolMedia = crearControl("Vol. Media", 0, 3, params.volMedia, 0.1);
    sVolGrave = crearControl("Vol. Grave", 0, 3, params.volGrave, 0.1);

    cbPulsosEntidades = createCheckbox(' Pulsos Sonoros', params.pulsosEntidades);
    cbPulsosEntidades.parent(guiDiv);

    reverb = new p5.Reverb();

    // Solo abrimos el puerto si NO estamos en MOCK_MODE
    if (!MOCK_MODE) {
        port = createSerial();
        const usedPorts = usedSerialPorts();
        if (usedPorts.length > 0) {
            port.open(usedPorts[0], 115200);
        }
    } else {
        console.log("🛠️ MODO SIMULACIÓN ACTIVO: Presioná 'N' para generar un nodo o esperá el timer.");
    }

    iniciarDrone();
    iniciarCapa();
    iniciarCapaGrave();
    iniciarPulso();
}

function draw() {
    // Actualizar parámetros locales
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
    params.mostrarParticulasEnNotebook = cbVerParticulas.checked();

    background(0);

    const ahora = millis();
    const FADE_DURACION = 3000;

    // ---------------- SERIAL / MOCK ----------------
    if (!MOCK_MODE) {
        // --- MODO REAL CON PLACA USB ---
        if (port && port.availableBytes() > 0) {
            let str = port.readUntil("\n");
            if (str.length > 0) {
                procesarMensajeSerial(str.trim());
            }
        }
    } else {
        // --- MODO SIMULACIÓN (AUTOMÁTICO) ---
        // Genera un evento simulado cada 2.5 segundos
        if (ahora - ultimoMockAuto > 2500) {
            generarProbeSimulado();
            ultimoMockAuto = ahora;
        }
    }

    // ---------------- LÓGICA DE ENTIDADES & AUDIO ----------------
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
        
        if (params.mostrarParticulasEnNotebook) {
            e.dibujar();
        }
    }

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

    if (params.mostrarParticulasEnNotebook) {
        for (const c of conexiones) {
            c.dibujar();
        }
    }

    // Audio
    for (let i = influencias.length - 1; i >= 0; i--) {
        influencias[i].vida *= 0.96;
        if (influencias[i].vida < 0.03) influencias.splice(i, 1);
    }

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

    let densidad = conexiones.length / 60;
    densidad = constrain(densidad, 0, 1);
    actualizarCampo(densidad);
}

// ---------------- PROCESADOR DE MENSAJES Y SIMULADOR ----------------
function procesarMensajeSerial(str) {
    const partes = str.split(",");

    if (partes.length >= 3 && partes[0] === "PROBE") {
        const x = random(width);
        const y = random(height);

        const rssi = int(partes[2].trim());
        const ssid = partes.length >= 4 ? partes[3].trim() : "";
        const mac = partes[1].trim();

        const nuevaEntidad = new Entidad(x, y, rssi);
        entidades.push(nuevaEntidad);

        // Imprimir en consola central de texto blanco
        logSerialData(mac, rssi, ssid);

        // Transmitir al proyector
        canalProyector.postMessage({
            tipo: 'NUEVA_ENTIDAD',
            x: x,
            y: y,
            rssi: rssi,
            anchoOrigen: width,
            altoOrigen: height
        });

        userStartAudio();
    }
}

// Función auxiliar para simular la llegada de un paquete de la placa
function generarProbeSimulado() {
    const macsFalsas = ["AA:BB:CC:11:22:33", "44:55:66:77:88:99", "12:34:56:78:90:AB", "FE:DC:BA:98:76:54"];
    const ssidsFalsos = ["MiWiFi_Casa", "Fibertel-2.4G", "BROADCAST", "iPhone_Pablo", "Lab_Artes"];
    
    const macRandom = random(macsFalsas);
    const rssiRandom = floor(random(-88, -35));
    const ssidRandom = random(ssidsFalsos);

    const rawString = `PROBE,${macRandom},${rssiRandom},${ssidRandom}`;
    procesarMensajeSerial(rawString);
}

// ---------------- INPUTS Y TECLAS ----------------
function mousePressed() {
    userStartAudio();
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}

function keyPressed() {
    // 🔑 TECLA C: Conectar/Desconectar el puerto manualmente (Modo Real)
    if (key === "c" || key === "C") {
        userStartAudio();
        if (!MOCK_MODE && port) {
            if (!port.opened()) {
                port.open(115200);
            } else {
                port.close();
            }
        }
    }

    // 🔑 TECLA M: Alternar entre MOCK_MODE y Puerto Serie Real
    if (key === "m" || key === "M") {
        MOCK_MODE = !MOCK_MODE;

        if (!MOCK_MODE) {
            console.log("🔌 MODO REAL: Intentando conectar puerto serial...");
            if (!port) port = createSerial();
            
            const usedPorts = usedSerialPorts();
            if (usedPorts.length > 0) {
                port.open(usedPorts[0], 115200);
            } else {
                console.warn("⚠️ No se encontraron puertos serie activos.");
            }
        } else {
            console.log("🛠️ MODO SIMULACIÓN: Desconectando puerto real...");
            if (port && port.opened()) {
                port.close();
            }
        }
    }
    
    // 🔑 TECLA H: Oculta/muestra SOLO el panel de sliders (HUD)
    if (key === "h" || key === "H") {
        hudVisible = !hudVisible;
        if (guiDiv) guiDiv.style("display", hudVisible ? "flex" : "none");
    }

    // 🔑 TECLA P: Abre la ventana proyectada
    if (key === "p" || key === "P") {
        ventanaProyector = window.open("proyector.html", "Proyector", "width=1920,height=1080");
    }

    // 🔑 TECLA N: Genera un nodo simulado manualmente (ideal para testear rápido)
    if (key === "n" || key === "N") {
        generarProbeSimulado();
    }
}


// ---------------- LOG DE DATOS EN BLANCO Y NEGRO ----------------
function logSerialData(mac, rssi, ssid) {
    if (!serialLogEl) return;

    const entry = document.createElement("div");
    entry.className = "log-entry";
    
    let redTexto = ssid && ssid !== "BROADCAST" ? `[${ssid}]` : `<PROBE SEARCH>`;
    entry.innerText = `${mac}  |  ${rssi} dBm  |  ${redTexto}`;

    serialLogEl.appendChild(entry);

    const activeLogs = serialLogEl.querySelectorAll(".log-entry");
    if (activeLogs.length > LOG_MAX) {
        activeLogs[0].remove(); // Limpieza simple de la línea más vieja
    }
}