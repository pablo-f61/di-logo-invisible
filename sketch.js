const canalProyector = new BroadcastChannel("instalacion_dialogo");
let ventanaProyector = null;

let MOCK_MODE = true;
let ultimoMockAuto = 0;

const params = {
  distConexion: 161,
  probConexion: 0.043,
  velGlobal: 0.9,
  tamanoBase: 0.4,
  tamNacimiento: 0.3,    // escala del recién nacido (menor = más chico)
  tamMaximo: 1.0,        // escala al llegar al máximo, justo antes de reproducirse
  opacidadLineas: 1.4,
  brilloParticulas: 1.4,
  mostrarParticulasEnNotebook: true,
  rssiMinimo: -85,
  entradaPct: 100,       // % de probes que se aceptan (bajalo si entran demasiados)
  cooldownMac: 800,
  crecimientoPorProbe: 0.12,     // cuánta madurez (0..1) suma cada probe: 0.12 = se divide en ~9-10 probes
  crecimientoPorConexion: 0.004, // madurez que suma cada conexión (solo esporas)
  decaimientoMadurez: 0.004,     // madurez que se pierde por segundo (muy lento)
  maxGeneraciones: 2,            // hasta qué generación de esporas pueden reproducirse
  maxReproduccionesEspora: 1,    // cuántas veces puede reproducirse cada espora (los dispositivos reales, siempre)
  minHijas: 2,                   // al reproducirse, la madre suelta entre minHijas y maxHijas células nuevas
  maxHijas: 4,
  madurezTrasReproducir: 0.0,    // madurez de la madre después de reproducirse (0 = vuelve a empezar)
  vidaEntidad: 60,       // segundos sin probe antes de que la entidad se desvanezca
  maxEntidades: 200,     // tope duro: si se supera, se desvanecen las más viejas
  intervaloMock: 900,
  volDrone: 0.7,
  volGrave: 0.7,
  volProbes: 1.0,
  volConexiones: 1.0,
  pulsosEntidades: true,
};

let sDistConexion, sProbConexion, sVelGlobal, sTamanoBase, sOpacidadLineas, sBrilloParticulas, sTamNacimiento, sTamMaximo, sCrecimientoProbe;
let sRssiMinimo, sCooldownMac, sVidaEntidad, sMaxEntidades, sEntradaPct;
let infoEntradaEl;
let probesRecibidos = 0, probesAceptados = 0, ultimoConteoEntrada = 0;
const MAX_LINEAS_SERIAL_POR_FRAME = 200;
let sIntervaloMock;
let sVolDrone, sVolGrave;
let sVolProbes, sVolConexiones;
let cbPulsosEntidades, cbVerParticulas;
let btnLimpiar;

const ultimosProbesPorMac = new Map();
const mapEntidades = new Map();
const conexiones = [];

let hudVisible = true;
let guiDiv;
let port;

const influencias = [];
const LOG_MAX = 15;
let serialLogEl;

