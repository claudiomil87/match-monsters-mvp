import './style.css';
import { Board } from './Board';
import { audio } from './Audio';
import { PowerUpConfig } from './PowerUps';
import { 
  GameMode, Player, 
  VsAITimeState, VsAITurnsState,
  createVsAITimeState, createVsAITurnsState,
  TIME_CONFIG, TURNS_CONFIG 
} from './GameState';
import { AIPlayer } from './AIPlayer';
import { GemType } from './types';

class Game {
  private app: HTMLElement;
  private currentMode: GameMode = GameMode.MENU;
  
  // Solo mode
  private soloBoard: Board | null = null;
  private soloCanvas: HTMLCanvasElement | null = null;
  private soloCtx: CanvasRenderingContext2D | null = null;
  
  // VS AI Time mode
  private timeHumanBoard: Board | null = null;
  private timeAIBoard: Board | null = null;
  private timeHumanCanvas: HTMLCanvasElement | null = null;
  private timeAICanvas: HTMLCanvasElement | null = null;
  private timeHumanCtx: CanvasRenderingContext2D | null = null;
  private timeAICtx: CanvasRenderingContext2D | null = null;
  private timeState: VsAITimeState | null = null;
  
  // VS AI Turns mode (SHARED BOARD)
  private turnsSharedBoard: Board | null = null;
  private turnsSharedCanvas: HTMLCanvasElement | null = null;
  private turnsSharedCtx: CanvasRenderingContext2D | null = null;
  private turnsState: VsAITurnsState | null = null;
  
  // Shared
  private timer: number | null = null;
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
            
            <button class="menu-btn time-btn" data-mode="vs_ai_time">
              <span class="btn-emoji">⏱️</span>
              <span class="btn-title">VS IA (Tempo)</span>
              <span class="btn-desc">${TIME_CONFIG.turnDuration}s por turno</span>
            </button>
            
