import './style.css';
import { Board } from './Board';
import { audio } from './Audio';
import { PowerUpConfig } from './PowerUps';
import { GameMode, Player, VsAIState, createInitialVsAIState, DEFAULT_CONFIG } from './GameState';
import { AIPlayer } from './AIPlayer';
import { GemType } from './types';

class Game {
  private app: HTMLElement;
  private currentMode: GameMode = GameMode.MENU;
  
  // Solo mode
  private soloBoard: Board | null = null;
  private soloCanvas: HTMLCanvasElement | null = null;
  private soloCtx: CanvasRenderingContext2D | null = null;
  
  // VS AI mode
  private humanBoard: Board | null = null;
  private aiBoard: Board | null = null;
  private humanCanvas: HTMLCanvasElement | null = null;
  private aiCanvas: HTMLCanvasElement | null = null;
  private humanCtx: CanvasRenderingContext2D | null = null;
  private aiCtx: CanvasRenderingContext2D | null = null;
  private vsaiState: VsAIState | null = null;
  private turnTimer: number | null = null;
  private aiPlayer: AIPlayer = new AIPlayer();
  
  // Touch handling
  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private touchStartTime: number = 0;
  private isDragging: boolean = false;
  private dragThreshold: number = 20;
  
  private readonly COLS = 7;
  private readonly ROWS = 5;

  constructor() {
    this.app = document.getElementById('app')!;
    this.showMenu();
    this.gameLoop();
  }