function limpiarTodasLasEntidades() {
  mapEntidades.clear();
  conexiones.length = 0;
  ultimosProbesPorMac.clear();
  influencias.length = 0;

  canalProyector.postMessage({ tipo: "LIMPIAR_TODO" });
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  serialLogEl = document.getElementById("serial-log");

  canalProyector.onmessage = (event) => {
    const data = event.data;
    if (data.tipo === "COMANDO_TECLA") {
      ejecutarComandoTeclado(data.tecla);
    } else if (data.tipo === "PEDIR_ESTADO") {
      for (const [mac, e] of mapEntidades.entries()) {
        canalProyector.postMessage({
          tipo: "NUEVA_ENTIDAD",
          mac: mac,
          x: e.x,
          y: e.y,
          rssi: e.rssi,
          anchoOrigen: width,
          altoOrigen: height,
          params: params,
        });
      }
    }
  };

  guiDiv = createDiv();
  guiDiv.position(20, 55);
  guiDiv.style("background", "rgba(0, 0, 0, 0.88)");
  guiDiv.style("border", "1px solid #ffffff");
  guiDiv.style("padding", "15px");
  guiDiv.style("color", "white");
  guiDiv.style("font-family", "monospace");
  guiDiv.style("font-size", "12px");
  guiDiv.style("display", "flex");
  guiDiv.style("flex-direction", "column");
  guiDiv.style("gap", "4px");
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

    slider.input(() => { valor.html(slider.value()); });

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
  sTamNacimiento = crearControl("Tam. Nacimiento", 0.05, 1.0, params.tamNacimiento, 0.05);
  sTamMaximo = crearControl("Tam. Máximo", 0.4, 5.0, params.tamMaximo, 0.1);
  sOpacidadLineas = crearControl("Opacidad Líneas", 0.0, 5.0, params.opacidadLineas, 0.1);
  sBrilloParticulas = crearControl("Brillo Part.", 0.1, 3.0, params.brilloParticulas, 0.1);

  cbVerParticulas = createCheckbox(" Ver dibujo local", params.mostrarParticulasEnNotebook);
  cbVerParticulas.parent(guiDiv);
  cbVerParticulas.style("margin-top", "3px");

  createDiv("<br><b>CALIBRACIÓN PLACA REAL</b>").parent(guiDiv);
  infoEntradaEl = createDiv("Recibidos: 0/s  |  Aceptados: 0/s");
  infoEntradaEl.parent(guiDiv);
  infoEntradaEl.style("color", "#78c8ff");
  sEntradaPct = crearControl("Entrada probes %", 0, 100, params.entradaPct, 1);
  sRssiMinimo = crearControl("Filtro RSSI dB", -95, -40, params.rssiMinimo, 1);
  sCooldownMac = crearControl("Cooldown MAC ms", 100, 4000, params.cooldownMac, 50);
  sCrecimientoProbe = crearControl("Crecim. x probe", 0.02, 0.5, params.crecimientoPorProbe, 0.01);
  sVidaEntidad = crearControl("Vida sin probe s", 5, 300, params.vidaEntidad, 5);
  sMaxEntidades = crearControl("Máx. entidades", 10, 200, params.maxEntidades, 5);

  createDiv("<br><b>SIMULACIÓN PROBES</b>").parent(guiDiv);
  sIntervaloMock = crearControl("Freq. Probe ms", 100, 4000, params.intervaloMock, 50);

  createDiv("<br><b>PAISAJE SONORO (DRONES)</b>").parent(guiDiv);
  sVolDrone = crearControl("Vol. Drones Fond", 0, 3, params.volDrone, 0.1);
  sVolGrave = crearControl("Vol. Drones Grav", 0, 3, params.volGrave, 0.1);

  createDiv("<br><b>PARTÍCULAS Y EVENTOS</b>").parent(guiDiv);
  sVolProbes = crearControl("Vol. Probes FM", 0, 3, params.volProbes, 0.1);
  sVolConexiones = crearControl("Vol. Conexiones", 0, 3, params.volConexiones, 0.1);

  cbPulsosEntidades = createCheckbox(" Habilitar Sonido", params.pulsosEntidades);
  cbPulsosEntidades.parent(guiDiv);
  cbPulsosEntidades.style("margin-top", "3px");

  createDiv("<br><b>ACCIONES</b>").parent(guiDiv);
  btnLimpiar = createButton("LIMPIAR CÉLULAS [R]");
  btnLimpiar.parent(guiDiv);
  btnLimpiar.style("background", "#111");
  btnLimpiar.style("color", "#fff");
  btnLimpiar.style("border", "1px solid #777");
  btnLimpiar.style("padding", "6px 10px");
  btnLimpiar.style("font-family", "monospace");
  btnLimpiar.style("font-size", "11px");
  btnLimpiar.style("cursor", "pointer");
  btnLimpiar.style("margin-top", "2px");
  btnLimpiar.mousePressed(limpiarTodasLasEntidades);

  if (!MOCK_MODE) {
    port = createSerial();
    const usedPorts = usedSerialPorts();
    if (usedPorts.length > 0) port.open(usedPorts[0], 115200);
  }

  iniciarDrone();
  iniciarCapa();
  iniciarCapaGrave();
  iniciarPulso();
  iniciarConexionSonora();

  setInterval(() => {
    if (document.hidden) actualizarLogicaGlobal();
  }, 1000 / 45);
}

