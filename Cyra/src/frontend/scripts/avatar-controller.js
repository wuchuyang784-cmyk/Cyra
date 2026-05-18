const frames = {
  eyesClosed: "./assets/characters/xuanzang/eyes-closed-layer.png",
  mouthHalf: "./assets/characters/xuanzang/mouth-half-layer.png",
  mouthOpen: "./assets/characters/xuanzang/mouth-open-layer.png",
};

Object.values(frames).forEach((src) => {
  const img = new Image();
  img.src = src;
});

export class AvatarController {
  constructor({ stage, eyeLayer, mouthLayer }) {
    this.stage = stage;
    this.eyeLayer = eyeLayer;
    this.mouthLayer = mouthLayer;
    this.blinkTimer = null;
    this.mouthTimer = null;
    this.startIdleBlink();
  }

  setSpeaking(isSpeaking) {
    this.stage.dataset.speaking = String(isSpeaking);
    if (isSpeaking) {
      this.startMouthLoop();
    } else {
      this.startIdleBlink();
    }
  }

  setExpression(expression) {
    this.stage.dataset.expression = expression || "neutral";
  }

  setMouthOpen(amount) {
    const level = Math.max(0, Math.min(1, amount));
    this.mouthLayer.classList.toggle("is-visible", level > 0.08);
    this.mouthLayer.src = level > 0.55 ? frames.mouthOpen : frames.mouthHalf;
  }

  stopTimers() {
    window.clearInterval(this.blinkTimer);
    window.clearInterval(this.mouthTimer);
    this.blinkTimer = null;
    this.mouthTimer = null;
  }

  startIdleBlink() {
    this.stopTimers();
    this.mouthLayer.classList.remove("is-visible");
    this.eyeLayer.classList.remove("is-visible");
    this.blinkTimer = window.setInterval(() => {
      this.eyeLayer.classList.add("is-visible");
      window.setTimeout(() => {
        if (this.stage.dataset.speaking === "false") {
          this.eyeLayer.classList.remove("is-visible");
        }
      }, 95);
    }, 3200);
  }

  startMouthLoop() {
    this.stopTimers();
    let open = false;
    this.eyeLayer.classList.remove("is-visible");
    this.mouthLayer.src = frames.mouthHalf;
    this.mouthLayer.classList.add("is-visible");
    this.mouthTimer = window.setInterval(() => {
      open = !open;
      this.mouthLayer.src = open ? frames.mouthOpen : frames.mouthHalf;
    }, 180);
  }
}
