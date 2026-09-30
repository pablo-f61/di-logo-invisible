const canal = new BroadcastChannel('instalacion_dialogo');

let entidadesRecibidas = [];
let conexionesRecibidas = [];

const params = {
  distConexion: 160,
  opacidadLineas: 3.0,
  tamanoBase: 1.0,
  brilloParticulas: 1.0
};

function setup() {
  createCanvas(windowWidth, windowHeight);

  canal.onmessage = (event) => {
    const data = event.data;

    if (data.tipo === 'SYNC_FRAME') {
      entidadesRecibidas = data.entidades || [];
      conexionesRecibidas = data.conexiones || [];
      if (data.params) {
        Object.assign(params, data.params);
      }
    } else if (data.tipo === 'LIMPIAR_TODO') {
      entidadesRecibidas = [];
      conexionesRecibidas = [];
    }
  };
}

function draw() {
  background(0,45);

  // 1. Dibujar conexiones sincronizadas
  for (const c of conexionesRecibidas) {
    const ax = c.nax * width;
    const ay = c.nay * height;
    const bx = c.nbx * width;
    const by = c.nby * height;

    const d = dist(ax, ay, bx, by);
    const alphaBase = map(d, 0, params.distConexion, 180, 20);
    const alphaFinal = constrain(
      (alphaBase * c.vida * params.opacidadLineas) + ((c.brilloFlash || 0) * 255),
      0,
      255
    );

    const grosor = map(c.brilloFlash || 0, 0, 1, 0.9, 3.2);

    stroke(255, constrain(alphaFinal, 0, 255));
    strokeWeight(grosor);
    noFill();

    beginShape();
    const pasos = 10;
    for (let i = 0; i <= pasos; i++) {
      const t = i / pasos;
      let x = lerp(ax, bx, t);
      let y = lerp(ay, by, t);

      const n = noise(x * 0.01, y * 0.01, frameCount * 0.01 + c.seed);
      const offset = map(n, 0, 1, -10, 10);

      const angle = atan2(by - ay, bx - ax);
      const perp = angle + HALF_PI;

      x += cos(perp) * offset * sin(t * PI);
      y += sin(perp) * offset * sin(t * PI);

      curveVertex(x, y);
    }
    endShape();
  }

  // 2. Dibujar entidades sincronizadas (Estética de núcleos y halos)
  noStroke();
  for (const e of entidadesRecibidas) {
    const px = e.nx * width;
    const py = e.ny * height;
    const escala = e.escala !== undefined ? e.escala : 1.0;
    const tamEscalado = e.tamBase * params.tamanoBase * e.factorCercania * escala;
    const brilloSonoro = e.brilloSonoro || 0;

    const maduracion = constrain(e.madurez || 0, 0, 1);
    
    const r = lerp(70, 50, maduracion);
    const g = lerp(235, 130, maduracion);
    const b = lerp(150, 255, maduracion);

    const potenciaHalo = map(maduracion, 0, 1, 14, 34);
    for (let i = 5; i > 0; i--) {
      fill(r, g, b, potenciaHalo * e.opacidad * params.brilloParticulas * 0.22);
      ellipse(px, py, tamEscalado * i * 1.35);
    }

    const alphaNucleo = map(brilloSonoro, 0, 1, 90, 255) * min(1.0, e.opacidad) * params.brilloParticulas;
    const tamNucleo = max(1.5, tamEscalado * map(brilloSonoro, 0, 1, 0.6, 2.0));

    if (brilloSonoro > 0.05) {
      fill(255, 255, 255, brilloSonoro * 150 * params.brilloParticulas);
      ellipse(px, py, tamNucleo * 2.2);
    }

    fill(255, constrain(alphaNucleo, 0, 255));
    ellipse(px, py, tamNucleo);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function keyPressed() {
  if (key === 'f' || key === 'F') {
    alternarFullscreen();
    return;
  }

  canal.postMessage({
    tipo: 'COMANDO_TECLA',
    tecla: key
  });
}

function doubleClicked() {
  alternarFullscreen();
}

function alternarFullscreen() {
  const fs = fullscreen();
  fullscreen(!fs);
}