function draw() {
  params.distConexion = sDistConexion.value();
  params.probConexion = sProbConexion.value();
  params.velGlobal = sVelGlobal.value();
  params.tamanoBase = sTamanoBase.value();
  params.tamNacimiento = sTamNacimiento.value();
  params.tamMaximo = sTamMaximo.value();
  params.opacidadLineas = sOpacidadLineas.value();
  params.brilloParticulas = sBrilloParticulas.value();

  params.entradaPct = sEntradaPct.value();
  params.rssiMinimo = sRssiMinimo.value();
  params.cooldownMac = sCooldownMac.value();
  params.crecimientoPorProbe = sCrecimientoProbe.value();
  params.vidaEntidad = sVidaEntidad.value();
  params.maxEntidades = sMaxEntidades.value();
  params.intervaloMock = sIntervaloMock.value();

  params.volDrone = sVolDrone.value();
  params.volGrave = sVolGrave.value();
  params.volProbes = sVolProbes.value();
  params.volConexiones = sVolConexiones.value();
  params.pulsosEntidades = cbPulsosEntidades.checked();
  params.mostrarParticulasEnNotebook = cbVerParticulas.checked();

  background(0,45);
  actualizarLogicaGlobal();

  if (params.mostrarParticulasEnNotebook) {
    for (const [mac, e] of mapEntidades.entries()) e.dibujar();
    for (const c of conexiones) c.dibujar();
  }

  if (hudVisible) {
    push();
    textFont("monospace");
    textSize(12);
    textAlign(LEFT, TOP);
    noStroke();
    fill(0, 0, 0, 220);
    rect(20, 20, 520, 26, 3);
    stroke(255, 60);
    noFill();
    rect(20, 20, 520, 26, 3);

    noStroke();
    fill(180);
    text("MODO:", 28, 27);

    if (MOCK_MODE) {
      fill(80, 220, 100);
      text(`SIM (${params.intervaloMock}ms)`, 68, 27);
    } else {
      fill(255, 160, 40);
      text(`REAL (>${params.rssiMinimo}dB)`, 68, 27);
    }

    fill(160);
    text("|", 222, 27);
    text("ESCALA ACTUAL:", 236, 27);

    fill(120, 200, 255);
    const txtEscala = typeof nombreEscalaActual !== "undefined" ? nombreEscalaActual : "PENTATÓNICA A MENOR";
    text(txtEscala, 342, 27);

    const margenInf = 34;
    const yFooter = height - margenInf;
    const altoFooter = 24;

    noStroke();
    fill(0, 0, 0, 210);
    rect(20, yFooter, width - 40, altoFooter, 3);
    stroke(255, 50);
    noFill();
    rect(20, yFooter, width - 40, altoFooter, 3);

    noStroke();
    textSize(11);
    textAlign(LEFT, CENTER);

    const centroYTexto = yFooter + altoFooter / 2;
    let posX = 30;

    const itemsInstrucciones = [
      { tecla: "[C]", desc: "Audio/Serial" },
      { tecla: "[M]", desc: "Modo Real/Sim" },
      { tecla: "[N]", desc: "Disparar Probe" },
      { tecla: "[P]", desc: "Abrir Proyector" },
      { tecla: "[R]", desc: "Limpiar Células" },
      { tecla: "[F]", desc: "Pantalla Completa" },
      { tecla: "[H]", desc: "Ocultar Controles" }
    ];

    for (let i = 0; i < itemsInstrucciones.length; i++) {
      const it = itemsInstrucciones[i];
      fill(80, 220, 100);
      text(it.tecla, posX, centroYTexto);
      posX += textWidth(it.tecla) + 5;

      fill(210);
      text(it.desc, posX, centroYTexto);
      posX += textWidth(it.desc) + 16;
    }
    pop();
  }
}

