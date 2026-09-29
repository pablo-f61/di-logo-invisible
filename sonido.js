let reverb;

// 🎻 ENSAMBLE DE DRONES GRAVES (Re2, La, Re3) que respiran con el tráfico
const dronesGrave = [];
let filtroDrones;

// 🎹 SÍNTESIS CRISTALINA POLIFÓNICA (Sine + Triángulo desafinado)
const MAX_VOCES_PULSO = 6;
let oscsSine = [];
let oscsTri = [];
let envsPulso = [];
let vozFiltro;
let idxVozPulso = 0;

// 🎼 MOTOR DE CONEXIONES Y ACORDES
const MAX_VOCES_CONEXION = 4;
let oscsConexionSine = [];
let oscsConexionTri = [];
let envsConexion = [];
let filtroConexion;
let gainConexionesMaster;
let ultimoDisparoAcorde = 0;
const INTERVALO_MIN_ACORDE = 800;

// 🎼 ESCALA PENTATÓNICA MENOR DE RE (15 notas: 3 octavas desde Re3 = 146.83 Hz)
const ESCALA_PENTA_RE_MENOR = [
  // Octava 3
  146.83, 174.61, 196.00, 220.00, 261.63,
  // Octava 4
  293.66, 349.23, 392.00, 440.00, 523.25,
  // Octava 5
  587.33, 698.46, 783.99, 880.00, 1046.50
];

let ESCALA_BASE_CONSONANTE = [...ESCALA_PENTA_RE_MENOR];
let nombreEscalaActual = "PENTATÓNICA MENOR DE RE (CRISTAL)";

// Frecuencias fijas para el drone continuo de fondo (Re2, La2, Re3)
const FREQS_DRONE = [73.42, 110.14, 146.83];
const AMP_DRONE_MAX = [0.035, 0.025, 0.020];

function asegurarReverb() {
  if (!reverb && typeof p5.Reverb !== "undefined") {
    reverb = new p5.Reverb();
    reverb.set(6.0, 3.5); // Reverb generosa de cola larga
    reverb.drywet(0.55);
  }
}

// ---------------- 1. PAISAJE SONORO: DRONES CONTINUOS ----------------

function iniciarCapaGrave() {
  asegurarReverb();
  asegurarFiltroDrones();

  for (let i = 0; i < FREQS_DRONE.length; i++) {
    const osc = new p5.Oscillator("sine");
    osc.disconnect();
    if (filtroDrones) osc.connect(filtroDrones);
    osc.freq(FREQS_DRONE[i]);
    osc.amp(0);
    osc.start();

    dronesGrave.push({
      osc: osc,
      maxAmp: AMP_DRONE_MAX[i],
      seed: random(1000)
    });
  }
}

function iniciarDrone() {}
function iniciarCapa() {}

function asegurarFiltroDrones() {
  if (!filtroDrones && typeof p5.LowPass !== "undefined") {
    filtroDrones = new p5.LowPass();
    filtroDrones.freq(520);
    filtroDrones.res(0.4);
    if (reverb) reverb.process(filtroDrones, 7, 4);
  }
}

// ---------------- 2. PROBES CRISTALINOS (SINE + TRIÁNGULO DESAFINADO) ----------------

function iniciarPulso() {
  asegurarReverb();

  vozFiltro = new p5.LowPass();
  vozFiltro.freq(1800);
  vozFiltro.res(0.3);

  oscsSine = [];
  oscsTri = [];
  envsPulso = [];

  for (let i = 0; i < MAX_VOCES_PULSO; i++) {
    const sOsc = new p5.Oscillator("sine");
    sOsc.disconnect();
    sOsc.connect(vozFiltro);
    sOsc.amp(0);
    sOsc.start();

    // Armónico triangular apenas desafinado para textura de vidrio/campana
    const tOsc = new p5.Oscillator("triangle");
    tOsc.disconnect();
    tOsc.connect(vozFiltro);
    tOsc.amp(0);
    tOsc.start();

    const env = new p5.Envelope();

    oscsSine.push(sOsc);
    oscsTri.push(tOsc);
    envsPulso.push(env);
  }

  if (reverb) reverb.process(vozFiltro, 7, 4);
}

