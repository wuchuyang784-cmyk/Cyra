export class LipSyncPlayer {
  constructor({ avatar }) {
    this.avatar = avatar;
    this.audio = new Audio();
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.animationFrame = null;
  }

  async play(blob) {
    this.stop();
    const url = URL.createObjectURL(blob);
    this.audio = new Audio(url);
    this.audio.onended = () => {
      URL.revokeObjectURL(url);
      this.stop();
    };
    this.audio.onerror = () => {
      URL.revokeObjectURL(url);
      this.stop();
    };

    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 1024;
    this.source = this.audioContext.createMediaElementSource(this.audio);
    this.source.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);

    this.avatar.setSpeaking(true);
    this.trackAmplitude();
    await this.audio.play();
  }

  stop() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
    this.animationFrame = null;
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.avatar.setSpeaking(false);
    this.avatar.setMouthOpen(0);
  }

  trackAmplitude() {
    const data = new Uint8Array(this.analyser.fftSize);
    const tick = () => {
      this.analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const value of data) {
        const centered = (value - 128) / 128;
        sum += centered * centered;
      }
      const rms = Math.sqrt(sum / data.length);
      const mouthAmount = Math.min(1, Math.max(0, (rms - 0.02) * 8));
      this.avatar.setMouthOpen(mouthAmount);
      this.animationFrame = requestAnimationFrame(tick);
    };
    tick();
  }
}
