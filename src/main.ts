import './style.css';
import { Board } from './Board';
import { audio } from './Audio';
import { PowerUpType } from './PowerUps';

class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private board!: Board;
  private scoreElement: HTMLElement;
  private musicBtn: HTMLElement;
  private energySlots: NodeListOf<HTMLElement>;
  private powerUpBtns: NodeListOf<HTMLButtonElement>;

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
    this.powerUpBtns = document.querySelectorAll('.powerup-btn');

    this.setupGame();
    this.setupEventListeners();
    this.setupMusicButton();
    this.setupPowerUpButtons();
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
      onEnergyChange: (energy) => this.updateEnergy(energy),
      onPowerUpUsed: (type) => this.onPowerUpUsed(type),
    });

    this.canvas.width = this.board.getWidth();
    this.canvas.height = this.board.getHeight();
    this.canvas.style.width = `${this.board.getWidth()}px`;
    this.canvas.style.height = `${this.board.getHeight()}px`;

    // Reset UI
    this.updateEnergy(0);
  }

  private setupMusicButton(): void {
    this.musicBtn.addEventListener('click', () => {
      audio.ensureStarted();
      const isPlaying = audio.toggleMusic();
      this.musicBtn.textContent = isPlaying ? '🔊' : '🔇';
      this.musicBtn.classList.toggle('active', isPlaying);
    });
  }

  private setupPowerUpButtons(): void {
    this.powerUpBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const typeStr = btn.dataset.type;
        if (!typeStr) return;

        const type = this.getPowerUpType(typeStr);
        if (!type) return;

        // Se já está ativo, cancela
        if (btn.classList.contains('active')) {
          this.board.cancelPowerUpMode();
          this.updatePowerUpButtons();
          return;
        }

        // Tenta ativar
        if (this.board.activatePowerUpMode(type)) {
          audio.playSwap();
          this.updatePowerUpButtons();
        }
      });
    });
  }

  private getPowerUpType(str: string): PowerUpType | null {
    switch (str) {
      case 'bomb': return PowerUpType.BOMB;
      case 'shuffle': return PowerUpType.SHUFFLE;
      case 'lightning': return PowerUpType.LIGHTNING;
      case 'rainbow': return PowerUpType.RAINBOW;
      default: return null;
    }
  }

  private updateEnergy(energy: number): void {
    this.energySlots.forEach((slot, i) => {
      slot.classList.toggle('filled', i < energy);
    });
    this.updatePowerUpButtons();
  }

  private updatePowerUpButtons(): void {
    const energy = this.board.getEnergy();
    const activePowerUp = this.board.getActivePowerUp();

    this.powerUpBtns.forEach(btn => {
      const cost = parseInt(btn.dataset.cost || '0');
      const typeStr = btn.dataset.type;
      const type = typeStr ? this.getPowerUpType(typeStr) : null;
      
      const canUse = energy >= cost && !this.board.isSelectingTarget();
      btn.disabled = !canUse;
      btn.classList.toggle('available', canUse);
      btn.classList.toggle('active', activePowerUp === type);
    });
  }

  private onPowerUpUsed(_type: PowerUpType): void {
    audio.playPowerUp();
    this.updatePowerUpButtons();
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

    // Se selecionando alvo de power-up, não faz swipe
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
      this.updatePowerUpButtons();
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