function actualizarLogicaGlobal() {
  const ahora = millis();

  // Contador de entrada: cuántos probes llegan y cuántos se aceptan por segundo.
  const transcurrido = ahora - ultimoConteoEntrada;
  if (transcurrido >= 1000) {
    const seg = transcurrido / 1000;
    if (infoEntradaEl) {
      infoEntradaEl.html(
        `Recibidos: ${(probesRecibidos / seg).toFixed(1)}/s  |  Aceptados: ${(probesAceptados / seg).toFixed(1)}/s`
      );
    }
    probesRecibidos = 0;
    probesAceptados = 0;
    ultimoConteoEntrada = ahora;
  }

  if (!MOCK_MODE) {
    if (port) {
      // Antes: una línea por frame. Con probes reales el buffer crecía y aparecía latencia.
      let leidas = 0;
      while (port.availableBytes() > 0 && leidas < MAX_LINEAS_SERIAL_POR_FRAME) {
        const str = port.readUntil("\n");
        if (!str || str.length === 0) break;
        procesarMensajeSerial(str.trim());
        leidas++;
      }
    }
  } else {
    if (ahora - ultimoMockAuto > params.intervaloMock) {
      generarProbeSimulado();
      ultimoMockAuto = ahora;
    }
  }

  let sumaMaduracion = 0;
  const paraReproducir = [];
  for (const [mac, e] of mapEntidades.entries()) {
    e.actualizar(ahora);
    sumaMaduracion += e.maduracion;
    if (e.muerta) {
      mapEntidades.delete(mac);
      ultimosProbesPorMac.delete(mac);
    } else if (e.listaParaReproducir) {
      if (e.puedeReproducirse()) paraReproducir.push(e);      // se reproduce fuera del bucle (no tocar el Map mientras se recorre)
      else if (e.esEspora) e.morir(0.012);              // última generación: al madurar se desvanece (no se reproduce)
    }
  }
  for (const madre of paraReproducir) reproducirCelula(madre);

  // Tope duro: si hay demasiadas, se desvanecen las de probe más viejo.
  // Se cuentan solo las que no están ya yéndose, para no marcar de más mientras se desvanecen.
  if (mapEntidades.size > params.maxEntidades) {
    const vivas = Array.from(mapEntidades.values())
      .filter(e => !e.forzadaAMorir)
      .sort((x, y) => x.ultimoProbe - y.ultimoProbe);
    const sobrantes = vivas.length - params.maxEntidades;
    for (let i = 0; i < sobrantes; i++) vivas[i].morir();
  }

  const entidadesActivas = Array.from(mapEntidades.values());
  const maduracionPromedio = entidadesActivas.length > 0 ? sumaMaduracion / entidadesActivas.length : 0.5;

  for (let i = conexiones.length - 1; i >= 0; i--) {
    conexiones[i].actualizar();   // decae el flash siempre, se dibuje o no en el notebook
    conexiones[i].vida -= 0.015;
    if (conexiones[i].vida <= 0.02) conexiones.splice(i, 1);
  }

  let acordeDisparadoEsteFrame = false;

  for (let i = 0; i < entidadesActivas.length; i++) {
    for (let j = i + 1; j < entidadesActivas.length; j++) {
      const a = entidadesActivas[i];
      const b = entidadesActivas[j];
      if (a.opacidad < 0.3 || b.opacidad < 0.3) continue;
      const d = dist(a.x, a.y, b.x, b.y);

      if (d < params.distConexion && random() < params.probConexion) {
        const nuevaConexion = new Conexion(a, b, d);
        conexiones.push(nuevaConexion);

        if (typeof a.alimentar === "function") a.alimentar();
        if (typeof b.alimentar === "function") b.alimentar();

        if (!acordeDisparadoEsteFrame) {
          const clusterVoces = [
            { freq: a.frecuencia, nx: a.x / width, mac: a.mac, entidad: a },
            { freq: b.frecuencia, nx: b.x / width, mac: b.mac, entidad: b }
          ];

          let sumaDist = d;
          let cantNodos = 2;

          for (let k = 0; k < entidadesActivas.length; k++) {
            if (k === i || k === j) continue;
            const c = entidadesActivas[k];
            const dAC = dist(a.x, a.y, c.x, c.y);
            const dBC = dist(b.x, b.y, c.x, c.y);

            if (dAC < params.distConexion && dBC < params.distConexion) {
              clusterVoces.push({ freq: c.frecuencia, nx: c.x / width, mac: c.mac, entidad: c });
              if (typeof c.alimentar === "function") c.alimentar();
              sumaDist += (dAC + dBC) * 0.5;
              cantNodos++;
              if (cantNodos >= 4) break;
            }
          }

          if (typeof dispararAcordeGrupo === "function") {
            dispararAcordeGrupo(clusterVoces, sumaDist / cantNodos, nuevaConexion);
            acordeDisparadoEsteFrame = true;
          }
        }

        influencias.push({ fuerza: map(d, 0, params.distConexion, 0.6, 0.2), vida: 1.0 });
      }
    }
  }

  const payloadEntidades = [];
  for (const [mac, e] of mapEntidades.entries()) {
    payloadEntidades.push({
      mac: mac,
      nx: e.x / width,
      ny: e.y / height,
      factorCercania: e.factorCercania,
      madurez: e.madurezVisual,
      escala: e.escalaTamano,
      opacidad: e.opacidad,
      energia: e.energia,
      brilloSonoro: e.brilloSonoro,
      tamBase: e.tamBase
    });
  }

  const payloadConexiones = [];
  for (const c of conexiones) {
    payloadConexiones.push({
      nax: c.a.x / width,
      nay: c.a.y / height,
      nbx: c.b.x / width,
      nby: c.b.y / height,
      distancia: c.distancia,
      vida: c.vida,
      brilloFlash: c.brilloFlash,
      seed: c.seed
    });
  }

  canalProyector.postMessage({
    tipo: "SYNC_FRAME",
    entidades: payloadEntidades,
    conexiones: payloadConexiones,
    params: {
      distConexion: params.distConexion,
      opacidadLineas: params.opacidadLineas,
      tamanoBase: params.tamanoBase,
      brilloParticulas: params.brilloParticulas
    }
  });

  for (let i = influencias.length - 1; i >= 0; i--) {
    influencias[i].vida *= 0.96;
    if (influencias[i].vida < 0.03) influencias.splice(i, 1);
  }

  let densidad = constrain(conexiones.length / 60, 0, 1);
  actualizarCampo(densidad, maduracionPromedio);
}