function dispararPulsoCrecimiento(maduracion = 0, rssi = -70, frecuenciaNota = 146.83, nx = 0.5, entidadRef = null) {
  if (typeof params !== "undefined") {
    if (!params.pulsosEntidades) return;
    if (params.volProbes !== undefined && params.volProbes <= 0.001) return;
  }
  if (frecuenciaNota === null || frecuenciaNota <= 0) return;
  if (oscsSine.length === 0 || !vozFiltro) return;

  if (entidadRef) {
    entidadRef.brilloSonoro = 1.0;
  }

  const sOsc = oscsSine[idxVozPulso];
  const tOsc = oscsTri[idxVozPulso];
  const env = envsPulso[idxVozPulso];
  idxVozPulso = (idxVozPulso + 1) % MAX_VOCES_PULSO;

  const panVal = map(constrain(nx, 0.0, 1.0), 0.0, 1.0, -0.8, 0.8);
  if (typeof sOsc.pan === "function") {
    sOsc.pan(panVal, 0.03);
    tOsc.pan(panVal, 0.03);
  }

  sOsc.freq(frecuenciaNota, 0.02);
  tOsc.freq(frecuenciaNota * 1.003, 0.02); // Leve desafinación para cuerpo de campana

  const gananciaUsuario = (typeof params !== "undefined" && params.volProbes !== undefined) ? params.volProbes : 1.0;
  const volumen = map(maduracion, 0, 1, 0.04, 0.16) * gananciaUsuario;

  const duracion = map(maduracion, 0, 1, 1.2, 3.5); // Ataque suave, cola larga
  env.setADSR(0.12, duracion * 0.4, 0.0, duracion * 0.6);
  env.setRange(volumen, 0);

  env.play(sOsc);
  env.play(tOsc);
}

// ---------------- 3. MOTOR DE ACORDES: OCTAVAS Y QUINTAS DE COLOR ----------------

function iniciarConexionSonora() {
  asegurarReverb();

  filtroConexion = new p5.LowPass();
  filtroConexion.freq(2200);
  filtroConexion.res(0.3);

  if (typeof p5.Gain !== "undefined") {
    gainConexionesMaster = new p5.Gain();
    filtroConexion.disconnect();
    filtroConexion.connect(gainConexionesMaster);
    gainConexionesMaster.amp(1.0);
    if (reverb) reverb.process(gainConexionesMaster, 8, 4.5);
  } else {
    if (reverb) reverb.process(filtroConexion, 8, 4.5);
  }

  oscsConexionSine = [];
  oscsConexionTri = [];
  envsConexion = [];

  for (let i = 0; i < MAX_VOCES_CONEXION; i++) {
    const sOsc = new p5.Oscillator("sine");
    sOsc.disconnect();
    sOsc.connect(filtroConexion);
    sOsc.amp(0);
    sOsc.start();

    const tOsc = new p5.Oscillator("triangle");
    tOsc.disconnect();
    tOsc.connect(filtroConexion);
    tOsc.amp(0);
    tOsc.start();

    const env = new p5.Envelope();
    oscsConexionSine.push(sOsc);
    oscsConexionTri.push(tOsc);
    envsConexion.push(env);
  }
}

function dispararAcordeGrupo(vocesCluster, distPromedio, conexionRef = null) {
  if (typeof params !== "undefined") {
    if (!params.pulsosEntidades) return;
    if (params.volConexiones !== undefined && params.volConexiones <= 0.001) return;
  }
  if (oscsConexionSine.length === 0 || !filtroConexion || !vocesCluster || vocesCluster.length < 2) return;

  const vocesSonoras = vocesCluster.filter(v => v.freq !== null && v.freq > 0);
  if (vocesSonoras.length === 0) return;

  const ahora = millis();
  if (ahora - ultimoDisparoAcorde < INTERVALO_MIN_ACORDE) return;
  ultimoDisparoAcorde = ahora;

  // Tomamos las frecuencias base y armamos intervalos musicales (Octava arriba + Quinta justa/nota de color)
  let baseFreq = vocesSonoras[0].freq;
  let notasAcorde = [
    baseFreq,
    baseFreq * 1.5, // Quinta justa (puede generar notas de color consonantes)
    baseFreq * 2.0  // Octava alta
  ];

  const numNotas = min(notasAcorde.length, MAX_VOCES_CONEXION);
  const distRef = (typeof params !== "undefined" && params.distConexion) ? params.distConexion : 160;

  const gananciaConexiones = (typeof params !== "undefined" && params.volConexiones !== undefined) ? params.volConexiones : 1.0;
  const volBase = (map(distPromedio, 0, distRef, 0.12, 0.04, true) / Math.sqrt(numNotas)) * gananciaConexiones;
  const duracion = map(distPromedio, 0, distRef, 1.8, 3.8, true);

  if (conexionRef) {
    conexionRef.destellar();
  }

  const delayPasoSegundos = 0.07;

  for (let i = 0; i < numNotas; i++) {
    const sOsc = oscsConexionSine[i];
    const tOsc = oscsConexionTri[i];
    const env = envsConexion[i];
    const freq = notasAcorde[i];
    const entidadVoz = vocesSonoras[i % vocesSonoras.length] ? vocesSonoras[i % vocesSonoras.length].entidad : null;
    const nx = vocesSonoras[i % vocesSonoras.length] ? vocesSonoras[i % vocesSonoras.length].nx : 0.5;

    const panIndividual = map(constrain(nx, 0.0, 1.0), 0.0, 1.0, -0.75, 0.75);
    if (typeof sOsc.pan === "function") {
      sOsc.pan(panIndividual, 0.03);
      tOsc.pan(panIndividual, 0.03);
    }

    sOsc.freq(freq, 0.02);
    tOsc.freq(freq * 1.004, 0.02);

    const tAttack = 0.08 + (i * 0.05);
    const tRelease = duracion * (0.7 + i * 0.1);

    env.setADSR(tAttack, duracion * 0.3, 0.0, tRelease);
    env.setRange(volBase, 0);

    const retardoVoz = i * delayPasoSegundos;
    env.play(sOsc, retardoVoz);
    env.play(tOsc, retardoVoz);

    if (entidadVoz) {
      if (retardoVoz === 0) {
        entidadVoz.brilloSonoro = 1.0;
      } else {
        setTimeout(() => {
          if (entidadVoz) entidadVoz.brilloSonoro = 1.0;
        }, retardoVoz * 1000);
      }
    }
  }
}

