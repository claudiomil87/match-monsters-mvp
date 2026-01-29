// Sistema de áudio 8-bit usando Web Audio API
export class AudioManager {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private isMusicPlaying: boolean = false;
  private musicInterval: number | null = null;
  private currentNote: number = 0;
  
  // Melodia estilo Tetris/Korobeiniki - versão relaxada
  private melody: { freq: number; duration: number }[] = [
    // Tema principal (loop) - mais lento e calmo
    { freq: 659, duration: 0.4 },  // E5
    { freq: 494, duration: 0.2 },  // B4
    { freq: 523, duration: 0.2 },  // C5
    { freq: 587, duration: 0.4 },  // D5
    { freq: 523, duration: 0.2 },  // C5
    { freq: 494, duration: 0.2 },  // B4
    { freq: 440, duration: 0.4 },  // A4
    { freq: 440, duration: 0.2 },  // A4
    { freq: 523, duration: 0.2 },  // C5
    { freq: 659, duration: 0.4 },  // E5
    { freq: 587, duration: 0.2 },  // D5
    { freq: 523, duration: 0.2 },  // C5
    { freq: 494, duration: 0.6 },  // B4
    { freq: 523, duration: 0.2 },  // C5
    { freq: 587, duration: 0.4 },  // D5
    { freq: 659, duration: 0.4 },  // E5
    { freq: 523, duration: 0.4 },  // C5
    { freq: 440, duration: 0.4 },  // A4
    { freq: 440, duration: 0.6 },  // A4
    { freq: 0, duration: 0.3 },    // Pausa
    { freq: 587, duration: 0.4 },  // D5
    { freq: 698, duration: 0.2 },  // F5
    { freq: 880, duration: 0.4 },  // A5
    { freq: 784, duration: 0.2 },  // G5
    { freq: 698, duration: 0.2 },  // F5
    { freq: 659, duration: 0.6 },  // E5
    { freq: 523, duration: 0.2 },  // C5
    { freq: 659, duration: 0.4 },  // E5
    { freq: 587, duration: 0.2 },  // D5
    { freq: 523, duration: 0.2 },  // C5
    { freq: 494, duration: 0.4 },  // B4
    { freq: 494, duration: 0.2 },  // B4
    { freq: 523, duration: 0.2 },  // C5
    { freq: 587, duration: 0.4 },  // D5
    { freq: 659, duration: 0.4 },  // E5
    { freq: 523, duration: 0.4 },  // C5
    { freq: 440, duration: 0.4 },  // A4
    { freq: 440, duration: 0.6 },  // A4
    { freq: 0, duration: 0.4 },    // Pausa
  ];

  constructor() {
    // Lazy init on first user interaction
  }

  private init(): void {
    if (this.ctx) return;
    
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Gain nodes para controle de volume
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.15; // Música mais baixa
    this.musicGain.connect(this.ctx.destination);
    
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.3;
    this.sfxGain.connect(this.ctx.destination);
  }

  public ensureStarted(): void {
    this.init();
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Som de swap (movimento de peça)
  public playSwap(): void {
    this.init();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(500, this.ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(this.sfxGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  // Som de match (combinação)
  public playMatch(): void {
    this.init();
    if (!this.ctx || !this.sfxGain) return;

    const notes = [523, 659, 784]; // C5, E5, G5 - acorde maior
    
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      
      osc.type = 'square';
      osc.frequency.value = freq;
      
      const startTime = this.ctx!.currentTime + i * 0.05;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);
      
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      
      osc.start(startTime);
      osc.stop(startTime + 0.2);
    });
  }

  // Som de combo/cascata (mais épico)
  public playCombo(level: number = 1): void {
    this.init();
    if (!this.ctx || !this.sfxGain) return;

    const baseFreq = 400 + (level * 100);
    
    for (let i = 0; i < 4; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.value = baseFreq + (i * 150);
      
      const startTime = this.ctx.currentTime + i * 0.03;
      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
      
      osc.connect(gain);
      gain.connect(this.sfxGain);
      
      osc.start(startTime);
      osc.stop(startTime + 0.3);
    }
  }

  // Som de peças caindo
  public playDrop(): void {
    this.init();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.15);
    
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(this.sfxGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  // Som de movimento inválido
  public playInvalid(): void {
    this.init();
    if (!this.ctx || !this.sfxGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.setValueAtTime(100, this.ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
    
    osc.connect(gain);
    gain.connect(this.sfxGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  // Música de fundo
  public startMusic(): void {
    if (this.isMusicPlaying) return;
    this.init();
    if (!this.ctx || !this.musicGain) return;

    this.isMusicPlaying = true;
    this.currentNote = 0;
    this.playNextNote();
  }

  private playNextNote(): void {
    if (!this.isMusicPlaying || !this.ctx || !this.musicGain) return;

    const note = this.melody[this.currentNote];
    
    if (note.freq > 0) {
      // Melodia principal
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'square';
      osc.frequency.value = note.freq;
      
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime + note.duration * 0.8);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + note.duration);
      
      osc.connect(gain);
      gain.connect(this.musicGain);
      
      osc.start();
      osc.stop(this.ctx.currentTime + note.duration);

      // Bass note (oitava abaixo)
      const bassOsc = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();
      
      bassOsc.type = 'triangle';
      bassOsc.frequency.value = note.freq / 2;
      
      bassGain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      bassGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + note.duration);
      
      bassOsc.connect(bassGain);
      bassGain.connect(this.musicGain);
      
      bassOsc.start();
      bassOsc.stop(this.ctx.currentTime + note.duration);
    }

    this.currentNote = (this.currentNote + 1) % this.melody.length;
    
    this.musicInterval = window.setTimeout(() => {
      this.playNextNote();
    }, note.duration * 1000);
  }

  public stopMusic(): void {
    this.isMusicPlaying = false;
    if (this.musicInterval) {
      clearTimeout(this.musicInterval);
      this.musicInterval = null;
    }
  }

  public toggleMusic(): boolean {
    if (this.isMusicPlaying) {
      this.stopMusic();
    } else {
      this.startMusic();
    }
    return this.isMusicPlaying;
  }

  public setMusicVolume(volume: number): void {
    if (this.musicGain) {
      this.musicGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  public setSfxVolume(volume: number): void {
    if (this.sfxGain) {
      this.sfxGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  public isMusicOn(): boolean {
    return this.isMusicPlaying;
  }
}

// Singleton
export const audio = new AudioManager();