let contadorEsporas = 0;

// Elige `cantidad` notas distintas entre sí y distintas de las de `excluir`.
function elegirNotasNuevas(cantidad, excluir) {
  const escala = (typeof ESCALA_BASE_CONSONANTE !== "undefined" && ESCALA_BASE_CONSONANTE.length > 0)
    ? ESCALA_BASE_CONSONANTE
    : [146.83];
  const pool = escala.filter(f => !excluir.includes(f));
  const notas = [];
  while (notas.length < cantidad) {
    if (pool.length === 0) {
      notas.push(random(escala));
    } else {
      notas.push(pool.splice(floor(random(pool.length)), 1)[0]);
    }
  }
  return notas;
}

// La madre llegó al tamaño máximo: NO muere. Se desprenden de 2 a 4 células nuevas
// (al azar), cada una con una nota nueva, y la madre vuelve a empezar a crecer.
function reproducirCelula(madre) {
  const cantidad = floor(random(params.minHijas, params.maxHijas + 1));
  const notas = elegirNotasNuevas(cantidad, [madre.frecuencia]);

  const anguloBase = random(TWO_PI);
  const paso = TWO_PI / cantidad;

  for (let i = 0; i < cantidad; i++) {
    const ang = anguloBase + i * paso + random(-0.3, 0.3);
    const id = `ESP_${contadorEsporas++}`;
    const hija = new Entidad(madre.x + cos(ang) * 18, madre.y + sin(ang) * 18, madre.rssi, id, true, ang);

    hija.generacion = madre.generacion + 1;
    hija.frecuencia = notas[i];
    hija.brilloSonoro = 1.0;
    hija.energia = 1.0;
    mapEntidades.set(id, hija);

    // Cada hija suena con su nota propia, escalonadas como un pequeño arpegio.
    if (typeof dispararPulsoCrecimiento === "function") {
      const sonar = () => dispararPulsoCrecimiento(0.5, hija.rssi, hija.frecuencia, hija.x / width, hija);
      if (i === 0) sonar();
      else setTimeout(sonar, i * 110);
    }
  }

  // La madre sigue viva: se "vacía" y empieza a crecer de nuevo.
  madre.madurez = params.madurezTrasReproducir;
  madre.llegoAlMax = false;
  madre.reproducciones++;
  madre.brilloSonoro = 1.0;

  influencias.push({ fuerza: 1.0, vida: 1.5 });
}

