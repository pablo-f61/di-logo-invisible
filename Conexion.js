class Conexion {
  constructor(a, b, distancia) {
    this.a = a;
    this.b = b;
    this.distancia = distancia;
    this.vida = 1.0;
    this.brilloFlash = 0.0;
    this.seed = random(1000);
  }

  destellar() {
    this.brilloFlash = 1.0;
  }

  // Lógica (se llama siempre, se dibuje o no localmente).
  // Antes el decaimiento vivía en dibujar(): con "Ver dibujo local" apagado
  // el flash nunca bajaba y el proyector recibía brilloFlash = 1.0 fijo.
  actualizar() {
    this.brilloFlash *= 0.88;
    if (this.brilloFlash < 0.01) this.brilloFlash = 0;
  }

  dibujar() {
    const distRef = (typeof params !== "undefined" && params.distConexion) ? params.distConexion : 160;
    const opacidadBase = map(this.distancia, 0, distRef, 180, 20);

    const alphaFinal = constrain(
      (opacidadBase * this.vida * params.opacidadLineas) + (this.brilloFlash * 255),
      0,
      255
    );

    const grosor = map(this.brilloFlash, 0, 1, 0.9, 3.2);

    stroke(255, constrain(alphaFinal, 0, 255));
    strokeWeight(grosor);
    line(this.a.x, this.a.y, this.b.x, this.b.y);
  }
}