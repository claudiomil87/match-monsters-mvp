import { Gem, GemType, Position, Match, GEM_COLORS } from './types';
import { PowerUpType, ENERGY_NEEDED, getRandomPowerUp, PowerUpConfig } from './PowerUps';

export interface BoardCallbacks {
  onScoreChange: (score: number) => void;
  onPointsScored: (points: number) => void; // Pontos ganhos (para atribuir ao jogador certo)
  onSwap: () => void;
  onMatch: () => void;
  onCombo: (level: number) => void;
  onDrop: () => void;
  onInvalidMove: () => void;
  onNoMoves: () => void;
  onPowerUp: () => void;
  onHint: () => void;
  onEnergyChange: (energy: number, powerUp: PowerUpConfig | null) => void;
  onPowerUpReady: (powerUp: PowerUpConfig) => void;
  onPowerUpUsed: () => void;
  onMatch4Plus: (count: number) => void; // Notifica matches de 4+
  onMoveComplete: (hadMatch: boolean) => void; // Notifica quando uma jogada termina
}

export class Board {
  private grid: (Gem | null)[][];
  private readonly rows: number;
  private readonly cols: number;
  private readonly cellSize: number;
  private readonly padding: number = 4;
  private selectedGem: Position | null = null;
  private dragStartGem: Position | null = null;
  private isAnimating: boolean = false;
  private score: number = 0;
  private comboLevel: number = 0;
  private callbacks: BoardCallbacks;
  
  // Hint system
  private hintPosition: Position | null = null;
  private hintTarget: Position | null = null;
  private lastMoveTime: number = Date.now();
  private hintTimeout: number = 5000; // 5 segundos
  
  // Power-up system
  private powerUpMode: boolean = false;
  private noMovesOverlay: boolean = false;
  private energy: number = 0;
  private storedPowerUp: PowerUpConfig | null = null;
  private activePowerUp: PowerUpType | null = null;
  private selectingTarget: boolean = false;
  
  // Modo de jogo
  private allowNoMatchMoves: boolean = false; // Permite jogadas sem match

  constructor(
    rows: number = 8,
    cols: number = 8,
    cellSize: number = 60,
    callbacks: Partial<BoardCallbacks> = {}
  ) {
    this.rows = rows;
    this.cols = cols;
    this.cellSize = cellSize;
    this.callbacks = {
      onScoreChange: callbacks.onScoreChange || (() => {}),
      onPointsScored: callbacks.onPointsScored || (() => {}),
      onSwap: callbacks.onSwap || (() => {}),
      onMatch: callbacks.onMatch || (() => {}),
      onCombo: callbacks.onCombo || (() => {}),
      onDrop: callbacks.onDrop || (() => {}),
      onInvalidMove: callbacks.onInvalidMove || (() => {}),
      onNoMoves: callbacks.onNoMoves || (() => {}),
      onPowerUp: callbacks.onPowerUp || (() => {}),
      onHint: callbacks.onHint || (() => {}),
      onEnergyChange: callbacks.onEnergyChange || (() => {}),
      onPowerUpReady: callbacks.onPowerUpReady || (() => {}),
      onPowerUpUsed: callbacks.onPowerUpUsed || (() => {}),
      onMatch4Plus: callbacks.onMatch4Plus || (() => {}),
      onMoveComplete: callbacks.onMoveComplete || (() => {}),
    };
    this.grid = [];
    this.initializeBoard();
  }

  private getRandomGemType(): GemType {
    const types = Object.values(GemType);
    return types[Math.floor(Math.random() * types.length)];
  }

  private initializeBoard(): void {
    this.grid = [];
    for (let row = 0; row < this.rows; row++) {
      this.grid[row] = [];
      for (let col = 0; col < this.cols; col++) {
        let gemType: GemType;
        do {
          gemType = this.getRandomGemType();
        } while (this.wouldCreateMatch(row, col, gemType));
        
        this.grid[row][col] = this.createGem(gemType, row, col);
      }
    }
  }

  private createGem(type: GemType, row: number, col: number, isNew: boolean = false): Gem {
    const y = isNew ? -this.cellSize : row * this.cellSize;
    return {
      type,
      row,
      col,
      x: col * this.cellSize,
      y,
      targetY: row * this.cellSize,
      isMatched: false,
      isNew,
    };
  }