function procesarMensajeSerial(str) {
  const partes = str.split(",");
  if (partes.length >= 3 && partes[0] === "PROBE") {
    const mac = partes[1].trim();
    const rssi = parseInt(partes[2].trim(), 10);
    if (!mac || isNaN(rssi)) return;   // línea corrupta: antes NaN pasaba el filtro de RSSI
    const ssid = partes.length >= 4 ? partes[3].trim() : "";

    probesRecibidos++;

    if (rssi < params.rssiMinimo) return;

    // Reducción de entrada: acepta solo el porcentaje elegido de los probes que pasan el filtro.
    // Va antes del cooldown para que un probe descartado no bloquee a la MAC.
    if (random(100) >= params.entradaPct) return;

    const ahora = millis();
    if (ultimosProbesPorMac.has(mac)) {
      if (ahora - ultimosProbesPorMac.get(mac) < params.cooldownMac) return;
    }
    ultimosProbesPorMac.set(mac, ahora);
    probesAceptados++;

    if (mapEntidades.has(mac)) {
      const existente = mapEntidades.get(mac);
      existente.registrarProbe(rssi);

      if (existente.puedeReproducirse()) {
        reproducirCelula(existente);
      } else {
        if (typeof dispararPulsoCrecimiento === "function") {
          dispararPulsoCrecimiento(existente.maduracion, rssi, existente.frecuencia, existente.x / width, existente);
        }
      }
    } else {
      const x = random(width);
      const y = random(height);
      const nuevaEntidad = new Entidad(x, y, rssi, mac);
      mapEntidades.set(mac, nuevaEntidad);

      if (typeof dispararPulsoCrecimiento === "function") {
        dispararPulsoCrecimiento(0.0, rssi, nuevaEntidad.frecuencia, x / width, nuevaEntidad);
      }
    }

    logSerialData(mac, rssi, ssid);
    userStartAudio();
  }
}

