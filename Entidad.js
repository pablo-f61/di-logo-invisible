class Entidad {
  constructor(x, y, rssi = -70, mac = "", esEspora = false, anguloInicial = null) {
    this.mac = mac;
    this.x = x;
    this.y = y;
    this.esEspora = esEspora;

    this.seed = random(10000);
    this.tiempoRuido = random(1000);
    this.angulo = anguloInicial !== null ? anguloInicial : random(TWO_PI);
    
    this.tamBase = esEspora ? random(10, 15) : random(16, 24);
    this.brilloSonoro = 0.0; 
    
    this.opacidadBase = 0.35; 
    this.opacidad = 1.0;
    // Madurez 0..1: 0 = recién nacido, 1 = tamaño máximo (se reproduce).
    // Sube con cada probe (o con cada conexión, en las esporas) y baja muy despacio.
    this.madurez = 0.0;
    this.madurezVisual = 0.0;     // versión suavizada de la madurez: es la que se ve (crece de a poco, sin saltos)
    this.generacion = 0;          // 0 = original; las esporas suben de generación al reproducirse
    this.reproducciones = 0;      // cuántas veces se reprodujo (las esporas tienen un máximo)
    this.llegoAlMax = false;      // se activa al llegar a madurez 1 (no se pierde por el decaimiento)
    this.tUlt = millis();
    this.energia = 1.0;
    this.muerta = false;

    // Ciclo de vida: la entidad vive mientras siga recibiendo probes.
    this.ultimoProbe = millis();
    this.forzadaAMorir = false;
    this.desvaneciendo = false;   // true = se está yendo (por inactividad o por tope)
    this.velDesvanecer = 0.008;   // opacidad perdida por frame al desvanecerse

    if (typeof ESCALA_BASE_CONSONANTE !== "undefined" && ESCALA_BASE_CONSONANTE.length > 0) {
      this.frecuencia = random(ESCALA_BASE_CONSONANTE);
    } else {
      this.frecuencia = 146.83;
    }
    
    this.actualizarRSSI(rssi);

    this.rangoVelRapida = esEspora ? random(1.6, 2.2) : random(1.0, 1.5);
    this.rangoVelLenta = random(0.3, 0.6);
    this.velBase = this.rangoVelRapida;
  }

  get maduracion() {
    return constrain(this.madurez, 0, 1);
  }

  // Escala de tamaño: de params.tamNacimiento (recién nacido) a params.tamMaximo (listo para reproducirse).
  get escalaTamano() {
    const nac = (typeof params !== "undefined" && params.tamNacimiento !== undefined) ? params.tamNacimiento : 0.3;
    const maxi = (typeof params !== "undefined" && params.tamMaximo !== undefined) ? params.tamMaximo : 3.5;
    return lerp(nac, maxi, constrain(this.madurezVisual, 0, 1));
  }

  // Ya llegó al máximo Y se ve en su tamaño máximo (así se la ve crecer hasta el final antes de reproducirse).
  get listaParaReproducir() {
    return !this.desvaneciendo && this.llegoAlMax && this.madurezVisual >= 0.97;
  }

  // Le toca reproducirse (la madre sigue viva y suelta células nuevas).
  // Las entidades ligadas a un dispositivo se reproducen siempre; las esporas hasta params.maxGeneraciones.
  puedeReproducirse() {
    if (!this.listaParaReproducir) return false;
    if (!this.esEspora) return true;
    const limite = (typeof params !== "undefined" && params.maxGeneraciones !== undefined) ? params.maxGeneraciones : 2;
    const maxRep = (typeof params !== "undefined" && params.maxReproduccionesEspora !== undefined) ? params.maxReproduccionesEspora : 1;
    return this.generacion < limite && this.reproducciones < maxRep;
  }

  actualizarRSSI(rssi) {
    this.rssi = constrain(rssi, -100, -30);
    this.factorCercania = map(this.rssi, -100, -30, 0.8, 1.7);
  }

  registrarProbe(rssi) {
    this.actualizarRSSI(rssi);
    const porProbe = (typeof params !== "undefined" && params.crecimientoPorProbe !== undefined) ? params.crecimientoPorProbe : 0.25;
    this.madurez = min(1.0, this.madurez + porProbe);
    if (this.madurez >= 1.0) this.llegoAlMax = true;
    this.brilloSonoro = 1.0;

    // Un probe nuevo renueva la vida (y frena un desvanecimiento por inactividad).
    this.ultimoProbe = millis();
    if (!this.forzadaAMorir) this.desvaneciendo = false;
  }

  alimentar() {
    if (this.esEspora) {
      const porConexion = (typeof params !== "undefined" && params.crecimientoPorConexion !== undefined) ? params.crecimientoPorConexion : 0.004;
      this.madurez = min(1.0, this.madurez + porConexion);
      if (this.madurez >= 1.0) this.llegoAlMax = true;
      // Las esporas no reciben probes propios: viven mientras se conecten.
      this.ultimoProbe = millis();
      if (!this.forzadaAMorir) this.desvaneciendo = false;
    }
  }

  // Desvanecimiento forzado (por ejemplo, al superar el máximo de entidades).
  morir(vel = 0.03) {
    this.forzadaAMorir = true;
    this.desvaneciendo = true;
    this.velDesvanecer = vel;
  }

  actualizar(ahora) {
    // --- Ciclo de vida ---
    const vidaMs = (params.vidaEntidad !== undefined ? params.vidaEntidad : 60) * 1000;
    if (!this.desvaneciendo && ahora - this.ultimoProbe > vidaMs) {
      this.desvaneciendo = true;
    }
    if (this.desvaneciendo) {
      this.opacidad = max(0, this.opacidad - this.velDesvanecer);
      if (this.opacidad <= 0.02) this.muerta = true;
    } else {
      // Reaparición suave si estaba a medio desvanecer y llegó un probe.
      this.opacidad = min(1.0, this.opacidad + 0.05);
    }

    this.brilloSonoro *= 0.86;

    // Decaimiento lento de la madurez, en tiempo real (no depende del framerate).
    const dt = min(0.1, (ahora - this.tUlt) / 1000);
    this.tUlt = ahora;
    const decae = (params.decaimientoMadurez !== undefined ? params.decaimientoMadurez : 0.004);
    this.madurez = max(0, this.madurez - decae * dt);

    // La madurez que se dibuja persigue a la real con una transición suave (~1 s),
    // así cada probe hace crecer a la entidad de a poco en vez de dar un salto.
    this.madurezVisual += (this.madurez - this.madurezVisual) * (1 - Math.exp(-dt * 3));

    // Al madurar se vuelven más lentas.
    this.velBase = lerp(this.rangoVelRapida, this.rangoVelLenta, this.maduracion);
    
    this.tiempoRuido += 0.004 * params.velGlobal;
    const variacionAngular = map(noise(this.tiempoRuido + this.seed), 0, 1, -0.06, 0.06);
    this.angulo += variacionAngular;

    const centroX = width * 0.5;
    const centroY = height * 0.5;
    
    if (dist(this.x, this.y, centroX, centroY) > height * 0.4) {
      const anguloAlCentro = atan2(centroY - this.y, centroX - this.x);
      this.angulo = lerp(this.angulo, anguloAlCentro, 0.02);
    }

    const velocidadActual = this.velBase * params.velGlobal;
    this.x += cos(this.angulo) * velocidadActual;
    this.y += sin(this.angulo) * velocidadActual;

    if (this.x < 50) { this.x = 50; this.angulo = random(-PI/2, PI/2); }
    if (this.x > width - 50) { this.x = width - 50; this.angulo = random(PI/2, PI*1.5); }
    if (this.y < 50) { this.y = 50; this.angulo = random(0, PI); }
    if (this.y > height - 50) { this.y = height - 50; this.angulo = random(-PI, 0); }
  }

  dibujar() {
    const tam = this.tamBase * params.tamanoBase * this.factorCercania * this.escalaTamano;
    const brillo = this.brilloSonoro;
    const maduracion = constrain(this.madurezVisual, 0, 1);
    
    // Gradiente de color según maduración (Verde a Azul como en tu versión original de esferas)
    const r = lerp(70, 50, maduracion);
    const g = lerp(235, 130, maduracion);
    const b = lerp(150, 255, maduracion);

    noStroke();

    // Halos exteriores difusos
    const potenciaHalo = map(maduracion, 0, 1, 14, 34);
    for (let i = 5; i > 0; i--) {
      fill(r, g, b, potenciaHalo * this.opacidad * params.brilloParticulas * 0.22);
      ellipse(this.x, this.y, tam * i * 1.35);
    }

    // Destello de luz expansivo al sonar
    const alphaNucleo = map(brillo, 0, 1, 90, 255) * min(1.0, this.opacidad) * params.brilloParticulas;
    const tamNucleo = max(1.5, tam * map(brillo, 0, 1, 0.6, 2.0));   // piso para que un recién nacido no desaparezca

    if (brillo > 0.05) {
      fill(255, 255, 255, brillo * 150 * params.brilloParticulas);
      ellipse(this.x, this.y, tamNucleo * 2.2);
    }

    // Núcleo central sólido
    fill(255, constrain(alphaNucleo, 0, 255));
    ellipse(this.x, this.y, tamNucleo);
  }
}