  // ===== MENU =====
  private showMenu(): void {
    this.currentMode = GameMode.MENU;
    this.cleanup();
    
    this.app.innerHTML = `
      <div class="menu-screen">
        <div class="menu-content">
          <h1 class="menu-title">🎮 Match Monsters</h1>
          <p class="menu-subtitle">Escolha o modo de jogo</p>
          
          <div class="menu-buttons">
            <button class="menu-btn solo-btn" data-mode="solo">
              <span class="btn-emoji">🎯</span>
              <span class="btn-title">SOLO</span>
              <span class="btn-desc">Jogue no seu ritmo</span>
            </button>
            
            <button class="menu-btn vsai-btn" data-mode="vs_ai">
              <span class="btn-emoji">🤖</span>
              <span class="btn-title">VS IA</span>
              <span class="btn-desc">Turnos de ${DEFAULT_CONFIG.turnDuration}s • ${DEFAULT_CONFIG.winScore} pts</span>
            </button>
          </div>
          
          <p class="menu-footer">Criado por Cláudio 🤖</p>
        </div>
      </div>
    `;

    this.app.querySelectorAll('.menu-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        audio.ensureStarted();
        audio.playSwap();
        const mode = (btn as HTMLElement).dataset.mode;
        if (mode === 'solo') this.startSoloMode();
        else if (mode === 'vs_ai') this.startVsAIMode();
      });
    });
  }

  // ===== SOLO MODE =====
  private startSoloMode(): void {
    this.currentMode = GameMode.SOLO;
    this.renderSoloScreen();
  }

  private renderSoloScreen(): void {
    const maxWidth = Math.min(window.innerWidth - 32, 420);
    const cellSize = Math.floor(maxWidth / this.COLS);

    this.app.innerHTML = `
      <div class="game-screen solo-screen active">
        <div class="top-bar">
          <button class="back-btn" id="back-btn">←</button>
          <div class="score-board">
            <span class="score-label">PONTOS:</span>
            <span class="score-value" id="solo-score">0</span>
          </div>
          <button class="music-btn" id="music-btn">🔇</button>
        </div>

        <div class="powerup-section">
          <div class="energy-bar">
            <div class="energy-slot" data-index="0"></div>
            <div class="energy-slot" data-index="1"></div>
            <div class="energy-slot" data-index="2"></div>
            <div class="energy-slot" data-index="3"></div>
          </div>
          <button class="powerup-btn-big" id="powerup-btn" disabled>
            <span class="powerup-mystery">❓</span>
            <span class="powerup-reveal" style="display:none"></span>
          </button>
          <span class="powerup-hint" id="powerup-hint">Match 4+</span>
        </div>

        <div class="game-container">
          <canvas id="solo-canvas"></canvas>
        </div>

        <p class="instructions">👆 Arraste para mover | Match 4+ = energia!</p>
      </div>
    `;

    this.soloCanvas = document.getElementById('solo-canvas') as HTMLCanvasElement;
    this.soloCtx = this.soloCanvas.getContext('2d')!;

    this.soloBoard = new Board(this.ROWS, this.COLS, cellSize, {
      onScoreChange: (s) => this.updateSoloScore(s),
      onSwap: () => audio.playSwap(),
      onMatch: () => audio.playMatch(),
      onCombo: (l) => audio.playCombo(l),
      onDrop: () => audio.playDrop(),
      onInvalidMove: () => audio.playInvalid(),
      onNoMoves: () => audio.playNoMoves(),
      onPowerUp: () => audio.playPowerUp(),
      onHint: () => audio.playHint(),
      onEnergyChange: (e) => this.updateSoloEnergy(e),
      onPowerUpReady: (p) => this.onSoloPowerUpReady(p),
      onPowerUpUsed: () => this.onSoloPowerUpUsed(),
    });

    this.soloCanvas.width = this.soloBoard.getWidth();
    this.soloCanvas.height = this.soloBoard.getHeight();

    this.setupSoloEventListeners();
  }

  private setupSoloEventListeners(): void {
    document.getElementById('back-btn')?.addEventListener('click', () => {
      audio.playSwap();
      this.showMenu();
    });

    document.getElementById('music-btn')?.addEventListener('click', (e) => {
      audio.ensureStarted();
      const btn = e.target as HTMLElement;
      const isPlaying = audio.toggleMusic();
      btn.textContent = isPlaying ? '🔊' : '🔇';
      btn.classList.toggle('active', isPlaying);
    });

    document.getElementById('powerup-btn')?.addEventListener('click', () => {
      if (!this.soloBoard?.hasPowerUp()) return;
      const btn = document.getElementById('powerup-btn')!;
      const hint = document.getElementById('powerup-hint')!;
      
      if (btn.classList.contains('active')) {
        this.soloBoard.cancelPowerUpMode();
        btn.classList.remove('active');
        hint.classList.remove('selecting');
        const p = this.soloBoard.getStoredPowerUp();
        hint.textContent = p ? `${p.name}!` : 'Match 4+';
      } else if (this.soloBoard.activateStoredPowerUp()) {
        audio.playSwap();
        btn.classList.add('active');
        const p = this.soloBoard.getStoredPowerUp();
        if (p?.type !== 'shuffle') {
          hint.textContent = '👆 Alvo!';
          hint.classList.add('selecting');
        }
      }
    });

    this.setupCanvasEvents(this.soloCanvas!, this.soloBoard!);
  }

  private updateSoloScore(score: number): void {
    const el = document.getElementById('solo-score');
    if (el) {
      el.textContent = score.toString();
      el.style.transform = 'scale(1.2)';
      setTimeout(() => el.style.transform = 'scale(1)', 150);
    }
  }

  private updateSoloEnergy(energy: number): void {
    document.querySelectorAll('.solo-screen .energy-slot').forEach((slot, i) => {
      slot.classList.toggle('filled', i < energy);
    });
  }

  private onSoloPowerUpReady(powerUp: PowerUpConfig): void {
    audio.playCombo(2);
    const btn = document.getElementById('powerup-btn');
    const hint = document.getElementById('powerup-hint');
    if (btn && hint) {
      btn.querySelector('.powerup-mystery')!.setAttribute('style', 'display:none');
      const reveal = btn.querySelector('.powerup-reveal') as HTMLElement;
      reveal.style.display = 'block';
      reveal.textContent = powerUp.emoji;
      btn.removeAttribute('disabled');
      btn.classList.add('ready');
      hint.textContent = `${powerUp.name}!`;
    }
  }

  private onSoloPowerUpUsed(): void {
    audio.playPowerUp();
    const btn = document.getElementById('powerup-btn');
    const hint = document.getElementById('powerup-hint');
    if (btn && hint) {
      btn.setAttribute('disabled', 'true');
      btn.classList.remove('ready', 'active');
      btn.querySelector('.powerup-mystery')!.setAttribute('style', 'display:block');
      btn.querySelector('.powerup-reveal')!.setAttribute('style', 'display:none');
      hint.textContent = 'Match 4+';
      hint.classList.remove('selecting');
    }
  }

  // ===== VS AI MODE =====
  private startVsAIMode(): void {
    this.currentMode = GameMode.VS_AI;
    this.vsaiState = createInitialVsAIState();
    this.renderVsAIScreen();
    this.startTurn();
  }

  private renderVsAIScreen(): void {
    const maxWidth = Math.min(window.innerWidth - 32, 380);
    const humanCellSize = Math.floor(maxWidth / this.COLS);
    const aiCellSize = Math.floor(humanCellSize * 0.7);

    this.app.innerHTML = `
      <div class="game-screen vsai-screen active">
        <div class="vsai-header">
          <button class="back-btn" id="back-btn">←</button>
          <div class="player-info ai" id="ai-info">
            <span class="player-emoji">🤖</span>
            <span class="player-score" id="ai-score">0</span>
          </div>
          <div class="turn-indicator">
            <span class="turn-timer" id="turn-timer">${DEFAULT_CONFIG.turnDuration}</span>
            <span class="turn-label" id="turn-label">SUA VEZ</span>
          </div>
          <div class="player-info" id="human-info">
            <span class="player-emoji">👤</span>
            <span class="player-score" id="human-score">0</span>
          </div>
          <button class="music-btn" id="music-btn">🔇</button>
        </div>

        <div class="ai-board-container" id="ai-container">
          <p class="ai-board-label">🤖 IA</p>
          <div class="game-container">
            <canvas id="ai-canvas"></canvas>
          </div>
        </div>

        <div class="game-container" id="human-container">
          <canvas id="human-canvas"></canvas>
        </div>

        <p class="instructions">Primeiro a ${DEFAULT_CONFIG.winScore} pontos vence!</p>
      </div>
    `;

    // Human board
    this.humanCanvas = document.getElementById('human-canvas') as HTMLCanvasElement;
    this.humanCtx = this.humanCanvas.getContext('2d')!;
    this.humanBoard = new Board(this.ROWS, this.COLS, humanCellSize, {
      onScoreChange: (s) => this.onHumanScore(s),
      onSwap: () => audio.playSwap(),
      onMatch: () => audio.playMatch(),
      onCombo: (l) => audio.playCombo(l),
      onDrop: () => audio.playDrop(),
      onInvalidMove: () => audio.playInvalid(),
      onNoMoves: () => audio.playNoMoves(),
      onPowerUp: () => audio.playPowerUp(),
      onHint: () => {},
      onEnergyChange: () => {},
      onPowerUpReady: () => {},
      onPowerUpUsed: () => {},
    });
    this.humanCanvas.width = this.humanBoard.getWidth();
    this.humanCanvas.height = this.humanBoard.getHeight();

    // AI board
    this.aiCanvas = document.getElementById('ai-canvas') as HTMLCanvasElement;
    this.aiCtx = this.aiCanvas.getContext('2d')!;
    this.aiBoard = new Board(this.ROWS, this.COLS, aiCellSize, {
      onScoreChange: (s) => this.onAIScore(s),
      onSwap: () => {},
      onMatch: () => audio.playMatch(),
      onCombo: (l) => audio.playCombo(l),
      onDrop: () => {},
      onInvalidMove: () => {},
      onNoMoves: () => audio.playNoMoves(),
      onPowerUp: () => audio.playPowerUp(),
      onHint: () => {},
      onEnergyChange: () => {},
      onPowerUpReady: () => {},
      onPowerUpUsed: () => {},
    });
    this.aiCanvas.width = this.aiBoard.getWidth();
    this.aiCanvas.height = this.aiBoard.getHeight();

    this.setupVsAIEventListeners();
    this.updateVsAIUI();
  }

  private setupVsAIEventListeners(): void {
    document.getElementById('back-btn')?.addEventListener('click', () => {
      audio.playSwap();
      this.stopTurnTimer();
      this.showMenu();
    });

    document.getElementById('music-btn')?.addEventListener('click', (e) => {
      audio.ensureStarted();
      const btn = e.target as HTMLElement;
      const isPlaying = audio.toggleMusic();
      btn.textContent = isPlaying ? '🔊' : '🔇';
      btn.classList.toggle('active', isPlaying);
    });

    this.setupCanvasEvents(this.humanCanvas!, this.humanBoard!);
  }

  private startTurn(): void {
    if (!this.vsaiState || this.vsaiState.isGameOver) return;

    this.vsaiState.timeLeft = DEFAULT_CONFIG.turnDuration;
    this.updateVsAIUI();

    if (this.vsaiState.currentTurn === Player.AI) {
      document.getElementById('human-container')?.classList.add('disabled');
      document.getElementById('ai-container')?.classList.add('active');
      this.startAITurn();
    } else {
      document.getElementById('human-container')?.classList.remove('disabled');
      document.getElementById('ai-container')?.classList.remove('active');
    }

    this.turnTimer = window.setInterval(() => {
      if (!this.vsaiState) return;
      
      this.vsaiState.timeLeft--;
      this.updateTimerUI();

      if (this.vsaiState.timeLeft <= 0) {
        this.endTurn();
      }
    }, 1000);
  }

  private endTurn(): void {
    this.stopTurnTimer();
    if (!this.vsaiState || this.vsaiState.isGameOver) return;

    // Switch turns
    this.vsaiState.currentTurn = 
      this.vsaiState.currentTurn === Player.HUMAN ? Player.AI : Player.HUMAN;
    
    audio.playSwap();
    this.startTurn();
  }

  private stopTurnTimer(): void {
    if (this.turnTimer) {
      clearInterval(this.turnTimer);
      this.turnTimer = null;
    }
  }

  private async startAITurn(): Promise<void> {
    if (!this.vsaiState || !this.aiBoard || this.vsaiState.currentTurn !== Player.AI) return;
    
    // IA faz jogadas enquanto tiver tempo
    while (this.vsaiState.timeLeft > 1 && !this.vsaiState.isGameOver && this.vsaiState.currentTurn === Player.AI) {
      await this.sleep(this.aiPlayer.getThinkingDelay());
      
      if (this.vsaiState.currentTurn !== Player.AI) break;
      
      const grid = this.aiBoard.getGrid();
      const move = this.aiPlayer.findBestMove(grid as GemType[][], this.ROWS, this.COLS);
      
      if (move) {
        this.aiBoard.executeMove(move.from, move.to);
        await this.sleep(this.aiPlayer.getMoveDelay());
      } else {
        // Sem jogadas, espera
        await this.sleep(500);
      }
    }
  }

  private onHumanScore(score: number): void {
    if (!this.vsaiState) return;
    this.vsaiState.humanScore = score;
    this.updateVsAIUI();
    this.checkWinCondition();
  }

  private onAIScore(score: number): void {
    if (!this.vsaiState) return;
    this.vsaiState.aiScore = score;
    this.updateVsAIUI();
    this.checkWinCondition();
  }

  private checkWinCondition(): void {
    if (!this.vsaiState || this.vsaiState.isGameOver) return;

    if (this.vsaiState.humanScore >= DEFAULT_CONFIG.winScore) {
      this.vsaiState.isGameOver = true;
      this.vsaiState.winner = Player.HUMAN;
      this.showGameOver();
    } else if (this.vsaiState.aiScore >= DEFAULT_CONFIG.winScore) {
      this.vsaiState.isGameOver = true;
      this.vsaiState.winner = Player.AI;
      this.showGameOver();
    }
  }

  private showGameOver(): void {
    this.stopTurnTimer();
    if (!this.vsaiState) return;

    const isWin = this.vsaiState.winner === Player.HUMAN;
    
    const overlay = document.createElement('div');
    overlay.className = 'game-over-overlay';
    overlay.innerHTML = `
      <div class="game-over-content">
        <h2 class="game-over-title ${isWin ? 'win' : 'lose'}">
          ${isWin ? '🎉 VOCÊ VENCEU!' : '🤖 IA VENCEU!'}
        </h2>
        <p class="game-over-score">
          👤 ${this.vsaiState.humanScore} x ${this.vsaiState.aiScore} 🤖
        </p>
        <div class="game-over-buttons">
          <button class="game-over-btn play-again-btn">Jogar Novamente</button>
          <button class="game-over-btn menu-return-btn">Menu</button>
        </div>
      </div>
    `;

    overlay.querySelector('.play-again-btn')?.addEventListener('click', () => {
      audio.playSwap();
      overlay.remove();
      this.startVsAIMode();
    });

    overlay.querySelector('.menu-return-btn')?.addEventListener('click', () => {
      audio.playSwap();
      overlay.remove();
      this.showMenu();
    });

    document.body.appendChild(overlay);
    audio.playCombo(3);
  }

  private updateVsAIUI(): void {
    if (!this.vsaiState) return;

    const humanScore = document.getElementById('human-score');
    const aiScore = document.getElementById('ai-score');
    const humanInfo = document.getElementById('human-info');
    const aiInfo = document.getElementById('ai-info');
    const turnLabel = document.getElementById('turn-label');

    if (humanScore) humanScore.textContent = this.vsaiState.humanScore.toString();
    if (aiScore) aiScore.textContent = this.vsaiState.aiScore.toString();
    
    const isHumanTurn = this.vsaiState.currentTurn === Player.HUMAN;
    humanInfo?.classList.toggle('active', isHumanTurn);
    aiInfo?.classList.toggle('active', !isHumanTurn);
    if (turnLabel) turnLabel.textContent = isHumanTurn ? 'SUA VEZ' : 'VEZ DA IA';

    this.updateTimerUI();
  }

  private updateTimerUI(): void {
    if (!this.vsaiState) return;
    
    const timer = document.getElementById('turn-timer');
    if (timer) {
      timer.textContent = this.vsaiState.timeLeft.toString();
      timer.classList.toggle('warning', this.vsaiState.timeLeft <= 3);
    }
  }

  // ===== CANVAS EVENT HANDLING =====
  private setupCanvasEvents(canvas: HTMLCanvasElement, board: Board): void {
    canvas.addEventListener('mousedown', (e) => this.handleTouchStart(e.clientX, e.clientY, canvas, board));
    canvas.addEventListener('mousemove', (e) => {
      if (this.isDragging) this.handleTouchMove(e.clientX, e.clientY, canvas, board);
    });
    canvas.addEventListener('mouseup', (e) => this.handleTouchEnd(e.clientX, e.clientY, canvas, board));
    canvas.addEventListener('mouseleave', () => this.cancelDrag(board));

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.handleTouchStart(e.touches[0].clientX, e.touches[0].clientY, canvas, board);
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      this.handleTouchMove(e.touches[0].clientX, e.touches[0].clientY, canvas, board);
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.handleTouchEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY, canvas, board);
    }, { passive: false });

    canvas.addEventListener('touchcancel', () => this.cancelDrag(board));
  }

  private getCanvasCoords(clientX: number, clientY: number, canvas: HTMLCanvasElement): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  private handleTouchStart(clientX: number, clientY: number, canvas: HTMLCanvasElement, board: Board): void {
    // Check if it's player's turn in VS AI mode
    if (this.currentMode === GameMode.VS_AI && this.vsaiState?.currentTurn !== Player.HUMAN) return;
    
    this.touchStartX = clientX;
    this.touchStartY = clientY;
    this.touchStartTime = Date.now();
    this.isDragging = true;

    const coords = this.getCanvasCoords(clientX, clientY, canvas);
    board.setDragStart(coords.x, coords.y);
  }

  private handleTouchMove(clientX: number, clientY: number, canvas: HTMLCanvasElement, board: Board): void {
    if (!this.isDragging) return;
    if (board.isSelectingTarget()) return;

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

      const coords = this.getCanvasCoords(this.touchStartX, this.touchStartY, canvas);
      board.swipeGem(coords.x, coords.y, direction);
      this.cancelDrag(board);
    }
  }

  private handleTouchEnd(clientX: number, clientY: number, canvas: HTMLCanvasElement, board: Board): void {
    if (!this.isDragging) return;

    const deltaX = clientX - this.touchStartX;
    const deltaY = clientY - this.touchStartY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const elapsed = Date.now() - this.touchStartTime;

    if (distance < this.dragThreshold && elapsed < 300) {
      const coords = this.getCanvasCoords(clientX, clientY, canvas);
      board.handleClick(coords.x, coords.y);
    }

    this.cancelDrag(board);
  }

  private cancelDrag(board: Board): void {
    this.isDragging = false;
    board.clearDragStart();
  }

  // ===== UTILITIES =====
  private cleanup(): void {
    this.stopTurnTimer();
    this.soloBoard = null;
    this.humanBoard = null;
    this.aiBoard = null;
    this.vsaiState = null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===== GAME LOOP =====
  private gameLoop = (): void => {
    this.render();
    requestAnimationFrame(this.gameLoop);
  };

  private render(): void {
    if (this.currentMode === GameMode.SOLO && this.soloBoard && this.soloCtx && this.soloCanvas) {
      this.soloBoard.update();
      this.soloCtx.clearRect(0, 0, this.soloCanvas.width, this.soloCanvas.height);
      this.soloBoard.render(this.soloCtx);
    }
    
    if (this.currentMode === GameMode.VS_AI) {
      if (this.humanBoard && this.humanCtx && this.humanCanvas) {
        this.humanBoard.update();
        this.humanCtx.clearRect(0, 0, this.humanCanvas.width, this.humanCanvas.height);
        this.humanBoard.render(this.humanCtx);
      }
      if (this.aiBoard && this.aiCtx && this.aiCanvas) {
        this.aiBoard.update();
        this.aiCtx.clearRect(0, 0, this.aiCanvas.width, this.aiCanvas.height);
        this.aiBoard.render(this.aiCtx);
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new Game();
});