            <button class="menu-btn turns-btn" data-mode="vs_ai_turns">
              <span class="btn-emoji">🎲</span>
              <span class="btn-title">VS IA (Turnos)</span>
              <span class="btn-desc">${TURNS_CONFIG.movesPerTurn} jogadas • ${TURNS_CONFIG.moveTimeout}s cada</span>
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
        else if (mode === 'vs_ai_time') this.startVsAITimeMode();
        else if (mode === 'vs_ai_turns') this.startVsAITurnsMode();
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
            <div class="energy-slot"></div>
            <div class="energy-slot"></div>
            <div class="energy-slot"></div>
            <div class="energy-slot"></div>
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
      onScoreChange: (s) => this.updateElement('solo-score', s),
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
      onMatch4Plus: () => {},
      onMoveComplete: () => {},
    });

    this.soloCanvas.width = this.soloBoard.getWidth();
    this.soloCanvas.height = this.soloBoard.getHeight();

    this.setupCommonListeners();
    this.setupSoloPowerUp();
    this.setupCanvasEvents(this.soloCanvas, this.soloBoard);
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
      (btn.querySelector('.powerup-reveal') as HTMLElement).style.display = 'block';
      (btn.querySelector('.powerup-reveal') as HTMLElement).textContent = powerUp.emoji;
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
      (btn.querySelector('.powerup-reveal') as HTMLElement).style.display = 'none';
      hint.textContent = 'Match 4+';
      hint.classList.remove('selecting');
    }
  }

  private setupSoloPowerUp(): void {
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
  }

  // ===== VS AI TIME MODE =====
  private startVsAITimeMode(): void {
    this.currentMode = GameMode.VS_AI_TIME;
    this.timeState = createVsAITimeState();
    this.renderVsAITimeScreen();
    this.startTimeTurn();
  }

  private renderVsAITimeScreen(): void {
    const maxWidth = Math.min(window.innerWidth - 32, 380);
    const cellSize = Math.floor(maxWidth / this.COLS);

    this.app.innerHTML = `
      <div class="game-screen vsai-screen active">
        <div class="vsai-header">
          <button class="back-btn" id="back-btn">←</button>
          <div class="player-info ai" id="ai-info">
            <span class="player-emoji">🤖</span>
            <span class="player-score" id="ai-score">0</span>
          </div>
          <div class="turn-indicator">
            <span class="turn-timer" id="turn-timer">${TIME_CONFIG.turnDuration}</span>
            <span class="turn-label" id="turn-label">SUA VEZ</span>
          </div>
          <div class="player-info" id="human-info">
            <span class="player-emoji">👤</span>
            <span class="player-score" id="human-score">0</span>
          </div>
          <button class="music-btn" id="music-btn">🔇</button>
        </div>

        <div class="board-label">🤖 IA</div>
        <div class="game-container" id="ai-container">
          <canvas id="ai-canvas"></canvas>
        </div>

        <div class="board-label">👤 Você</div>
        <div class="game-container" id="human-container">
          <canvas id="human-canvas"></canvas>
        </div>

        <p class="instructions">Primeiro a ${TIME_CONFIG.winScore} pts vence!</p>
      </div>
    `;

    // Human board
    this.timeHumanCanvas = document.getElementById('human-canvas') as HTMLCanvasElement;
    this.timeHumanCtx = this.timeHumanCanvas.getContext('2d')!;
    this.timeHumanBoard = new Board(this.ROWS, this.COLS, cellSize, {
      onScoreChange: (s) => this.onTimeHumanScore(s),
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
      onMatch4Plus: () => {},
      onMoveComplete: () => {},
    });
    this.timeHumanCanvas.width = this.timeHumanBoard.getWidth();
    this.timeHumanCanvas.height = this.timeHumanBoard.getHeight();

    // AI board
    this.timeAICanvas = document.getElementById('ai-canvas') as HTMLCanvasElement;
    this.timeAICtx = this.timeAICanvas.getContext('2d')!;
    this.timeAIBoard = new Board(this.ROWS, this.COLS, cellSize, {
      onScoreChange: (s) => this.onTimeAIScore(s),
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
      onMatch4Plus: () => {},
      onMoveComplete: () => {},
    });
    this.timeAICanvas.width = this.timeAIBoard.getWidth();
    this.timeAICanvas.height = this.timeAIBoard.getHeight();

    this.setupCommonListeners();
    this.setupCanvasEvents(this.timeHumanCanvas, this.timeHumanBoard);
    this.updateTimeUI();
  }

  private startTimeTurn(): void {
    if (!this.timeState || this.timeState.isGameOver) return;

    this.timeState.timeLeft = TIME_CONFIG.turnDuration;
    this.updateTimeUI();

    if (this.timeState.currentTurn === Player.AI) {
      document.getElementById('human-container')?.classList.add('disabled');
      document.getElementById('ai-container')?.classList.remove('disabled');
      this.runTimeAI();
    } else {
      document.getElementById('human-container')?.classList.remove('disabled');
      document.getElementById('ai-container')?.classList.add('disabled');
    }

    this.timer = window.setInterval(() => {
      if (!this.timeState) return;
      this.timeState.timeLeft--;
      this.updateElement('turn-timer', this.timeState.timeLeft);
      document.getElementById('turn-timer')?.classList.toggle('warning', this.timeState.timeLeft <= 3);
      if (this.timeState.timeLeft <= 0) this.endTimeTurn();
    }, 1000);
  }

  private endTimeTurn(): void {
    this.stopTimer();
    if (!this.timeState || this.timeState.isGameOver) return;
    this.timeState.currentTurn = this.timeState.currentTurn === Player.HUMAN ? Player.AI : Player.HUMAN;
    audio.playSwap();
    this.startTimeTurn();
  }

  private async runTimeAI(): Promise<void> {
    if (!this.timeState || !this.timeAIBoard) return;
    
    while (this.timeState.timeLeft > 1 && !this.timeState.isGameOver && this.timeState.currentTurn === Player.AI) {
      await this.sleep(this.aiPlayer.getThinkingDelay());
      if (this.timeState.currentTurn !== Player.AI) break;
      
      const grid = this.timeAIBoard.getGrid();
      const move = this.aiPlayer.findBestMove(grid as GemType[][], this.ROWS, this.COLS);
      
      if (move) {
        this.timeAIBoard.executeMove(move.from, move.to);
        await this.sleep(this.aiPlayer.getMoveDelay());
      } else {
        await this.sleep(500);
      }
    }
  }

  private onTimeHumanScore(score: number): void {
    if (!this.timeState) return;
    this.timeState.humanScore = score;
    this.updateElement('human-score', score);
    this.checkTimeWin();
  }

  private onTimeAIScore(score: number): void {
    if (!this.timeState) return;
    this.timeState.aiScore = score;
    this.updateElement('ai-score', score);
    this.checkTimeWin();
  }

  private checkTimeWin(): void {
    if (!this.timeState || this.timeState.isGameOver) return;
    if (this.timeState.humanScore >= TIME_CONFIG.winScore) {
      this.timeState.isGameOver = true;
      this.timeState.winner = Player.HUMAN;
      this.showGameOver(this.timeState.humanScore, this.timeState.aiScore, true, () => this.startVsAITimeMode());
    } else if (this.timeState.aiScore >= TIME_CONFIG.winScore) {
      this.timeState.isGameOver = true;
      this.timeState.winner = Player.AI;
      this.showGameOver(this.timeState.humanScore, this.timeState.aiScore, false, () => this.startVsAITimeMode());
    }
  }

  private updateTimeUI(): void {
    if (!this.timeState) return;
    const isHumanTurn = this.timeState.currentTurn === Player.HUMAN;
    document.getElementById('human-info')?.classList.toggle('active', isHumanTurn);
    document.getElementById('ai-info')?.classList.toggle('active', !isHumanTurn);
    this.updateElement('turn-label', isHumanTurn ? 'SUA VEZ' : 'VEZ DA IA');
    this.updateElement('turn-timer', this.timeState.timeLeft);
  }

  // ===== VS AI TURNS MODE =====
  private startVsAITurnsMode(): void {
    this.currentMode = GameMode.VS_AI_TURNS;
    this.turnsState = createVsAITurnsState();
    this.renderVsAITurnsScreen();
    this.startTurnsMoveTimer();
  }

  private renderVsAITurnsScreen(): void {
    const maxWidth = Math.min(window.innerWidth - 32, 420);
    const cellSize = Math.floor(maxWidth / this.COLS);

    this.app.innerHTML = `
      <div class="game-screen vsai-screen turns-shared active">
        <div class="vsai-header">
          <button class="back-btn" id="back-btn">←</button>
          <div class="player-info ai" id="ai-info">
            <span class="player-emoji">🤖</span>
            <span class="player-score" id="ai-score">0</span>
          </div>
          <div class="turn-indicator turns-mode">
            <span class="turn-timer" id="turn-timer">${TURNS_CONFIG.moveTimeout}</span>
            <span class="moves-left" id="moves-left">🎯 ${TURNS_CONFIG.movesPerTurn}</span>
            <span class="turn-label" id="turn-label">SUA VEZ</span>
          </div>
          <div class="player-info" id="human-info">
            <span class="player-emoji">👤</span>
            <span class="player-score" id="human-score">0</span>
          </div>
          <button class="music-btn" id="music-btn">🔇</button>
        </div>

        <div class="shared-board-container" id="shared-container">
          <div class="turn-overlay" id="turn-overlay">
            <span class="turn-overlay-text">VEZ DA IA...</span>
          </div>
          <canvas id="shared-canvas"></canvas>
        </div>

        <p class="instructions">🎲 Mesmo tabuleiro! Match 4+ = jogada extra!</p>
      </div>
    `;

    // Shared board - único tabuleiro para ambos
    this.turnsSharedCanvas = document.getElementById('shared-canvas') as HTMLCanvasElement;
    this.turnsSharedCtx = this.turnsSharedCanvas.getContext('2d')!;
    this.turnsSharedBoard = new Board(this.ROWS, this.COLS, cellSize, {
      onScoreChange: () => {}, // Não usamos o score do board
      onPointsScored: (pts) => this.onTurnsPointsScored(pts),
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
      onMatch4Plus: (count) => this.onTurnsMatch4Plus(count),
      onMoveComplete: (hadMatch) => this.onTurnsMoveComplete(hadMatch),
    });
    this.turnsSharedBoard.setAllowNoMatchMoves(true);
    this.turnsSharedCanvas.width = this.turnsSharedBoard.getWidth();
    this.turnsSharedCanvas.height = this.turnsSharedBoard.getHeight();

    this.setupCommonListeners();
    this.setupCanvasEvents(this.turnsSharedCanvas, this.turnsSharedBoard);
    this.updateTurnsUI();
  }

  private startTurnsMoveTimer(): void {
    if (!this.turnsState || this.turnsState.isGameOver) return;

    this.turnsState.timeLeft = TURNS_CONFIG.moveTimeout;
    this.updateTurnsUI();

    const overlay = document.getElementById('turn-overlay');
    if (this.turnsState.currentTurn === Player.AI) {
      overlay?.classList.add('active');
      this.runTurnsAI();
    } else {
      overlay?.classList.remove('active');
    }

    this.timer = window.setInterval(() => {
      if (!this.turnsState) return;
      this.turnsState.timeLeft--;
      this.updateElement('turn-timer', this.turnsState.timeLeft);
      document.getElementById('turn-timer')?.classList.toggle('warning', this.turnsState.timeLeft <= 3);
      
      if (this.turnsState.timeLeft <= 0) {
        // Tempo esgotou - perde uma jogada
        this.turnsState.movesLeft--;
        if (this.turnsState.movesLeft <= 0) {
          this.endTurnsTurn();
        } else {
          this.stopTimer();
          this.startTurnsMoveTimer();
        }
      }
    }, 1000);
  }

  private onTurnsMatch4Plus(count: number): void {
    if (!this.turnsState) return;
    
    // Cada match de 4+ dá uma jogada extra (até o máximo)
    this.turnsState.movesLeft = Math.min(TURNS_CONFIG.maxMoves, this.turnsState.movesLeft + count);
    this.updateTurnsUI();
    audio.playCombo(2); // Som especial
  }

  private onTurnsPointsScored(points: number): void {
    if (!this.turnsState) return;
    
    // Atribui pontos ao jogador do turno atual
    if (this.turnsState.currentTurn === Player.HUMAN) {
      this.turnsState.humanScore += points;
      this.updateElement('human-score', this.turnsState.humanScore);
    } else {
      this.turnsState.aiScore += points;
      this.updateElement('ai-score', this.turnsState.aiScore);
    }
    this.checkTurnsWin();
  }

  private onTurnsMoveComplete(_hadMatch: boolean): void {
    if (!this.turnsState) return;
    
    // A jogada foi consumida
    this.turnsState.movesLeft--;
    
    if (this.turnsState.movesLeft <= 0) {
      this.endTurnsTurn();
    } else if (this.turnsState.currentTurn === Player.HUMAN) {
      // Humano ainda tem jogadas - reseta timer
      this.stopTimer();
      this.startTurnsMoveTimer();
    }
    
    this.updateTurnsUI();
  }

  private endTurnsTurn(): void {
    this.stopTimer();
    if (!this.turnsState || this.turnsState.isGameOver) return;
    
    // Troca turno
    this.turnsState.currentTurn = this.turnsState.currentTurn === Player.HUMAN ? Player.AI : Player.HUMAN;
    this.turnsState.movesLeft = TURNS_CONFIG.movesPerTurn;
    
    audio.playSwap();
    this.startTurnsMoveTimer();
  }

  private async runTurnsAI(): Promise<void> {
    if (!this.turnsState || !this.turnsSharedBoard) return;
    
    while (this.turnsState.movesLeft > 0 && !this.turnsState.isGameOver && this.turnsState.currentTurn === Player.AI) {
      await this.sleep(this.aiPlayer.getThinkingDelay());
      if (this.turnsState.currentTurn !== Player.AI) break;
      
      const grid = this.turnsSharedBoard.getGrid();
      const move = this.aiPlayer.findBestMove(grid as GemType[][], this.ROWS, this.COLS);
      
      if (move) {
        this.turnsSharedBoard.executeMove(move.from, move.to);
        await this.sleep(this.aiPlayer.getMoveDelay() + 400);
      } else {
        // Sem boas jogadas, faz qualquer movimento
        const anyMove = this.findAnyMove(grid as GemType[][]);
        if (anyMove) {
          this.turnsSharedBoard.executeMove(anyMove.from, anyMove.to);
          await this.sleep(this.aiPlayer.getMoveDelay() + 200);
        }
      }
    }
  }

  private findAnyMove(_grid: GemType[][]): { from: { row: number; col: number }; to: { row: number; col: number } } | null {
    for (let row = 0; row < this.ROWS; row++) {
      for (let col = 0; col < this.COLS; col++) {
        if (col < this.COLS - 1) {
          return { from: { row, col }, to: { row, col: col + 1 } };
        }
      }
    }
    return null;
  }

  private checkTurnsWin(): void {
    if (!this.turnsState || this.turnsState.isGameOver) return;
    if (this.turnsState.humanScore >= TURNS_CONFIG.winScore) {
      this.turnsState.isGameOver = true;
      this.showGameOver(this.turnsState.humanScore, this.turnsState.aiScore, true, () => this.startVsAITurnsMode());
    } else if (this.turnsState.aiScore >= TURNS_CONFIG.winScore) {
      this.turnsState.isGameOver = true;
      this.showGameOver(this.turnsState.humanScore, this.turnsState.aiScore, false, () => this.startVsAITurnsMode());
    }
  }

  private updateTurnsUI(): void {
    if (!this.turnsState) return;
    const isHumanTurn = this.turnsState.currentTurn === Player.HUMAN;
    document.getElementById('human-info')?.classList.toggle('active', isHumanTurn);
    document.getElementById('ai-info')?.classList.toggle('active', !isHumanTurn);
    this.updateElement('turn-label', isHumanTurn ? 'SUA VEZ' : 'VEZ DA IA');
    this.updateElement('turn-timer', this.turnsState.timeLeft);
    this.updateElement('moves-left', `🎯 ${this.turnsState.movesLeft}`);
  }

  // ===== SHARED =====
  private showGameOver(humanScore: number, aiScore: number, isWin: boolean, playAgain: () => void): void {
    this.stopTimer();
    
    const overlay = document.createElement('div');
    overlay.className = 'game-over-overlay';
    overlay.innerHTML = `
      <div class="game-over-content">
        <h2 class="game-over-title ${isWin ? 'win' : 'lose'}">
          ${isWin ? '🎉 VOCÊ VENCEU!' : '🤖 IA VENCEU!'}
        </h2>
        <p class="game-over-score">👤 ${humanScore} x ${aiScore} 🤖</p>
        <div class="game-over-buttons">
          <button class="game-over-btn play-again-btn">Jogar Novamente</button>
          <button class="game-over-btn menu-return-btn">Menu</button>
        </div>
      </div>
    `;

    overlay.querySelector('.play-again-btn')?.addEventListener('click', () => {
      audio.playSwap();
      overlay.remove();
      playAgain();
    });

    overlay.querySelector('.menu-return-btn')?.addEventListener('click', () => {
      audio.playSwap();
      overlay.remove();
      this.showMenu();
    });

    document.body.appendChild(overlay);
    audio.playCombo(3);
  }

  private setupCommonListeners(): void {
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
  }

  private setupCanvasEvents(canvas: HTMLCanvasElement, board: Board): void {
    const handlers = {
      start: (x: number, y: number) => {
        if (this.currentMode === GameMode.VS_AI_TIME && this.timeState?.currentTurn !== Player.HUMAN) return;
        if (this.currentMode === GameMode.VS_AI_TURNS && this.turnsState?.currentTurn !== Player.HUMAN) return;
        
        this.touchStartX = x;
        this.touchStartY = y;
        this.touchStartTime = Date.now();
        this.isDragging = true;
        const coords = this.getCanvasCoords(x, y, canvas);
        board.setDragStart(coords.x, coords.y);
      },
      move: (x: number, y: number) => {
        if (!this.isDragging || board.isSelectingTarget()) return;
        
        const deltaX = x - this.touchStartX;
        const deltaY = y - this.touchStartY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (distance >= this.dragThreshold) {
          const direction = Math.abs(deltaX) > Math.abs(deltaY)
            ? (deltaX > 0 ? 'right' : 'left')
            : (deltaY > 0 ? 'down' : 'up');
          const coords = this.getCanvasCoords(this.touchStartX, this.touchStartY, canvas);
          board.swipeGem(coords.x, coords.y, direction as 'left' | 'right' | 'up' | 'down');
          this.isDragging = false;
          board.clearDragStart();
        }
      },
      end: (x: number, y: number) => {
        if (!this.isDragging) return;
        const deltaX = x - this.touchStartX;
        const deltaY = y - this.touchStartY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const elapsed = Date.now() - this.touchStartTime;

        if (distance < this.dragThreshold && elapsed < 300) {
          const coords = this.getCanvasCoords(x, y, canvas);
          board.handleClick(coords.x, coords.y);
        }
        this.isDragging = false;
        board.clearDragStart();
      }
    };

    canvas.addEventListener('mousedown', e => handlers.start(e.clientX, e.clientY));
    canvas.addEventListener('mousemove', e => { if (this.isDragging) handlers.move(e.clientX, e.clientY); });
    canvas.addEventListener('mouseup', e => handlers.end(e.clientX, e.clientY));
    canvas.addEventListener('mouseleave', () => { this.isDragging = false; board.clearDragStart(); });

    canvas.addEventListener('touchstart', e => { e.preventDefault(); handlers.start(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
    canvas.addEventListener('touchmove', e => { e.preventDefault(); handlers.move(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
    canvas.addEventListener('touchend', e => { e.preventDefault(); handlers.end(e.changedTouches[0].clientX, e.changedTouches[0].clientY); }, { passive: false });
    canvas.addEventListener('touchcancel', () => { this.isDragging = false; board.clearDragStart(); });
  }

  private getCanvasCoords(clientX: number, clientY: number, canvas: HTMLCanvasElement): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  private updateElement(id: string, value: string | number): void {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private cleanup(): void {
    this.stopTimer();
    this.soloBoard = null;
    this.timeHumanBoard = null;
    this.timeAIBoard = null;
    this.turnsSharedBoard = null;
    this.timeState = null;
    this.turnsState = null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

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
    
    if (this.currentMode === GameMode.VS_AI_TIME) {
      if (this.timeHumanBoard && this.timeHumanCtx && this.timeHumanCanvas) {
        this.timeHumanBoard.update();
        this.timeHumanCtx.clearRect(0, 0, this.timeHumanCanvas.width, this.timeHumanCanvas.height);
        this.timeHumanBoard.render(this.timeHumanCtx);
      }
      if (this.timeAIBoard && this.timeAICtx && this.timeAICanvas) {
        this.timeAIBoard.update();
        this.timeAICtx.clearRect(0, 0, this.timeAICanvas.width, this.timeAICanvas.height);
        this.timeAIBoard.render(this.timeAICtx);
      }
    }
    
    if (this.currentMode === GameMode.VS_AI_TURNS) {
      if (this.turnsSharedBoard && this.turnsSharedCtx && this.turnsSharedCanvas) {
        this.turnsSharedBoard.update();
        this.turnsSharedCtx.clearRect(0, 0, this.turnsSharedCanvas.width, this.turnsSharedCanvas.height);
        this.turnsSharedBoard.render(this.turnsSharedCtx);
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new Game();
});