const DISPOSITIVOS_SALA = [
  { mac: "A4:C3:F0:8A:11:42", ssids: ["Lab_Artes", "UNA_Alumnos", "BROADCAST"], tipo: "permanente" },
  { mac: "38:F9:D3:9B:4C:E1", ssids: ["Fibertel-WiFi-601", "BROADCAST"], tipo: "permanente" },
  { mac: "B0:4E:26:77:01:A9", ssids: ["iPhone_Santi", "BROADCAST"], tipo: "permanente" },
  { mac: "68:DB:CA:41:2E:8F", ssids: ["TeleCentro-WiFi-2.4", "BROADCAST"], tipo: "permanente" },
  { mac: "FC:E9:98:A2:33:55", ssids: ["Personal-Flow-88", "BROADCAST"], tipo: "permanente" },
  { mac: "14:2D:27:E5:60:81", ssids: ["BA_WiFi_Gratis", "BROADCAST"], tipo: "permanente" },
  { mac: "84:D4:7E:11:B2:9C", ssids: ["Galaxy-A54", "BROADCAST"], tipo: "permanente" },
  { mac: "AC:BC:32:8D:E0:41", ssids: ["Claro-Red-412", "BROADCAST"], tipo: "permanente" },
  { mac: "58:CB:52:19:D4:F0", ssids: ["iPad_Taller", "BROADCAST"], tipo: "permanente" },
  { mac: "D4:61:9D:3A:82:13", ssids: ["Movistar_Fibra_7B", "BROADCAST"], tipo: "permanente" },
  { mac: "2C:F0:5D:81:AA:99", ssids: ["iPhone_Gaby", "BROADCAST"], tipo: "permanente" },
  { mac: "70:85:C2:5E:10:3B", ssids: ["Motorola_Edge", "BROADCAST"], tipo: "permanente" },
  { mac: "52:54:00:12:34:56", ssids: ["ThinkPad_T480", "BROADCAST"], tipo: "permanente" },
  { mac: "00:1A:2B:3C:4D:5E", ssids: ["MacBook_Pro_14", "BROADCAST"], tipo: "permanente" },
  { mac: "3C:22:FB:99:11:22", ssids: ["Galaxy_Tab_S8", "BROADCAST"], tipo: "permanente" },
  { mac: "80:2A:A8:44:55:66", ssids: ["Apple_Watch_S7", "BROADCAST"], tipo: "permanente" },
  { mac: "44:65:0D:77:88:99", ssids: ["Pixel_7_Pro", "BROADCAST"], tipo: "permanente" },
  { mac: "9C:8E:99:33:22:11", ssids: ["iPad_Air_5", "BROADCAST"], tipo: "permanente" },
  { mac: "94:E6:F7:19:D4:6C", ssids: ["BROADCAST", "MiFibra-104"], tipo: "medio" },
  { mac: "18:65:90:3A:FB:27", ssids: ["Redmi_Note_12", "BROADCAST"], tipo: "medio" },
  { mac: "D8:12:65:4E:91:02", ssids: ["Fibertel-WiFi-204", "BROADCAST"], tipo: "medio" },
  { mac: "50:32:75:A8:1F:B4", ssids: ["BROADCAST"], tipo: "medio" },
  { mac: "E4:5F:01:B9:33:7C", ssids: ["iPhone_Turista", "BROADCAST"], tipo: "medio" },
  { mac: "88:66:5A:02:44:CD", ssids: ["TeleCentro-WiFi-5G", "BROADCAST"], tipo: "medio" },
  { mac: "00:E0:4C:90:7E:11", ssids: ["BA_WiFi_Gratis", "BROADCAST"], tipo: "medio" },
  { mac: "C0:EE:FB:41:88:22", ssids: ["Galaxy_S23_Ultra", "BROADCAST"], tipo: "medio" },
  { mac: "40:4E:36:20:99:A1", ssids: ["BROADCAST"], tipo: "medio" },
  { mac: "34:80:B3:7C:15:E8", ssids: ["DIRECTV_Net_2.4", "BROADCAST"], tipo: "medio" },
  { mac: "24:4B:FE:12:87:65", ssids: ["Moto_G82", "BROADCAST"], tipo: "medio" },
  { mac: "74:AC:B9:66:77:88", ssids: ["Redmi_Note_10", "BROADCAST"], tipo: "medio" },
  { mac: "AC:87:A3:44:11:00", ssids: ["BROADCAST"], tipo: "medio" },
  { mac: "10:94:BB:22:33:44", ssids: ["iPhone_11", "BROADCAST"], tipo: "medio" },
  { mac: "B8:78:26:99:88:77", ssids: ["Fibertel_WiFi", "BROADCAST"], tipo: "medio" },
  { mac: "E0:D4:E8:55:66:77", ssids: ["BROADCAST"], tipo: "medio" },
  { mac: "64:16:66:33:44:55", ssids: ["Galaxy_A14", "BROADCAST"], tipo: "medio" },
  { mac: "90:78:41:11:22:33", ssids: ["BROADCAST"], tipo: "medio" },
  { mac: "F8:1A:67:8B:20:44", ssids: ["BROADCAST"], tipo: "paso" },
  { mac: "A0:C5:89:12:34:56", ssids: ["Uber_Driver_WiFi", "BROADCAST"], tipo: "paso" },
  { mac: "60:01:94:AA:BB:CC", ssids: ["BROADCAST"], tipo: "paso" },
  { mac: "78:28:CA:DD:EE:11", ssids: ["iPhone", "BROADCAST"], tipo: "paso" },
  { mac: "28:6A:B8:33:22:11", ssids: ["BROADCAST"], tipo: "paso" },
  { mac: "BC:D1:77:44:55:66", ssids: ["TeleCentro-440", "BROADCAST"], tipo: "paso" },
  { mac: "48:2C:A0:77:88:99", ssids: ["Galaxy-J7-Prime", "BROADCAST"], tipo: "paso" },
  { mac: "90:9A:4A:10:20:30", ssids: ["BROADCAST"], tipo: "paso" },
  { mac: "1C:56:FE:44:33:22", ssids: ["BROADCAST"], tipo: "paso" },
  { mac: "A8:96:75:55:44:33", ssids: ["BROADCAST"], tipo: "paso" },
  { mac: "54:E4:3A:66:77:88", ssids: ["BROADCAST"], tipo: "paso" },
  { mac: "C8:3A:35:11:00:99", ssids: ["BROADCAST"], tipo: "paso" },
  { mac: "D0:03:DF:22:33:44", ssids: ["BROADCAST"], tipo: "paso" },
  { mac: "4C:EB:BD:77:88:99", ssids: ["BROADCAST"], tipo: "paso" },
  { mac: "7C:04:D0:88:99:00", ssids: ["BROADCAST"], tipo: "paso" },
  { mac: "8C:85:90:99:00:11", ssids: ["BROADCAST"], tipo: "paso" },
  { mac: "30:07:4D:11:22:33", ssids: ["BROADCAST"], tipo: "paso" }
];

