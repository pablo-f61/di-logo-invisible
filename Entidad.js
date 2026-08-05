class Entidad {
  constructor(x, y, rssi = -70) {
    this.x = x;
    this.y = y;

    this.vx = random(-0.4, 0.4);
    this.vy = random(-0.4, 0.4);

    this.tam = random(4, 8);
    this.seed = random(1000);
    this.velBase = random(0.3, 0.8);

    this.energia = 0;
    this.nacimiento = millis();
    this.opacidad = 1;

    this.rssi = constrain(rssi, -100, -30);
    this.vidaTotal = map(this.rssi, -100, -30, 20000, 8000);

    this.factorCercania = map(this.rssi, -100, -30, 0.7, 2.2);

    console.log("RSSI:", this.rssi, "-> factorCercania:", this.factorCercania);
}
 
    mover() {
        const n = noise(
            this.x * 0.002,
            this.y * 0.002,
            frameCount * 0.0008 + this.seed,
        );
        const angulo = n * TWO_PI * 2;
 
        this.vx += cos(angulo) * 0.015;
        this.vy += sin(angulo) * 0.015;
 
        this.vx *= 0.98;
        this.vy *= 0.98;
 
        this.x += this.vx * this.velBase * params.velGlobal;
        this.y += this.vy * this.velBase * params.velGlobal;
 
        if (this.x < 0 || this.x > width) this.vx *= -1;
        if (this.y < 0 || this.y > height) this.vy *= -1;
 
        this.energia *= 0.9;
    }
 
    dibujar() {
        noStroke();
 
        for (let i = 5; i > 0; i--) {
            fill(255, 15 * this.opacidad * params.brilloParticulas);
            ellipse(
                this.x,
                this.y,
                this.tam * i * 1.4 * params.tamanoBase * this.factorCercania,
            );
        }
 
        const brillo = constrain(this.energia, 0, 1);
 
        const alpha =
            map(brillo, 0, 1, 60, 200) * this.opacidad * params.brilloParticulas;
        const tamNucleo =
            this.tam *
            map(brillo, 0, 1, 0.6, 1.5) *
            params.tamanoBase *
            this.factorCercania;
 
        fill(255, alpha);
        ellipse(this.x, this.y, tamNucleo);
    }
}
