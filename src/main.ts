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
import { 
  createRandomTeam 
} from './Monster';
import { 
  BattleSystem, 
  BattleAction,
  DEFAULT_BATTLE_CONFIG 
} from './BattleSystem';
import { 
  createEnemyTeam, 
  getStageReward, 
  getMaxTeamSize 
} from './GameBalance';
import { BattleUI } from './BattleUI';

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
  
  // Battle Mode (NEW!)
  private battleBoard: Board | null = null;
  private battleCanvas: HTMLCanvasElement | null = null;
  private battleCtx: CanvasRenderingContext2D | null = null;
  private battleUICanvas: HTMLCanvasElement | null = null;
  private battleUICtx: CanvasRenderingContext2D | null = null;
  private battleSystem: BattleSystem | null = null;
  private battleUI: BattleUI | null = null;
  private battleStage: number = 1;
  
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
  private readonly ROWS = 6; // Increased to 6 rows for better gameplay

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
            <button class="menu-btn battle-btn" data-mode="battle">
              <span class="btn-emoji">⚔️</span>
              <span class="btn-title">BATALHA PvE</span>
              <span class="btn-desc">Derrote os monstros inimigos!</span>
            </button>
            
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
        if (mode === 'battle') this.startBattleMode();
        else if (mode === 'solo') this.startSoloMode();
        else if (mode === 'vs_ai_time') this.startVsAITimeMode();
        else if (mode === 'vs_ai_turns') this.startVsAITurnsMode();
      });
    });
  }

  // ===== BATTLE MODE (NEW!) =====
  private startBattleMode(): void {
    this.currentMode = GameMode.VS_AI_TURNS; // Reusing turns mode enum
    this.cleanup();
    
    // Create balanced teams based on current stage
    const maxTeamSize = getMaxTeamSize(this.battleStage);
    const playerTeam = createRandomTeam('Você', '😎', maxTeamSize);
    const enemyTeam = createEnemyTeam(this.battleStage);
    
    // Calculate dimensions - mobile first!
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const isMobile = screenWidth < 500;
    
    // Célula maior no mobile para facilitar o toque
    const cellSize = Math.min(isMobile ? 48 : 55, Math.floor((screenWidth - 24) / this.COLS));
    const boardWidth = this.COLS * cellSize;
    const boardHeight = this.ROWS * cellSize;
    
    // UI height adapta à tela - mais espaço para os monstros
    const availableHeight = screenHeight - boardHeight - 100; // footer + padding
    const uiHeight = Math.max(180, Math.min(280, availableHeight));
    
    this.app.innerHTML = `
      <div class="battle-screen">
        <div class="battle-container">
          <canvas id="battleUICanvas" width="${boardWidth}" height="${uiHeight}"></canvas>
          <canvas id="battleCanvas" width="${boardWidth}" height="${boardHeight}"></canvas>
          <div class="battle-footer">
            <div class="score-display">
              <span id="battleScore">Pontos: 0</span>
            </div>
            <div class="power-up-area">
              <button id="powerUpBtn" class="power-up-btn hidden">
                <span id="powerUpIcon">💥</span>
                <span id="powerUpName">Power-Up</span>
              </button>
            </div>
          </div>
        </div>
        <button class="back-btn" id="backBtn">← Menu</button>
      </div>
    `;
    
    // Setup canvases
    this.battleCanvas = document.getElementById('battleCanvas') as HTMLCanvasElement;
    this.battleCtx = this.battleCanvas.getContext('2d')!;
    this.battleUICanvas = document.getElementById('battleUICanvas') as HTMLCanvasElement;
    this.battleUICtx = this.battleUICanvas.getContext('2d')!;
    
    // Create board with berry gems enabled
    this.battleBoard = new Board(this.ROWS, this.COLS, cellSize, {
      onScoreChange: (score) => {
        document.getElementById('battleScore')!.textContent = `Pontos: ${score}`;
      },
      onPointsScored: () => {
        // Points are processed via onMatchesFound
      },
      onSwap: () => audio.playSwap(),
      onMatch: () => {
        audio.playMatch();
      },
      onCombo: (level) => {
        audio.playCombo();
        if (this.battleUI) {
          this.battleUI.showActionMessage(`COMBO x${level}!`, 1000);
        }
      },
      onDrop: () => audio.playDrop(),
      onInvalidMove: () => audio.playInvalid(),
      onNoMoves: () => audio.playPowerUp(),
      onPowerUp: () => audio.playPowerUp(),
      onHint: () => {},
      onEnergyChange: this.updatePowerUpUI.bind(this),
      onPowerUpReady: this.onPowerUpReady.bind(this),
      onPowerUpUsed: () => {
        audio.playPowerUp();
        this.hidePowerUpUI();
      },
      onMatch4Plus: () => {},
      onMoveComplete: (hadMatch) => {
        if (this.battleSystem) {
          this.battleSystem.onMoveMade(hadMatch);
        }
      },
      onMatchesFound: (matches, comboLevel) => {
        // Process matches in battle system for damage/healing
        if (this.battleSystem && matches.length > 0) {
          this.battleSystem.processMatches(matches, comboLevel);
        }
      },
    });
    
    // Enable no-match moves for battle mode
    this.battleBoard.setAllowNoMatchMoves(true);
    
    // Create battle system
    this.battleSystem = new BattleSystem(
      playerTeam,
      enemyTeam,
      DEFAULT_BATTLE_CONFIG,
      {
        onDamage: (action) => this.onBattleDamage(action),
        onHeal: (action) => this.onBattleHeal(action),
        onEvolve: (name, _team) => this.onBattleEvolve(name, _team),
        onDefeat: (name, team) => this.onBattleDefeat(name, team),
        onTurnChange: (turn) => this.onTurnChange(turn),
        onGameOver: (winner) => this.onBattleGameOver(winner),
        onTimeUpdate: () => {},
        onMovesUpdate: () => {},
      }
    );
    this.battleSystem.setStage(this.battleStage);
    
    // Create battle UI
    this.battleUI = new BattleUI(this.battleUICanvas);
    
    // Start battle timer
    this.battleSystem.startTimer();
    
    // Setup input
    this.setupBattleInput();
    
    // Back button
    document.getElementById('backBtn')?.addEventListener('click', () => {
      audio.playSwap();
      this.showMenu();
    });
    
    // Power-up button
    document.getElementById('powerUpBtn')?.addEventListener('click', () => {
      if (this.battleBoard?.hasPowerUp()) {
        if (this.battleBoard.activateStoredPowerUp()) {
          audio.playPowerUp();
        }
      }
    });
  }
  
  private onBattleDamage(action: BattleAction): void {
    if (this.battleUI && this.battleUICanvas) {
      const x = action.target === 'player' ? 100 : this.battleUICanvas.width - 100;
      const y = 120;
      this.battleUI.addDamagePopup(
        x, y, action.amount, false,
        action.type === 'super_effective'
      );
      
      if (action.type === 'super_effective') {
        this.battleUI.showActionMessage('Super Efetivo! 💥', 1000);
        audio.playSuperEffective();
      } else {
        audio.playBattleDamage();
      }
    }
  }
  
  private onBattleHeal(action: BattleAction): void {
    if (this.battleUI && this.battleUICanvas) {
      const x = action.target === 'player' ? 100 : this.battleUICanvas.width - 100;
      const y = 120;
      this.battleUI.addDamagePopup(x, y, action.amount, true);
      audio.playHeal();
    }
  }
  
  private onBattleEvolve(name: string, team: 'player' | 'enemy'): void {
    if (this.battleUI && this.battleUICanvas) {
      const x = team === 'player' ? 100 : this.battleUICanvas.width - 100;
      this.battleUI.addEvolutionEffect(x, 100, name);
      this.battleUI.showActionMessage(`${name} EVOLUIU! ✨`, 2000);
      audio.playEvolution();
    }
  }
  
  private onBattleDefeat(name: string, _team: 'player' | 'enemy'): void {
    if (this.battleUI) {
      this.battleUI.showActionMessage(`${name} foi derrotado! 💀`, 1500);
      audio.playDefeat();
    }
  }
  
  private onTurnChange(turn: 'player' | 'enemy'): void {
    if (this.battleUI) {
      const message = turn === 'player' ? 'Sua vez!' : 'Vez do oponente...';
      this.battleUI.showActionMessage(message, 1000);
    }
    
    // If it's AI's turn, make AI move
    if (turn === 'enemy' && this.battleSystem && this.battleBoard) {
      this.doAIBattleMove();
    }
  }
  
  private async doAIBattleMove(): Promise<void> {
    if (!this.battleBoard || !this.battleSystem || this.battleSystem.isGameOver()) return;
    
    const state = this.battleSystem.getState();
    
    // Wait a bit before AI moves
    await this.sleep(this.aiPlayer.getThinkingDelay());
    
    for (let i = 0; i < state.movesLeft; i++) {
      if (this.battleSystem.isGameOver() || this.battleSystem.getCurrentTurn() !== 'enemy') break;
      
      const grid = this.battleBoard.getGrid();
      const move = this.aiPlayer.findBestMove(grid, this.ROWS, this.COLS);
      
      if (move) {
        await this.sleep(this.aiPlayer.getMoveDelay());
        this.battleBoard.executeMove(move.from, move.to);
      }
      
      // Wait for animations
      await this.sleep(500);
    }
  }
  
  private onBattleGameOver(winner: 'player' | 'enemy'): void {
    if (winner === 'player') {
      // Verifica se há recompensa para este stage
      const reward = getStageReward(this.battleStage);
      if (reward && this.battleUI) {
        this.battleUI.showActionMessage(reward.unlockMessage, 3000);
      }
      
      this.battleStage++;
      audio.playPowerUp();
      
      // Auto-restart próxima batalha após 2 segundos
      setTimeout(() => {
        if (this.currentMode === GameMode.VS_AI_TURNS && this.battleBoard) {
          this.startBattleMode();
        }
      }, 2000);
    }
  }
  
  private setupBattleInput(): void {
    if (!this.battleCanvas) return;
    
    const canvas = this.battleCanvas;
    
    // Click
    canvas.addEventListener('click', (e) => {
      if (this.battleSystem?.getCurrentTurn() !== 'player') return;
      if (this.battleSystem?.isGameOver()) {
        // Check for restart button click
        const rect = this.battleUICanvas!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top + (this.battleUICanvas?.height || 0);
        
        if (this.battleUI?.checkRestartClick(x, y, this.battleSystem.getState())) {
          this.startBattleMode();
        }
        return;
      }
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.battleBoard?.handleClick(x, y);
    });
    
    // Touch
    canvas.addEventListener('touchstart', (e) => {
      if (this.battleSystem?.getCurrentTurn() !== 'player') return;
      if (this.battleSystem?.isGameOver()) return;
      
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      this.touchStartX = touch.clientX - rect.left;
      this.touchStartY = touch.clientY - rect.top;
      this.touchStartTime = Date.now();
      this.isDragging = false;
      
      this.battleBoard?.setDragStart(this.touchStartX, this.touchStartY);
    }, { passive: false });
    
    canvas.addEventListener('touchmove', (e) => {
      if (this.battleSystem?.getCurrentTurn() !== 'player') return;
      if (this.battleSystem?.isGameOver()) return;
      
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      const dx = x - this.touchStartX;
      const dy = y - this.touchStartY;
      
      if (!this.isDragging && (Math.abs(dx) > this.dragThreshold || Math.abs(dy) > this.dragThreshold)) {
        this.isDragging = true;
        
        let direction: 'left' | 'right' | 'up' | 'down';
        if (Math.abs(dx) > Math.abs(dy)) {
          direction = dx > 0 ? 'right' : 'left';
        } else {
          direction = dy > 0 ? 'down' : 'up';
        }
        
        this.battleBoard?.swipeGem(this.touchStartX, this.touchStartY, direction);
        this.battleBoard?.clearDragStart();
      }
    }, { passive: false });
    
    canvas.addEventListener('touchend', (e) => {
      if (this.battleSystem?.getCurrentTurn() !== 'player') return;
      if (this.battleSystem?.isGameOver()) return;
      
      e.preventDefault();
      
      if (!this.isDragging) {
        const elapsed = Date.now() - this.touchStartTime;
        if (elapsed < 300) {
          this.battleBoard?.handleClick(this.touchStartX, this.touchStartY);
        }
      }
      
      this.battleBoard?.clearDragStart();
      this.isDragging = false;
    }, { passive: false });
  }
  
  private renderBattle(): void {
    if (!this.battleBoard || !this.battleCtx || !this.battleUICtx || !this.battleUI || !this.battleSystem) return;
    
    // Clear canvases
    this.battleUICtx.clearRect(0, 0, this.battleUICanvas!.width, this.battleUICanvas!.height);
    this.battleCtx.clearRect(0, 0, this.battleCanvas!.width, this.battleCanvas!.height);
    
    // Render battle UI (monsters, HP, timer)
    this.battleUI.render(this.battleSystem.getState(), 0);
    
    // Render board
    this.battleBoard.render(this.battleCtx);
    this.battleBoard.update();
  }

  // ===== SOLO MODE =====
  private startSoloMode(): void {
    this.currentMode = GameMode.SOLO;
    this.cleanup();
    
    const cellSize = Math.min(60, Math.floor((window.innerWidth - 40) / this.COLS));
    const boardWidth = this.COLS * cellSize;
    const boardHeight = this.ROWS * cellSize;
    
    this.app.innerHTML = `
      <div class="game-screen solo-screen">
        <div class="game-header">
          <button class="back-btn" id="backBtn">← Menu</button>
          <div class="score-display">
            <span id="soloScore">Pontos: 0</span>
          </div>
        </div>
        <div class="game-container">
          <canvas id="soloCanvas" width="${boardWidth}" height="${boardHeight}"></canvas>
          <div class="power-up-area">
            <button id="powerUpBtn" class="power-up-btn hidden">
              <span id="powerUpIcon">💥</span>
              <span id="powerUpName">Power-Up</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this.soloCanvas = document.getElementById('soloCanvas') as HTMLCanvasElement;
    this.soloCtx = this.soloCanvas.getContext('2d')!;

    this.soloBoard = new Board(this.ROWS, this.COLS, cellSize, {
      onScoreChange: (score) => {
        document.getElementById('soloScore')!.textContent = `Pontos: ${score}`;
      },
      onPointsScored: () => {},
      onSwap: () => audio.playSwap(),
      onMatch: () => audio.playMatch(),
      onCombo: () => audio.playCombo(),
      onDrop: () => audio.playDrop(),
      onInvalidMove: () => audio.playInvalid(),
      onNoMoves: () => audio.playPowerUp(),
      onPowerUp: () => audio.playPowerUp(),
      onHint: () => {},
      onEnergyChange: this.updatePowerUpUI.bind(this),
      onPowerUpReady: this.onPowerUpReady.bind(this),
      onPowerUpUsed: () => {
        audio.playPowerUp();
        this.hidePowerUpUI();
      },
      onMatch4Plus: () => {},
      onMoveComplete: () => {},
      onMatchesFound: () => {},
    });

    this.setupSoloInput();
    
    document.getElementById('backBtn')?.addEventListener('click', () => {
      audio.playSwap();
      this.showMenu();
    });
    
    document.getElementById('powerUpBtn')?.addEventListener('click', () => {
      if (this.soloBoard?.hasPowerUp()) {
        if (this.soloBoard.activateStoredPowerUp()) {
          audio.playPowerUp();
        }
      }
    });
  }

  private setupSoloInput(): void {
    if (!this.soloCanvas || !this.soloBoard) return;
    
    const canvas = this.soloCanvas;
    const board = this.soloBoard;
    
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      board.handleClick(x, y);
    });
    
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      this.touchStartX = touch.clientX - rect.left;
      this.touchStartY = touch.clientY - rect.top;
      this.touchStartTime = Date.now();
      this.isDragging = false;
      board.setDragStart(this.touchStartX, this.touchStartY);
    }, { passive: false });
    
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      const dx = x - this.touchStartX;
      const dy = y - this.touchStartY;
      
      if (!this.isDragging && (Math.abs(dx) > this.dragThreshold || Math.abs(dy) > this.dragThreshold)) {
        this.isDragging = true;
        let direction: 'left' | 'right' | 'up' | 'down';
        if (Math.abs(dx) > Math.abs(dy)) {
          direction = dx > 0 ? 'right' : 'left';
        } else {
          direction = dy > 0 ? 'down' : 'up';
        }
        board.swipeGem(this.touchStartX, this.touchStartY, direction);
        board.clearDragStart();
      }
    }, { passive: false });
    
    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (!this.isDragging) {
        const elapsed = Date.now() - this.touchStartTime;
        if (elapsed < 300) {
          board.handleClick(this.touchStartX, this.touchStartY);
        }
      }
      board.clearDragStart();
      this.isDragging = false;
    }, { passive: false });
  }

  private renderSolo(): void {
    if (!this.soloBoard || !this.soloCtx) return;
    this.soloBoard.render(this.soloCtx);
    this.soloBoard.update();
  }

  // ===== VS AI TIME MODE =====
  private startVsAITimeMode(): void {
    this.currentMode = GameMode.VS_AI_TIME;
    this.cleanup();
    
    const cellSize = Math.min(45, Math.floor((window.innerWidth - 60) / (this.COLS * 2 + 1)));
    const boardWidth = this.COLS * cellSize;
    const boardHeight = this.ROWS * cellSize;
    
    this.app.innerHTML = `
      <div class="game-screen vs-time-screen">
        <div class="game-header">
          <button class="back-btn" id="backBtn">← Menu</button>
          <div class="vs-timer" id="vsTimer">${TIME_CONFIG.turnDuration}</div>
        </div>
        <div class="vs-container">
          <div class="player-side human-side">
            <div class="player-label">VOCÊ</div>
            <div class="player-score" id="humanScore">0</div>
            <canvas id="humanCanvas" width="${boardWidth}" height="${boardHeight}"></canvas>
          </div>
          <div class="vs-divider">VS</div>
          <div class="player-side ai-side">
            <div class="player-label">IA</div>
            <div class="player-score" id="aiScore">0</div>
            <canvas id="aiCanvas" width="${boardWidth}" height="${boardHeight}"></canvas>
          </div>
        </div>
        <div class="turn-indicator" id="turnIndicator">Sua vez!</div>
      </div>
    `;
    
    this.timeHumanCanvas = document.getElementById('humanCanvas') as HTMLCanvasElement;
    this.timeAICanvas = document.getElementById('aiCanvas') as HTMLCanvasElement;
    this.timeHumanCtx = this.timeHumanCanvas.getContext('2d')!;
    this.timeAICtx = this.timeAICanvas.getContext('2d')!;
    
    this.timeState = createVsAITimeState();
    
    const updateScores = () => {
      document.getElementById('humanScore')!.textContent = this.timeState!.humanScore.toString();
      document.getElementById('aiScore')!.textContent = this.timeState!.aiScore.toString();
    };
    
    this.timeHumanBoard = new Board(this.ROWS, this.COLS, cellSize, {
      onScoreChange: () => {},
      onPointsScored: (points) => {
        if (this.timeState!.currentTurn === Player.HUMAN) {
          this.timeState!.humanScore += points;
          updateScores();
        }
      },
      onSwap: () => audio.playSwap(),
      onMatch: () => audio.playMatch(),
      onCombo: () => audio.playCombo(),
      onDrop: () => audio.playDrop(),
      onInvalidMove: () => audio.playInvalid(),
      onNoMoves: () => {},
      onPowerUp: () => {},
      onHint: () => {},
      onEnergyChange: () => {},
      onPowerUpReady: () => {},
      onPowerUpUsed: () => {},
      onMatch4Plus: () => {},
      onMoveComplete: () => {},
      onMatchesFound: () => {},
    });
    
    this.timeAIBoard = new Board(this.ROWS, this.COLS, cellSize, {
      onScoreChange: () => {},
      onPointsScored: (points) => {
        if (this.timeState!.currentTurn === Player.AI) {
          this.timeState!.aiScore += points;
          updateScores();
        }
      },
      onSwap: () => audio.playSwap(),
      onMatch: () => audio.playMatch(),
      onCombo: () => audio.playCombo(),
      onDrop: () => audio.playDrop(),
      onInvalidMove: () => {},
      onNoMoves: () => {},
      onPowerUp: () => {},
      onHint: () => {},
      onEnergyChange: () => {},
      onPowerUpReady: () => {},
      onPowerUpUsed: () => {},
      onMatch4Plus: () => {},
      onMoveComplete: () => {},
      onMatchesFound: () => {},
    });
    
    this.setupTimeInput();
    this.startTimeTimer();
    
    document.getElementById('backBtn')?.addEventListener('click', () => {
      audio.playSwap();
      this.showMenu();
    });
  }
  
  private setupTimeInput(): void {
    if (!this.timeHumanCanvas || !this.timeHumanBoard) return;
    
    const canvas = this.timeHumanCanvas;
    const board = this.timeHumanBoard;
    
    canvas.addEventListener('click', (e) => {
      if (this.timeState?.currentTurn !== Player.HUMAN) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      board.handleClick(x, y);
    });
    
    canvas.addEventListener('touchstart', (e) => {
      if (this.timeState?.currentTurn !== Player.HUMAN) return;
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      this.touchStartX = touch.clientX - rect.left;
      this.touchStartY = touch.clientY - rect.top;
      this.touchStartTime = Date.now();
      this.isDragging = false;
      board.setDragStart(this.touchStartX, this.touchStartY);
    }, { passive: false });
    
    canvas.addEventListener('touchmove', (e) => {
      if (this.timeState?.currentTurn !== Player.HUMAN) return;
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      const dx = x - this.touchStartX;
      const dy = y - this.touchStartY;
      
      if (!this.isDragging && (Math.abs(dx) > this.dragThreshold || Math.abs(dy) > this.dragThreshold)) {
        this.isDragging = true;
        let direction: 'left' | 'right' | 'up' | 'down';
        if (Math.abs(dx) > Math.abs(dy)) {
          direction = dx > 0 ? 'right' : 'left';
        } else {
          direction = dy > 0 ? 'down' : 'up';
        }
        board.swipeGem(this.touchStartX, this.touchStartY, direction);
        board.clearDragStart();
      }
    }, { passive: false });
    
    canvas.addEventListener('touchend', (e) => {
      if (this.timeState?.currentTurn !== Player.HUMAN) return;
      e.preventDefault();
      if (!this.isDragging) {
        const elapsed = Date.now() - this.touchStartTime;
        if (elapsed < 300) {
          board.handleClick(this.touchStartX, this.touchStartY);
        }
      }
      board.clearDragStart();
      this.isDragging = false;
    }, { passive: false });
  }
  
  private startTimeTimer(): void {
    if (this.timer) clearInterval(this.timer);
    
    this.timer = window.setInterval(() => {
      if (!this.timeState || this.timeState.isGameOver) return;
      
      this.timeState.timeLeft--;
      document.getElementById('vsTimer')!.textContent = this.timeState.timeLeft.toString();
      
      if (this.timeState.timeLeft <= 0) {
        this.switchTimeTurn();
      }
    }, 1000);
  }
  
  private switchTimeTurn(): void {
    if (!this.timeState) return;
    
    this.timeState.currentTurn = this.timeState.currentTurn === Player.HUMAN ? Player.AI : Player.HUMAN;
    this.timeState.timeLeft = TIME_CONFIG.turnDuration;
    
    const indicator = document.getElementById('turnIndicator')!;
    if (this.timeState.currentTurn === Player.HUMAN) {
      indicator.textContent = 'Sua vez!';
      indicator.className = 'turn-indicator human-turn';
    } else {
      indicator.textContent = 'Vez da IA...';
      indicator.className = 'turn-indicator ai-turn';
      this.doTimeAITurn();
    }
    
    // Check for game over
    if (this.timeState.humanScore >= TIME_CONFIG.winScore || this.timeState.aiScore >= TIME_CONFIG.winScore) {
      this.endTimeGame();
    }
  }
  
  private async doTimeAITurn(): Promise<void> {
    if (!this.timeAIBoard || !this.timeState) return;
    
    while (this.timeState.currentTurn === Player.AI && this.timeState.timeLeft > 0 && !this.timeState.isGameOver) {
      await this.sleep(this.aiPlayer.getThinkingDelay());
      
      const grid = this.timeAIBoard.getGrid();
      const move = this.aiPlayer.findBestMove(grid, this.ROWS, this.COLS);
      
      if (move) {
        this.timeAIBoard.executeMove(move.from, move.to);
      }
      
      await this.sleep(this.aiPlayer.getMoveDelay());
    }
  }
  
  private endTimeGame(): void {
    if (!this.timeState) return;
    
    this.timeState.isGameOver = true;
    if (this.timer) clearInterval(this.timer);
    
    const winner = this.timeState.humanScore >= this.timeState.aiScore ? 'Você' : 'IA';
    const indicator = document.getElementById('turnIndicator')!;
    indicator.textContent = `${winner} venceu!`;
    indicator.className = 'turn-indicator game-over';
    
    audio.playPowerUp();
  }
  
  private renderTime(): void {
    if (this.timeHumanBoard && this.timeHumanCtx) {
      this.timeHumanBoard.render(this.timeHumanCtx);
      this.timeHumanBoard.update();
    }
    if (this.timeAIBoard && this.timeAICtx) {
      this.timeAIBoard.render(this.timeAICtx);
      this.timeAIBoard.update();
    }
  }

  // ===== VS AI TURNS MODE =====
  private startVsAITurnsMode(): void {
    this.currentMode = GameMode.VS_AI_TURNS;
    this.cleanup();
    
    const cellSize = Math.min(50, Math.floor((window.innerWidth - 40) / this.COLS));
    const boardWidth = this.COLS * cellSize;
    const boardHeight = this.ROWS * cellSize;
    
    this.app.innerHTML = `
      <div class="game-screen vs-turns-screen">
        <div class="game-header">
          <button class="back-btn" id="backBtn">← Menu</button>
          <div class="vs-scores">
            <span class="human-score">VOCÊ: <span id="humanScore">0</span></span>
            <span class="ai-score">IA: <span id="aiScore">0</span></span>
          </div>
        </div>
        <div class="turns-info">
          <div class="moves-display">
            <span>Jogadas: </span>
            <span id="movesLeft">${TURNS_CONFIG.movesPerTurn}</span>
          </div>
          <div class="timer-display">
            <span id="moveTimer">${TURNS_CONFIG.moveTimeout}</span>s
          </div>
        </div>
        <div class="game-container">
          <canvas id="turnsCanvas" width="${boardWidth}" height="${boardHeight}"></canvas>
          <div class="power-up-area">
            <button id="powerUpBtn" class="power-up-btn hidden">
              <span id="powerUpIcon">💥</span>
              <span id="powerUpName">Power-Up</span>
            </button>
          </div>
        </div>
        <div class="turn-indicator" id="turnIndicator">Sua vez!</div>
      </div>
    `;
    
    this.turnsSharedCanvas = document.getElementById('turnsCanvas') as HTMLCanvasElement;
    this.turnsSharedCtx = this.turnsSharedCanvas.getContext('2d')!;
    
    this.turnsState = createVsAITurnsState();
    
    this.turnsSharedBoard = new Board(this.ROWS, this.COLS, cellSize, {
      onScoreChange: () => {},
      onPointsScored: (points) => {
        if (!this.turnsState) return;
        if (this.turnsState.currentTurn === Player.HUMAN) {
          this.turnsState.humanScore += points;
        } else {
          this.turnsState.aiScore += points;
        }
        this.updateTurnsScores();
      },
      onSwap: () => audio.playSwap(),
      onMatch: () => audio.playMatch(),
      onCombo: () => audio.playCombo(),
      onDrop: () => audio.playDrop(),
      onInvalidMove: () => audio.playInvalid(),
      onNoMoves: () => audio.playPowerUp(),
      onPowerUp: () => audio.playPowerUp(),
      onHint: () => {},
      onEnergyChange: this.updatePowerUpUI.bind(this),
      onPowerUpReady: this.onPowerUpReady.bind(this),
      onPowerUpUsed: () => {
        audio.playPowerUp();
        this.hidePowerUpUI();
      },
      onMatch4Plus: (count) => {
        if (!this.turnsState) return;
        if (this.turnsState.currentTurn === Player.HUMAN) {
          this.turnsState.humanEnergy += count;
        } else {
          this.turnsState.aiEnergy += count;
        }
      },
      onMoveComplete: (_hadMatch) => {
        if (!this.turnsState || this.turnsState.isGameOver) return;
        
        this.turnsState.movesLeft--;
        document.getElementById('movesLeft')!.textContent = this.turnsState.movesLeft.toString();
        
        if (this.turnsState.movesLeft <= 0) {
          this.switchTurnsTurn();
        } else {
          this.turnsState.timeLeft = TURNS_CONFIG.moveTimeout;
        }
      },
      onMatchesFound: () => {},
    });
    
    this.turnsSharedBoard.setAllowNoMatchMoves(true);
    
    this.setupTurnsInput();
    this.startTurnsTimer();
    
    document.getElementById('backBtn')?.addEventListener('click', () => {
      audio.playSwap();
      this.showMenu();
    });
    
    document.getElementById('powerUpBtn')?.addEventListener('click', () => {
      if (this.turnsState?.currentTurn !== Player.HUMAN) return;
      if (this.turnsSharedBoard?.hasPowerUp()) {
        if (this.turnsSharedBoard.activateStoredPowerUp()) {
          audio.playPowerUp();
        }
      }
    });
  }
  
  private updateTurnsScores(): void {
    if (!this.turnsState) return;
    document.getElementById('humanScore')!.textContent = this.turnsState.humanScore.toString();
    document.getElementById('aiScore')!.textContent = this.turnsState.aiScore.toString();
  }
  
  private setupTurnsInput(): void {
    if (!this.turnsSharedCanvas || !this.turnsSharedBoard) return;
    
    const canvas = this.turnsSharedCanvas;
    const board = this.turnsSharedBoard;
    
    canvas.addEventListener('click', (e) => {
      if (this.turnsState?.currentTurn !== Player.HUMAN) return;
      if (this.turnsState?.waitingForCascade) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      board.handleClick(x, y);
    });
    
    canvas.addEventListener('touchstart', (e) => {
      if (this.turnsState?.currentTurn !== Player.HUMAN) return;
      if (this.turnsState?.waitingForCascade) return;
      
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      this.touchStartX = touch.clientX - rect.left;
      this.touchStartY = touch.clientY - rect.top;
      this.touchStartTime = Date.now();
      this.isDragging = false;
      board.setDragStart(this.touchStartX, this.touchStartY);
    }, { passive: false });
    
    canvas.addEventListener('touchmove', (e) => {
      if (this.turnsState?.currentTurn !== Player.HUMAN) return;
      if (this.turnsState?.waitingForCascade) return;
      
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      const dx = x - this.touchStartX;
      const dy = y - this.touchStartY;
      
      if (!this.isDragging && (Math.abs(dx) > this.dragThreshold || Math.abs(dy) > this.dragThreshold)) {
        this.isDragging = true;
        let direction: 'left' | 'right' | 'up' | 'down';
        if (Math.abs(dx) > Math.abs(dy)) {
          direction = dx > 0 ? 'right' : 'left';
        } else {
          direction = dy > 0 ? 'down' : 'up';
        }
        board.swipeGem(this.touchStartX, this.touchStartY, direction);
        board.clearDragStart();
      }
    }, { passive: false });
    
    canvas.addEventListener('touchend', (e) => {
      if (this.turnsState?.currentTurn !== Player.HUMAN) return;
      if (this.turnsState?.waitingForCascade) return;
      
      e.preventDefault();
      if (!this.isDragging) {
        const elapsed = Date.now() - this.touchStartTime;
        if (elapsed < 300) {
          board.handleClick(this.touchStartX, this.touchStartY);
        }
      }
      board.clearDragStart();
      this.isDragging = false;
    }, { passive: false });
  }
  
  private startTurnsTimer(): void {
    if (this.timer) clearInterval(this.timer);
    
    this.timer = window.setInterval(() => {
      if (!this.turnsState || this.turnsState.isGameOver || this.turnsState.waitingForCascade) return;
      
      this.turnsState.timeLeft--;
      document.getElementById('moveTimer')!.textContent = this.turnsState.timeLeft.toString();
      
      if (this.turnsState.timeLeft <= 0) {
        this.turnsState.movesLeft--;
        document.getElementById('movesLeft')!.textContent = this.turnsState.movesLeft.toString();
        
        if (this.turnsState.movesLeft <= 0) {
          this.switchTurnsTurn();
        } else {
          this.turnsState.timeLeft = TURNS_CONFIG.moveTimeout;
        }
      }
    }, 1000);
  }
  
  private switchTurnsTurn(): void {
    if (!this.turnsState) return;
    
    this.turnsState.currentTurn = this.turnsState.currentTurn === Player.HUMAN ? Player.AI : Player.HUMAN;
    this.turnsState.movesLeft = TURNS_CONFIG.movesPerTurn;
    this.turnsState.timeLeft = TURNS_CONFIG.moveTimeout;
    
    document.getElementById('movesLeft')!.textContent = this.turnsState.movesLeft.toString();
    document.getElementById('moveTimer')!.textContent = this.turnsState.timeLeft.toString();
    
    const indicator = document.getElementById('turnIndicator')!;
    if (this.turnsState.currentTurn === Player.HUMAN) {
      indicator.textContent = 'Sua vez!';
      indicator.className = 'turn-indicator human-turn';
    } else {
      indicator.textContent = 'Vez da IA...';
      indicator.className = 'turn-indicator ai-turn';
      this.doTurnsAITurn();
    }
    
    if (this.turnsState.humanScore >= TURNS_CONFIG.winScore || this.turnsState.aiScore >= TURNS_CONFIG.winScore) {
      this.endTurnsGame();
    }
  }
  
  private async doTurnsAITurn(): Promise<void> {
    if (!this.turnsSharedBoard || !this.turnsState) return;
    
    for (let i = 0; i < TURNS_CONFIG.movesPerTurn; i++) {
      if (this.turnsState.currentTurn !== Player.AI || this.turnsState.isGameOver) break;
      
      await this.sleep(this.aiPlayer.getThinkingDelay());
      
      const grid = this.turnsSharedBoard.getGrid();
      const move = this.aiPlayer.findBestMove(grid, this.ROWS, this.COLS);
      
      if (move) {
        this.turnsSharedBoard.executeMove(move.from, move.to);
      }
      
      await this.sleep(this.aiPlayer.getMoveDelay());
    }
    
    if (!this.turnsState.isGameOver && this.turnsState.currentTurn === Player.AI) {
      this.switchTurnsTurn();
    }
  }
  
  private endTurnsGame(): void {
    if (!this.turnsState) return;
    
    this.turnsState.isGameOver = true;
    if (this.timer) clearInterval(this.timer);
    
    const winner = this.turnsState.humanScore >= this.turnsState.aiScore ? 'Você' : 'IA';
    const indicator = document.getElementById('turnIndicator')!;
    indicator.textContent = `${winner} venceu!`;
    indicator.className = 'turn-indicator game-over';
    
    audio.playPowerUp();
  }
  
  private renderTurns(): void {
    if (this.turnsSharedBoard && this.turnsSharedCtx) {
      this.turnsSharedBoard.render(this.turnsSharedCtx);
      this.turnsSharedBoard.update();
    }
  }

  // ===== POWER-UP UI =====
  private updatePowerUpUI(_energy: number, powerUp: PowerUpConfig | null): void {
    const btn = document.getElementById('powerUpBtn');
    if (!btn) return;
    
    if (powerUp) {
      btn.classList.remove('hidden');
      document.getElementById('powerUpIcon')!.textContent = powerUp.emoji;
      document.getElementById('powerUpName')!.textContent = powerUp.name;
    }
  }
  
  private onPowerUpReady(powerUp: PowerUpConfig): void {
    const btn = document.getElementById('powerUpBtn');
    if (!btn) return;
    
    btn.classList.remove('hidden');
    btn.classList.add('ready');
    document.getElementById('powerUpIcon')!.textContent = powerUp.emoji;
    document.getElementById('powerUpName')!.textContent = powerUp.name;
    audio.playPowerUp();
  }
  
  private hidePowerUpUI(): void {
    const btn = document.getElementById('powerUpBtn');
    if (btn) {
      btn.classList.add('hidden');
      btn.classList.remove('ready');
    }
  }

  // ===== UTILITIES =====
  private cleanup(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    
    this.soloBoard = null;
    this.soloCanvas = null;
    this.soloCtx = null;
    
    this.timeHumanBoard = null;
    this.timeAIBoard = null;
    this.timeHumanCanvas = null;
    this.timeAICanvas = null;
    this.timeHumanCtx = null;
    this.timeAICtx = null;
    this.timeState = null;
    
    this.turnsSharedBoard = null;
    this.turnsSharedCanvas = null;
    this.turnsSharedCtx = null;
    this.turnsState = null;
    
    this.battleBoard = null;
    this.battleCanvas = null;
    this.battleCtx = null;
    this.battleUICanvas = null;
    this.battleUICtx = null;
    this.battleSystem?.destroy();
    this.battleSystem = null;
    this.battleUI = null;
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===== GAME LOOP =====
  private gameLoop(): void {
    switch (this.currentMode) {
      case GameMode.SOLO:
        this.renderSolo();
        break;
      case GameMode.VS_AI_TIME:
        this.renderTime();
        break;
      case GameMode.VS_AI_TURNS:
        if (this.battleBoard) {
          this.renderBattle();
        } else {
          this.renderTurns();
        }
        break;
    }
    
    requestAnimationFrame(() => this.gameLoop());
  }
}

// Start the game
new Game();