function generarProbeSimulado() {
  const r = random();
  let candidatos = r < 0.6 ? DISPOSITIVOS_SALA.filter(d => d.tipo === "permanente") : (r < 0.85 ? DISPOSITIVOS_SALA.filter(d => d.tipo === "medio") : DISPOSITIVOS_SALA.filter(d => d.tipo === "paso"));
  const disp = random(candidatos);
  const ssidRandom = random(disp.ssids);
  let rssiRandom = disp.tipo === "permanente" ? floor(random(-72, -38)) : (disp.tipo === "medio" ? floor(random(-82, -50)) : floor(random(-92, -70)));
  procesarMensajeSerial(`PROBE,${disp.mac},${rssiRandom},${ssidRandom}`);
}

function ejecutarComandoTeclado(k) {
  if (k === "c" || k === "C") {
    userStartAudio();
    if (!MOCK_MODE && port) {
      if (!port.opened()) port.open(115200);
      else port.close();
    }
  }
  if (k === "m" || k === "M") {
    MOCK_MODE = !MOCK_MODE;
    if (!MOCK_MODE) {
      if (!port) port = createSerial();
      const usedPorts = usedSerialPorts();
      if (usedPorts.length > 0) port.open(usedPorts[0], 115200);
    } else {
      if (port && port.opened()) port.close();
    }
  }
  if (k === "h" || k === "H") {
    hudVisible = !hudVisible;
    if (guiDiv) guiDiv.style("display", hudVisible ? "flex" : "none");
  }
  if (k === "p" || k === "P") {
    ventanaProyector = window.open("proyector.html", "Proyector", "width=1920,height=1080");
  }
  if (k === "n" || k === "N") generarProbeSimulado();
  if (k === "r" || k === "R") limpiarTodasLasEntidades();
}

function mousePressed() { userStartAudio(); }
function windowResized() { resizeCanvas(windowWidth, windowHeight); }
function keyPressed() { ejecutarComandoTeclado(key); }

function logSerialData(mac, rssi, ssid) {
  if (!serialLogEl) return;
  const entry = document.createElement("div");
  entry.className = "log-entry";
  let redTexto = ssid && ssid !== "BROADCAST" ? `[${ssid}]` : `<PROBE SEARCH>`;
  entry.innerText = `${mac}  |  ${rssi} dBm  |  ${redTexto}`;
  serialLogEl.appendChild(entry);
  const activeLogs = serialLogEl.querySelectorAll(".log-entry");
  if (activeLogs.length > LOG_MAX) activeLogs[0].remove();
}