  private wouldCreateMatch(row: number, col: number, type: GemType): boolean {
    if (col >= 2) {
      const left1 = this.grid[row]?.[col - 1];
      const left2 = this.grid[row]?.[col - 2];
      if (left1?.type === type && left2?.type === type) {
        return true;
      }
    }
    if (row >= 2) {
      const up1 = this.grid[row - 1]?.[col];
      const up2 = this.grid[row - 2]?.[col];
      if (up1?.type === type && up2?.type === type) {
        return true;
      }
    }
    return false;
  }

  public getWidth(): number {
    return this.cols * this.cellSize;
  }

  public getHeight(): number {
    return this.rows * this.cellSize;
  }

  // Verifica se existe alguma jogada possível
  private findPossibleMove(): { from: Position; to: Position } | null {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        // Tenta trocar com a direita
        if (col < this.cols - 1) {
          if (this.wouldCreateMatchIfSwapped({ row, col }, { row, col: col + 1 })) {
            return { from: { row, col }, to: { row, col: col + 1 } };
          }
        }
        // Tenta trocar com baixo
        if (row < this.rows - 1) {
          if (this.wouldCreateMatchIfSwapped({ row, col }, { row: row + 1, col })) {
            return { from: { row, col }, to: { row: row + 1, col } };
          }
        }
      }
    }
    return null;
  }

  private wouldCreateMatchIfSwapped(pos1: Position, pos2: Position): boolean {
    const gem1 = this.grid[pos1.row][pos1.col];
    const gem2 = this.grid[pos2.row][pos2.col];
    if (!gem1 || !gem2) return false;

    // Faz swap temporário
    this.grid[pos1.row][pos1.col] = gem2;
    this.grid[pos2.row][pos2.col] = gem1;

    // Verifica matches
    const hasMatch = this.checkForMatchAt(pos1) || this.checkForMatchAt(pos2);

    // Desfaz swap
    this.grid[pos1.row][pos1.col] = gem1;
    this.grid[pos2.row][pos2.col] = gem2;

    return hasMatch;
  }

  private checkForMatchAt(pos: Position): boolean {
    const gem = this.grid[pos.row][pos.col];
    if (!gem) return false;

    // Horizontal
    let count = 1;
    let c = pos.col - 1;
    while (c >= 0 && this.grid[pos.row][c]?.type === gem.type) { count++; c--; }
    c = pos.col + 1;
    while (c < this.cols && this.grid[pos.row][c]?.type === gem.type) { count++; c++; }
    if (count >= 3) return true;

    // Vertical
    count = 1;
    let r = pos.row - 1;
    while (r >= 0 && this.grid[r][pos.col]?.type === gem.type) { count++; r--; }
    r = pos.row + 1;
    while (r < this.rows && this.grid[r][pos.col]?.type === gem.type) { count++; r++; }
    if (count >= 3) return true;

    return false;
  }

  // Atualiza hint
  public update(): void {
    if (this.isAnimating || this.powerUpMode || this.noMovesOverlay) return;

    const now = Date.now();
    if (now - this.lastMoveTime > this.hintTimeout && !this.hintPosition) {
      const move = this.findPossibleMove();
      if (move) {
        this.hintPosition = move.from;
        this.hintTarget = move.to;
        this.callbacks.onHint();
      }
    }
  }

  public handleClick(x: number, y: number): void {
    if (this.isAnimating) return;

    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);

    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return;

    // Power-up mode (sem jogadas): explode área
    if (this.powerUpMode) {
      this.activateEmergencyPowerUp(row, col);
      return;
    }

    // Modo de seleção de alvo para power-up
    if (this.selectingTarget && this.activePowerUp) {
      this.usePowerUp(row, col);
      return;
    }

    // Reset hint on interaction
    this.lastMoveTime = Date.now();
    this.hintPosition = null;
    this.hintTarget = null;

    if (this.selectedGem === null) {
      this.selectedGem = { row, col };
    } else {
      const dx = Math.abs(col - this.selectedGem.col);
      const dy = Math.abs(row - this.selectedGem.row);

      if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
        this.swapGems(this.selectedGem, { row, col });
      }
      this.selectedGem = null;
    }
  }

  private async activateEmergencyPowerUp(row: number, col: number): Promise<void> {
    this.powerUpMode = false;
    this.noMovesOverlay = false;
    this.isAnimating = true;
    this.callbacks.onPowerUp();

    // Explode área 3x3
    for (let r = row - 1; r <= row + 1; r++) {
      for (let c = col - 1; c <= col + 1; c++) {
        if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) {
          if (this.grid[r][c]) {
            this.grid[r][c]!.isMatched = true;
          }
        }
      }
    }

    // Pontos bônus
    this.score += 100;
    this.callbacks.onPointsScored(100);
    this.callbacks.onScoreChange(this.score);

    await this.sleep(300);
    this.removeMatchedGems();

    await this.sleep(100);
    this.dropGems();
    this.callbacks.onDrop();

    this.fillEmptySpaces();
    await this.animateFall();

    // Verifica se gerou matches
    const matches = this.findMatches();
    if (matches.length > 0) {
      await this.processMatches();
    }

    this.isAnimating = false;
    this.lastMoveTime = Date.now();

    // Verifica novamente se há jogadas
    this.checkForNoMoves();
  }

  private async swapGems(pos1: Position, pos2: Position): Promise<void> {
    const gem1 = this.grid[pos1.row][pos1.col];
    const gem2 = this.grid[pos2.row][pos2.col];

    if (!gem1 || !gem2) return;

    this.callbacks.onSwap();
    this.lastMoveTime = Date.now();
    this.hintPosition = null;
    this.hintTarget = null;

    this.grid[pos1.row][pos1.col] = gem2;
    this.grid[pos2.row][pos2.col] = gem1;

    gem1.row = pos2.row;
    gem1.col = pos2.col;
    gem1.x = pos2.col * this.cellSize;
    gem1.y = pos2.row * this.cellSize;
    gem1.targetY = pos2.row * this.cellSize;

    gem2.row = pos1.row;
    gem2.col = pos1.col;
    gem2.x = pos1.col * this.cellSize;
    gem2.y = pos1.row * this.cellSize;
    gem2.targetY = pos1.row * this.cellSize;

    const matches = this.findMatches();
    if (matches.length === 0) {
      if (this.allowNoMatchMoves) {
        // Modo turnos: permite jogada sem match, mas notifica
        this.callbacks.onMoveComplete(false);
      } else {
        // Modo normal: desfaz a jogada
        this.callbacks.onInvalidMove();
        
        this.grid[pos1.row][pos1.col] = gem1;
        this.grid[pos2.row][pos2.col] = gem2;

        gem1.row = pos1.row;
        gem1.col = pos1.col;
        gem1.x = pos1.col * this.cellSize;
        gem1.y = pos1.row * this.cellSize;
        gem1.targetY = pos1.row * this.cellSize;

        gem2.row = pos2.row;
        gem2.col = pos2.col;
        gem2.x = pos2.col * this.cellSize;
        gem2.y = pos2.row * this.cellSize;
        gem2.targetY = pos2.row * this.cellSize;
      }
    } else {
      await this.processMatches();
      
      // Notifica que a jogada terminou (com match)
      this.callbacks.onMoveComplete(true);
      
      // Verifica se ainda há jogadas
      this.checkForNoMoves();
    }
  }

  private checkForNoMoves(): void {
    if (this.isAnimating) return;
    
    const move = this.findPossibleMove();
    if (!move) {
      // Sem jogadas! Ativa power-up mode
      this.noMovesOverlay = true;
      this.powerUpMode = true;
      this.callbacks.onNoMoves();
    }
  }

  private findMatches(): Match[] {
    const matches: Match[] = [];
    const matched: boolean[][] = Array(this.rows)
      .fill(null)
      .map(() => Array(this.cols).fill(false));

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols - 2; col++) {
        const gem = this.grid[row][col];
        if (!gem) continue;

        let matchLength = 1;
        while (
          col + matchLength < this.cols &&
          this.grid[row][col + matchLength]?.type === gem.type
        ) {
          matchLength++;
        }

        if (matchLength >= 3) {
          const positions: Position[] = [];
          for (let i = 0; i < matchLength; i++) {
            matched[row][col + i] = true;
            positions.push({ row, col: col + i });
          }
          matches.push({ gems: positions, type: gem.type });
        }
      }
    }

    for (let col = 0; col < this.cols; col++) {
      for (let row = 0; row < this.rows - 2; row++) {
        const gem = this.grid[row][col];
        if (!gem) continue;

        let matchLength = 1;
        while (
          row + matchLength < this.rows &&
          this.grid[row + matchLength][col]?.type === gem.type
        ) {
          matchLength++;
        }

        if (matchLength >= 3) {
          const positions: Position[] = [];
          for (let i = 0; i < matchLength; i++) {
            if (!matched[row + i][col]) {
              positions.push({ row: row + i, col });
            }
            matched[row + i][col] = true;
          }
          if (positions.length > 0) {
            matches.push({ gems: positions, type: gem.type });
          }
        }
      }
    }

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (matched[row][col] && this.grid[row][col]) {
          this.grid[row][col]!.isMatched = true;
        }
      }
    }

    return matches;
  }

  private async processMatches(): Promise<void> {
    this.isAnimating = true;
    this.comboLevel = 0;

    let matches = this.findMatches();
    while (matches.length > 0) {
      this.comboLevel++;
      
      if (this.comboLevel === 1) {
        this.callbacks.onMatch();
      } else {
        this.callbacks.onCombo(this.comboLevel);
      }

      // Calcula energia baseado no tamanho dos matches
      let energyGained = 0;
      let match4PlusCount = 0;
      matches.forEach(m => {
        if (m.gems.length === 4) {
          energyGained += 1;
          match4PlusCount++;
        } else if (m.gems.length >= 5) {
          energyGained += 2;
          match4PlusCount++;
        }
      });
      
      if (energyGained > 0) {
        this.addEnergy(energyGained);
      }
      
      // Notifica matches de 4+
      if (match4PlusCount > 0) {
        this.callbacks.onMatch4Plus(match4PlusCount);
      }

      const points = matches.reduce((sum, m) => sum + m.gems.length * 10, 0) * this.comboLevel;
      this.score += points;
      this.callbacks.onPointsScored(points);
      this.callbacks.onScoreChange(this.score);

      await this.sleep(200);
      this.removeMatchedGems();

      await this.sleep(100);
      this.dropGems();
      this.callbacks.onDrop();

      this.fillEmptySpaces();

      await this.animateFall();

      matches = this.findMatches();
    }

    this.comboLevel = 0;
    this.isAnimating = false;
  }

  // Sistema de energia - junta 4 = ganha power-up aleatório
  private addEnergy(amount: number): void {
    // Se já tem power-up guardado, não ganha mais energia
    if (this.storedPowerUp) return;
    
    this.energy = Math.min(ENERGY_NEEDED, this.energy + amount);
    this.callbacks.onEnergyChange(this.energy, this.storedPowerUp);
    
    // Completou! Ganha power-up aleatório
    if (this.energy >= ENERGY_NEEDED) {
      this.storedPowerUp = getRandomPowerUp();
      this.callbacks.onPowerUpReady(this.storedPowerUp);
    }
  }

  public getEnergy(): number {
    return this.energy;
  }

  public getStoredPowerUp(): PowerUpConfig | null {
    return this.storedPowerUp;
  }

  public hasPowerUp(): boolean {
    return this.storedPowerUp !== null;
  }

  public activateStoredPowerUp(): boolean {
    if (!this.storedPowerUp || this.isAnimating || this.powerUpMode) return false;
    
    this.activePowerUp = this.storedPowerUp.type;
    this.selectingTarget = true;
    return true;
  }

  public cancelPowerUpMode(): void {
    this.activePowerUp = null;
    this.selectingTarget = false;
  }

  public isSelectingTarget(): boolean {
    return this.selectingTarget;
  }

  public getActivePowerUp(): PowerUpType | null {
    return this.activePowerUp;
  }

  private async usePowerUp(row: number, col: number): Promise<void> {
    if (!this.activePowerUp || !this.storedPowerUp) return;
    
    const type = this.activePowerUp;
    
    // Gasta o power-up
    this.storedPowerUp = null;
    this.energy = 0;
    this.callbacks.onEnergyChange(this.energy, null);
    this.callbacks.onPowerUpUsed();
    
    this.selectingTarget = false;
    this.activePowerUp = null;
    this.isAnimating = true;

    switch (type) {
      case PowerUpType.BOMB:
        await this.executeBomb(row, col);
        break;
      case PowerUpType.LIGHTNING:
        await this.executeLightning(row, col);
        break;
      case PowerUpType.RAINBOW:
        await this.executeRainbow(row, col);
        break;
      case PowerUpType.SHUFFLE:
        await this.executeShuffle();
        break;
    }

    this.isAnimating = false;
    this.lastMoveTime = Date.now();
    this.checkForNoMoves();
  }

  private async executeBomb(row: number, col: number): Promise<void> {
    // Explode área 3x3
    for (let r = row - 1; r <= row + 1; r++) {
      for (let c = col - 1; c <= col + 1; c++) {
        if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) {
          if (this.grid[r][c]) {
            this.grid[r][c]!.isMatched = true;
          }
        }
      }
    }

    this.score += 50;
    this.callbacks.onPointsScored(50);
    this.callbacks.onScoreChange(this.score);

    await this.sleep(300);
    this.removeMatchedGems();
    await this.sleep(100);
    this.dropGems();
    this.callbacks.onDrop();
    this.fillEmptySpaces();
    await this.animateFall();

    // Processa matches em cascata
    const matches = this.findMatches();
    if (matches.length > 0) {
      await this.processMatches();
    }
  }

  private async executeLightning(row: number, col: number): Promise<void> {
    // Remove linha inteira + coluna inteira (cruz)
    for (let c = 0; c < this.cols; c++) {
      if (this.grid[row][c]) {
        this.grid[row][c]!.isMatched = true;
      }
    }
    for (let r = 0; r < this.rows; r++) {
      if (this.grid[r][col]) {
        this.grid[r][col]!.isMatched = true;
      }
    }

    this.score += 100;
    this.callbacks.onPointsScored(100);
    this.callbacks.onScoreChange(this.score);

    await this.sleep(300);
    this.removeMatchedGems();
    await this.sleep(100);
    this.dropGems();
    this.callbacks.onDrop();
    this.fillEmptySpaces();
    await this.animateFall();

    const matches = this.findMatches();
    if (matches.length > 0) {
      await this.processMatches();
    }
  }

  private async executeRainbow(row: number, col: number): Promise<void> {
    // Remove todas as gemas da mesma cor que a selecionada
    const targetGem = this.grid[row][col];
    if (!targetGem) return;

    const targetType = targetGem.type;
    let count = 0;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c]?.type === targetType) {
          this.grid[r][c]!.isMatched = true;
          count++;
        }
      }
    }

    const colorPoints = count * 15;
    this.score += colorPoints;
    this.callbacks.onPointsScored(colorPoints);
    this.callbacks.onScoreChange(this.score);

    await this.sleep(300);
    this.removeMatchedGems();
    await this.sleep(100);
    this.dropGems();
    this.callbacks.onDrop();
    this.fillEmptySpaces();
    await this.animateFall();

    const matches = this.findMatches();
    if (matches.length > 0) {
      await this.processMatches();
    }
  }

  private async executeShuffle(): Promise<void> {
    // Coleta todas as gemas
    const gems: GemType[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c]) {
          gems.push(this.grid[r][c]!.type);
        }
      }
    }

    // Embaralha
    for (let i = gems.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [gems[i], gems[j]] = [gems[j], gems[i]];
    }

    // Redistribui
    let idx = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] && idx < gems.length) {
          this.grid[r][c]!.type = gems[idx];
          this.grid[r][c]!.isNew = true;
          idx++;
        }
      }
    }

    await this.sleep(300);

    // Marca como não novo
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c]) {
          this.grid[r][c]!.isNew = false;
        }
      }
    }

    // Processa matches que podem ter surgido
    const matches = this.findMatches();
    if (matches.length > 0) {
      await this.processMatches();
    }
  }

  private removeMatchedGems(): void {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (this.grid[row][col]?.isMatched) {
          this.grid[row][col] = null;
        }
      }
    }
  }

  private dropGems(): void {
    for (let col = 0; col < this.cols; col++) {
      let emptyRow = this.rows - 1;
      for (let row = this.rows - 1; row >= 0; row--) {
        if (this.grid[row][col] !== null) {
          if (row !== emptyRow) {
            this.grid[emptyRow][col] = this.grid[row][col];
            this.grid[row][col] = null;
            this.grid[emptyRow][col]!.row = emptyRow;
            this.grid[emptyRow][col]!.targetY = emptyRow * this.cellSize;
          }
          emptyRow--;
        }
      }
    }
  }

  private fillEmptySpaces(): void {
    for (let col = 0; col < this.cols; col++) {
      let emptyCount = 0;
      for (let row = 0; row < this.rows; row++) {
        if (this.grid[row][col] === null) {
          emptyCount++;
        }
      }
      
      let newGemIndex = 0;
      for (let row = 0; row < this.rows; row++) {
        if (this.grid[row][col] === null) {
          const type = this.getRandomGemType();
          const gem = this.createGem(type, row, col, true);
          gem.y = -(emptyCount - newGemIndex) * this.cellSize;
          this.grid[row][col] = gem;
          newGemIndex++;
        }
      }
    }
  }

  private async animateFall(): Promise<void> {
    const animationDuration = 300;
    const startTime = Date.now();

    return new Promise((resolve) => {
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / animationDuration, 1);
        const eased = this.easeOutBounce(progress);

        let stillAnimating = false;
        for (let row = 0; row < this.rows; row++) {
          for (let col = 0; col < this.cols; col++) {
            const gem = this.grid[row][col];
            if (gem && gem.y !== gem.targetY) {
              const startY = gem.isNew ? gem.y : gem.y;
              gem.y = startY + (gem.targetY - startY) * eased;
              if (Math.abs(gem.y - gem.targetY) > 0.1) {
                stillAnimating = true;
              } else {
                gem.y = gem.targetY;
                gem.isNew = false;
              }
            }
          }
        }

        if (progress < 1 || stillAnimating) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(animate);
    });
  }

  private easeOutBounce(x: number): number {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (x < 1 / d1) {
      return n1 * x * x;
    } else if (x < 2 / d1) {
      return n1 * (x -= 1.5 / d1) * x + 0.75;
    } else if (x < 2.5 / d1) {
      return n1 * (x -= 2.25 / d1) * x + 0.9375;
    } else {
      return n1 * (x -= 2.625 / d1) * x + 0.984375;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public render(ctx: CanvasRenderingContext2D): void {
    // Fundo do board
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, this.getWidth(), this.getHeight());

    // Grid
    ctx.strokeStyle = '#2a2a4e';
    ctx.lineWidth = 1;
    for (let row = 0; row <= this.rows; row++) {
      ctx.beginPath();
      ctx.moveTo(0, row * this.cellSize);
      ctx.lineTo(this.getWidth(), row * this.cellSize);
      ctx.stroke();
    }
    for (let col = 0; col <= this.cols; col++) {
      ctx.beginPath();
      ctx.moveTo(col * this.cellSize, 0);
      ctx.lineTo(col * this.cellSize, this.getHeight());
      ctx.stroke();
    }

    // Gemas
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const gem = this.grid[row][col];
        if (gem) {
          this.renderGem(ctx, gem);
        }
      }
    }

    // Hint animation
    if (this.hintPosition && this.hintTarget) {
      const pulse = (Math.sin(Date.now() / 200) + 1) / 2;
      ctx.strokeStyle = `rgba(255, 215, 0, ${0.5 + pulse * 0.5})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 10 + pulse * 10;
      
      // Pisca a gema de origem
      ctx.strokeRect(
        this.hintPosition.col * this.cellSize + 3,
        this.hintPosition.row * this.cellSize + 3,
        this.cellSize - 6,
        this.cellSize - 6
      );
      
      // Seta indicando direção
      const fromX = this.hintPosition.col * this.cellSize + this.cellSize / 2;
      const fromY = this.hintPosition.row * this.cellSize + this.cellSize / 2;
      const toX = this.hintTarget.col * this.cellSize + this.cellSize / 2;
      const toY = this.hintTarget.row * this.cellSize + this.cellSize / 2;
      
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
      
      ctx.shadowBlur = 0;
    }

    // Feedback visual para drag
    if (this.dragStartGem && !this.powerUpMode) {
      const { row, col } = this.dragStartGem;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 10;
      ctx.strokeRect(
        col * this.cellSize + 2,
        row * this.cellSize + 2,
        this.cellSize - 4,
        this.cellSize - 4
      );
      ctx.shadowBlur = 0;
    }

    // Seleção com animação de pulso (tap mode)
    if (this.selectedGem && !this.dragStartGem && !this.powerUpMode) {
      const { row, col } = this.selectedGem;
      const pulse = Math.sin(Date.now() / 150) * 2 + 3;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = pulse;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 15;
      ctx.strokeRect(
        col * this.cellSize + 3,
        row * this.cellSize + 3,
        this.cellSize - 6,
        this.cellSize - 6
      );
      ctx.shadowBlur = 0;
    }

    // Overlay de "sem jogadas" + power-up mode
    if (this.noMovesOverlay) {
      // Escurece o fundo
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, this.getWidth(), this.getHeight());

      // Texto "SEM JOGADAS!"
      const pulse = (Math.sin(Date.now() / 300) + 1) / 2;
      ctx.fillStyle = `rgba(255, 100, 100, ${0.8 + pulse * 0.2})`;
      ctx.font = `bold ${this.cellSize * 0.5}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 20;
      ctx.fillText('SEM JOGADAS!', this.getWidth() / 2, this.getHeight() / 2 - this.cellSize * 0.6);

      // Texto do power-up
      ctx.fillStyle = `rgba(100, 255, 100, ${0.8 + pulse * 0.2})`;
      ctx.font = `bold ${this.cellSize * 0.35}px sans-serif`;
      ctx.shadowColor = '#00ff00';
      ctx.fillText('💣 SUPER PODER!', this.getWidth() / 2, this.getHeight() / 2);
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = `${this.cellSize * 0.25}px sans-serif`;
      ctx.shadowBlur = 0;
      ctx.fillText('Toque em uma gema para explodir!', this.getWidth() / 2, this.getHeight() / 2 + this.cellSize * 0.5);
    }

    // Indicador visual de seleção de alvo para power-up (sem overlay escuro)
    if (this.selectingTarget && this.activePowerUp) {
      // Auto-executa shuffle (não precisa de alvo)
      if (this.activePowerUp === PowerUpType.SHUFFLE) {
        this.usePowerUp(0, 0);
        return;
      }

      // Apenas borda sutil pulsante - sem escurecer
      const pulse = (Math.sin(Date.now() / 200) + 1) / 2;
      ctx.strokeStyle = `rgba(0, 255, 100, ${0.6 + pulse * 0.4})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 5]);
      ctx.strokeRect(1, 1, this.getWidth() - 2, this.getHeight() - 2);
      ctx.setLineDash([]);
    }
  }

  private renderGem(ctx: CanvasRenderingContext2D, gem: Gem): void {
    const x = gem.x + this.padding;
    const y = gem.y + this.padding;
    const size = this.cellSize - this.padding * 2;
    const radius = 12;
    const centerX = x + size / 2;
    const centerY = y + size / 2;

    // Glow para matched
    if (gem.isMatched) {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 25;
    }

    // Sombra da gema
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, size, size, radius);
    ctx.fill();

    // Corpo da gema
    const baseColor = GEM_COLORS[gem.type];
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, radius);
    ctx.fill();

    // Brilho superior
    const gradient = ctx.createLinearGradient(x, y, x, y + size);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.15)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, radius);
    ctx.fill();

    // Desenha ícone específico de cada elemento
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1.5;
    
    const iconSize = size * 0.45;
    
    switch (gem.type) {
      case GemType.FIRE:
        this.drawFlame(ctx, centerX, centerY, iconSize);
        break;
      case GemType.WATER:
        this.drawDroplet(ctx, centerX, centerY, iconSize);
        break;
      case GemType.GRASS:
        this.drawLeaf(ctx, centerX, centerY, iconSize);
        break;
      case GemType.ELECTRIC:
        this.drawBolt(ctx, centerX, centerY, iconSize);
        break;
      case GemType.PSYCHIC:
        this.drawCrystal(ctx, centerX, centerY, iconSize);
        break;
      case GemType.DARK:
        this.drawStar(ctx, centerX, centerY, iconSize);
        break;
    }

    // Reset shadow
    ctx.shadowBlur = 0;
  }

  private drawFlame(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.6);
    ctx.bezierCurveTo(cx + size * 0.4, cy - size * 0.2, cx + size * 0.5, cy + size * 0.3, cx, cy + size * 0.5);
    ctx.bezierCurveTo(cx - size * 0.5, cy + size * 0.3, cx - size * 0.4, cy - size * 0.2, cx, cy - size * 0.6);
    ctx.fill();
    ctx.stroke();
  }

  private drawDroplet(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.5);
    ctx.bezierCurveTo(cx + size * 0.5, cy, cx + size * 0.4, cy + size * 0.5, cx, cy + size * 0.5);
    ctx.bezierCurveTo(cx - size * 0.4, cy + size * 0.5, cx - size * 0.5, cy, cx, cy - size * 0.5);
    ctx.fill();
    ctx.stroke();
  }

  private drawLeaf(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.5);
    ctx.bezierCurveTo(cx + size * 0.6, cy - size * 0.3, cx + size * 0.6, cy + size * 0.3, cx, cy + size * 0.5);
    ctx.bezierCurveTo(cx - size * 0.6, cy + size * 0.3, cx - size * 0.6, cy - size * 0.3, cx, cy - size * 0.5);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.35);
    ctx.lineTo(cx, cy + size * 0.35);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1.5;
  }

  private drawBolt(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
    ctx.beginPath();
    ctx.moveTo(cx + size * 0.1, cy - size * 0.55);
    ctx.lineTo(cx - size * 0.2, cy - size * 0.05);
    ctx.lineTo(cx + size * 0.05, cy - size * 0.05);
    ctx.lineTo(cx - size * 0.15, cy + size * 0.55);
    ctx.lineTo(cx + size * 0.15, cy + size * 0.05);
    ctx.lineTo(cx - size * 0.1, cy + size * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  private drawCrystal(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.5);
    ctx.lineTo(cx + size * 0.4, cy - size * 0.1);
    ctx.lineTo(cx + size * 0.25, cy + size * 0.5);
    ctx.lineTo(cx - size * 0.25, cy + size * 0.5);
    ctx.lineTo(cx - size * 0.4, cy - size * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  private drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
    const spikes = 5;
    const outerRadius = size * 0.5;
    const innerRadius = size * 0.25;
    
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI / spikes) - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  public getScore(): number {
    return this.score;
  }

  public setDragStart(x: number, y: number): void {
    if (this.isAnimating) return;
    
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    
    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
      this.dragStartGem = { row, col };
    }
  }

  public clearDragStart(): void {
    this.dragStartGem = null;
  }

  public swipeGem(x: number, y: number, direction: 'left' | 'right' | 'up' | 'down'): void {
    if (this.isAnimating) return;

    // Se em power-up mode (sem jogadas), qualquer toque ativa
    if (this.powerUpMode) {
      const col = Math.floor(x / this.cellSize);
      const row = Math.floor(y / this.cellSize);
      if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
        this.activateEmergencyPowerUp(row, col);
      }
      return;
    }

    // Se selecionando alvo para power-up
    if (this.selectingTarget && this.activePowerUp) {
      const col = Math.floor(x / this.cellSize);
      const row = Math.floor(y / this.cellSize);
      if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
        this.usePowerUp(row, col);
      }
      return;
    }

    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);

    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return;

    let targetRow = row;
    let targetCol = col;

    switch (direction) {
      case 'left':
        targetCol = col - 1;
        break;
      case 'right':
        targetCol = col + 1;
        break;
      case 'up':
        targetRow = row - 1;
        break;
      case 'down':
        targetRow = row + 1;
        break;
    }

    if (targetRow < 0 || targetRow >= this.rows || targetCol < 0 || targetCol >= this.cols) {
      return;
    }

    this.selectedGem = null;
    this.swapGems({ row, col }, { row: targetRow, col: targetCol });
  }

  public isPowerUpMode(): boolean {
    return this.powerUpMode;
  }

  // Modo de jogo
  public setAllowNoMatchMoves(allow: boolean): void {
    this.allowNoMatchMoves = allow;
  }

  // Para a IA acessar o grid
  public getGrid(): (GemType | null)[][] {
    return this.grid.map(row => row.map(gem => gem?.type || null));
  }

  // Para a IA executar jogadas
  public executeMove(from: Position, to: Position): void {
    if (this.isAnimating) return;
    this.swapGems(from, to);
  }
}
