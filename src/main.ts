import './style.css';
import { Board } from './Board';
import { audio } from './Audio';
import { PowerUpConfig } from './PowerUps';

class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private board!: Board;
  private scoreElement: HTMLElement;
  private musicBtn: HTMLElement;
  private energySlots: NodeListOf<HTMLElement>;
  private powerUpBtn: HTMLButtonElement;
  private powerUpMystery: HTMLElement;
  private powerUpReveal: HTMLElement;
  private powerUpHint: HTMLElement;

  private readonly COLS = 7;
  private readonly ROWS = 5;

  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private touchStartTime: number = 0;
  private isDragging: boolean = false;
  private dragThreshold: number = 20;

  constructor() {
    this.canvas = document.getElementById('game') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.scoreElement = document.getElementById('score')!;
    this.musicBtn = document.getElementById('music-btn')!;
    this.energySlots = document.querySelectorAll('.energy-slot');
    this.powerUpBtn = document.getElementById('powerup-btn') as HTMLButtonElement;
    this.powerUpMystery = this.powerUpBtn.querySelector('.powerup-mystery')!;
    this.powerUpReveal = this.powerUpBtn.querySelector('.powerup-reveal')!;
    this.powerUpHint = document.querySelector('.powerup-hint')!;

    this.setupGame();
    this.setupEventListeners();
    this.setupMusicButton();
    this.setupPowerUpButton();
    this.gameLoop();

    window.addEventListener('resize', () => this.setupGame());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.setupGame(), 100);
    });
  }

  private setupGame(): void {
    const maxWidth = Math.min(window.innerWidth - 32, 420);
    const cellSize = Math.floor(maxWidth / this.COLS);
    
    this.board = new Board(this.ROWS, this.COLS, cellSize, {
      onScoreChange: (score) => this.updateScore(score),
      onSwap: () => audio.playSwap(),
      onMatch: () => audio.playMatch(),
      onCombo: (level) => audio.playCombo(level),
      onDrop: () => audio.playDrop(),
      onInvalidMove: () => audio.playInvalid(),
      onNoMoves: () => audio.playNoMoves(),
      onPowerUp: () => audio.playPowerUp(),
      onHint: () => audio.playHint(),
      onEnergyChange: (energy, _powerUp) => this.updateEnergy(energy),
      onPowerUpReady: (powerUp) => this.onPowerUpReady(powerUp),
      onPowerUpUsed: () => this.onPowerUpUsed(),
    });

    this.canvas.width = this.board.getWidth();
    this.canvas.height = this.board.getHeight();
    this.canvas.style.width = `${this.board.getWidth()}px`;
    this.canvas.style.height = `${this.board.getHeight()}px`;

    this.updateEnergy(0);
    this.resetPowerUpButton();
  }

  private setupMusicButton(): void {
    this.musicBtn.addEventListener('click', () => {
      audio.ensureStarted();
      const isPlaying = audio.toggleMusic();
      this.musicBtn.textContent = isPlaying ? '🔊' : '🔇';
      this.musicBtn.classList.toggle('active', isPlaying);
    });
  }

  private setupPowerUpButton(): void {
    this.powerUpBtn.addEventListener('click', () => {
      if (!this.board.hasPowerUp()) return;

      // Se já está ativo (selecionando alvo), cancela
      if (this.powerUpBtn.classList.contains('active')) {
        this.board.cancelPowerUpMode();
        this.powerUpBtn.classList.remove('active');
        this.powerUpHint.classList.remove('selecting');
        const powerUp = this.board.getStoredPowerUp();
        this.powerUpHint.textContent = powerUp ? `${powerUp.name}! Toque!` : 'Toque para usar!';
        return;
      }

      // Ativa o power-up
      if (this.board.activateStoredPowerUp()) {
        audio.playSwap();
        this.powerUpBtn.classList.add('active');
        
        const powerUp = this.board.getStoredPowerUp();
        if (powerUp?.type === 'shuffle') {
          this.powerUpHint.textContent = 'Embaralhando...';
        } else {
          this.powerUpHint.textContent = '👆 Toque no alvo!';
          this.powerUpHint.classList.add('selecting');
        }
      }
    });
  }

  private updateEnergy(energy: number): void {
    this.energySlots.forEach((slot, i) => {
      slot.classList.toggle('filled', i < energy);
    });
  }

  private onPowerUpReady(powerUp: PowerUpConfig): void {
    // Revela o power-up com animação
    audio.playCombo(2);
    
    this.powerUpMystery.style.display = 'none';
    this.powerUpReveal.style.display = 'block';
    this.powerUpReveal.textContent = powerUp.emoji;
    
    this.powerUpBtn.disabled = false;
    this.powerUpBtn.classList.add('ready');
    this.powerUpHint.textContent = `${powerUp.name}! Toque!`;
  }

  private onPowerUpUsed(): void {
    audio.playPowerUp();
    this.resetPowerUpButton();
  }

  private resetPowerUpButton(): void {
    this.powerUpBtn.disabled = true;
    this.powerUpBtn.classList.remove('ready', 'active');
    this.powerUpMystery.style.display = 'block';
    this.powerUpReveal.style.display = 'none';
    this.powerUpHint.textContent = 'Match 4+ para carregar!';
    this.powerUpHint.classList.remove('selecting');
  }

  private setupEventListeners(): void {
    const initAudio = () => {
      audio.ensureStarted();
      document.removeEventListener('touchstart', initAudio);
      document.removeEventListener('click', initAudio);
    };
    document.addEventListener('touchstart', initAudio, { once: true });
    document.addEventListener('click', initAudio, { once: true });

    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => this.handleTouchStart(e.clientX, e.clientY));
    this.canvas.addEventListener('mousemove', (e) => {
      if (this.isDragging) this.handleTouchMove(e.clientX, e.clientY);
    });
    this.canvas.addEventListener('mouseup', (e) => this.handleTouchEnd(e.clientX, e.clientY));
    this.canvas.addEventListener('mouseleave', () => this.cancelDrag());

    // Touch events
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.handleTouchStart(touch.clientX, touch.clientY);
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.handleTouchMove(touch.clientX, touch.clientY);
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      this.handleTouchEnd(touch.clientX, touch.clientY);
    }, { passive: false });

    this.canvas.addEventListener('touchcancel', () => this.cancelDrag());
  }

  private getCanvasCoords(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  private handleTouchStart(clientX: number, clientY: number): void {
    this.touchStartX = clientX;
    this.touchStartY = clientY;
    this.touchStartTime = Date.now();
    this.isDragging = true;

    const coords = this.getCanvasCoords(clientX, clientY);
    this.board.setDragStart(coords.x, coords.y);
  }

  private handleTouchMove(clientX: number, clientY: number): void {
    if (!this.isDragging) return;

    if (this.board.isSelectingTarget()) return;

    const deltaX = clientX - this.touchStartX;
    const deltaY = clientY - this.touchStartY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance >= this.dragThreshold) {
      let direction: 'left' | 'right' | 'up' | 'down';
      
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        direction = deltaX > 0 ? 'right' : 'left';
      } else {
        direction = deltaY > 0 ? 'down' : 'up';
      }

      const coords = this.getCanvasCoords(this.touchStartX, this.touchStartY);
      this.board.swipeGem(coords.x, coords.y, direction);
      this.cancelDrag();
    }
  }

  private handleTouchEnd(clientX: number, clientY: number): void {
    if (!this.isDragging) return;

    const deltaX = clientX - this.touchStartX;
    const deltaY = clientY - this.touchStartY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const elapsed = Date.now() - this.touchStartTime;

    if (distance < this.dragThreshold && elapsed < 300) {
      const coords = this.getCanvasCoords(clientX, clientY);
      this.board.handleClick(coords.x, coords.y);
      
      // Atualiza UI após usar power-up
      if (!this.board.hasPowerUp()) {
        this.resetPowerUpButton();
      }
      if (!this.board.isSelectingTarget()) {
        this.powerUpBtn.classList.remove('active');
      }
    }

    this.cancelDrag();
  }

  private cancelDrag(): void {
    this.isDragging = false;
    this.board.clearDragStart();
  }

  private updateScore(score: number): void {
    this.scoreElement.textContent = score.toString();
    this.scoreElement.style.transform = 'scale(1.2)';
    setTimeout(() => {
      this.scoreElement.style.transform = 'scale(1)';
    }, 150);
  }

  private gameLoop = (): void => {
    this.render();
    requestAnimationFrame(this.gameLoop);
  };

  private render(): void {
    this.board.update();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.board.render(this.ctx);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new Game();
});