function dispararSonidoMitosis(f1, f2, nx = 0.5) {
  if (typeof params !== "undefined") {
    if (!params.pulsosEntidades) return;
    if (params.volConexiones !== undefined && params.volConexiones <= 0.001) return;
  }
  if ((f1 === null || f1 <= 0) && (f2 === null || f2 <= 0)) return;
  if (oscsConexionSine.length < 2 || !filtroConexion) return;

  let raiz = f1 !== null && f1 > 0 ? f1 : (f2 !== null && f2 > 0 ? f2 : 146.83);
  const ganancia = (typeof params !== "undefined" && params.volConexiones !== undefined) ? params.volConexiones : 1.0;
  const notas = [raiz, raiz * 1.5, raiz * 2.0];
  const panBase = map(constrain(nx, 0.0, 1.0), 0.0, 1.0, -0.8, 0.8);

  for (let i = 0; i < 3; i++) {
    const sOsc = oscsConexionSine[i % oscsConexionSine.length];
    const tOsc = oscsConexionTri[i % oscsConexionTri.length];
    const env = envsConexion[i % envsConexion.length];

    const panVoz = constrain(panBase + (i === 1 ? -0.2 : i === 2 ? 0.2 : 0), -0.8, 0.8);
    if (typeof sOsc.pan === "function") {
      sOsc.pan(panVoz, 0.01);
      tOsc.pan(panVoz, 0.01);
    }

    sOsc.freq(notas[i], 0.01);
    tOsc.freq(notas[i] * 1.003, 0.01);

    env.setADSR(0.05 + i * 0.04, 0.2, 0.0, 0.9 + i * 0.2);
    env.setRange(0.12 * ganancia, 0);

    env.play(sOsc, i * 0.06);
    env.play(tOsc, i * 0.06);
  }
}

// ---------------- 4. ACTUALIZACIÓN DINÁMICA DEL DRONE CON TRÁFICO ----------------

function actualizarCampo(densidad, maduracionPromedio = 0.5) {
  const vGrave = (typeof params !== "undefined" && params.volGrave !== undefined) ? params.volGrave : 0.7;
  const vDrone = (typeof params !== "undefined" && params.volDrone !== undefined) ? params.volDrone : 0.7;

  // El volumen global de los drones sube y baja suavemente según la densidad de conexiones en la sala
  const factorDucking = map(densidad, 0, 1, 0.35, 1.15, true);

  if (gainConexionesMaster && typeof params !== "undefined" && params.volConexiones !== undefined) {
    gainConexionesMaster.amp(params.volConexiones, 0.05);
  }

  if (filtroDrones) {
    const corteFiltro = map(densidad, 0, 1, 380, 750, true);
    filtroDrones.freq(corteFiltro);
  }

  for (let i = 0; i < dronesGrave.length; i++) {
    const d = dronesGrave[i];
    const marea = map(sin(frameCount * 0.0004 + d.seed), -1, 1, 0.6, 1.0);
    const ampFinal = d.maxAmp * factorDucking * marea * ((i === 0) ? vGrave : vDrone);
    d.osc.amp(ampFinal, 0.2);
  }
}