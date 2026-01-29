import { Gem, GemType, Position, Match, GEM_COLORS } from './types';

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
  private onScoreChange: (score: number) => void;

  constructor(
    rows: number = 8,
    cols: number = 8,
    cellSize: number = 60,
    onScoreChange: (score: number) => void = () => {}
  ) {
    this.rows = rows;
    this.cols = cols;
    this.cellSize = cellSize;
    this.onScoreChange = onScoreChange;
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

  public handleClick(x: number, y: number): void {
    if (this.isAnimating) return;

    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);

    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return;

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

  private async swapGems(pos1: Position, pos2: Position): Promise<void> {
    const gem1 = this.grid[pos1.row][pos1.col];
    const gem2 = this.grid[pos2.row][pos2.col];

    if (!gem1 || !gem2) return;

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
    } else {
      await this.processMatches();
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

    let matches = this.findMatches();
    while (matches.length > 0) {
      const points = matches.reduce((sum, m) => sum + m.gems.length * 10, 0);
      this.score += points;
      this.onScoreChange(this.score);

      await this.sleep(200);
      this.removeMatchedGems();

      await this.sleep(100);
      this.dropGems();

      this.fillEmptySpaces();

      await this.animateFall();

      matches = this.findMatches();
    }

    this.isAnimating = false;
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

    // Feedback visual para drag
    if (this.dragStartGem) {
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
    if (this.selectedGem && !this.dragStartGem) {
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

  // Chama de fogo
  private drawFlame(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.6);
    ctx.bezierCurveTo(cx + size * 0.4, cy - size * 0.2, cx + size * 0.5, cy + size * 0.3, cx, cy + size * 0.5);
    ctx.bezierCurveTo(cx - size * 0.5, cy + size * 0.3, cx - size * 0.4, cy - size * 0.2, cx, cy - size * 0.6);
    ctx.fill();
    ctx.stroke();
  }

  // Gota d'água
  private drawDroplet(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.5);
    ctx.bezierCurveTo(cx + size * 0.5, cy, cx + size * 0.4, cy + size * 0.5, cx, cy + size * 0.5);
    ctx.bezierCurveTo(cx - size * 0.4, cy + size * 0.5, cx - size * 0.5, cy, cx, cy - size * 0.5);
    ctx.fill();
    ctx.stroke();
  }

  // Folha
  private drawLeaf(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.5);
    ctx.bezierCurveTo(cx + size * 0.6, cy - size * 0.3, cx + size * 0.6, cy + size * 0.3, cx, cy + size * 0.5);
    ctx.bezierCurveTo(cx - size * 0.6, cy + size * 0.3, cx - size * 0.6, cy - size * 0.3, cx, cy - size * 0.5);
    ctx.fill();
    ctx.stroke();
    // Nervura central
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.35);
    ctx.lineTo(cx, cy + size * 0.35);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1.5;
  }

  // Raio
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

  // Cristal/Diamante
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

  // Estrela
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

  // Métodos para drag/swipe
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

    // Verifica se o target está dentro dos limites
    if (targetRow < 0 || targetRow >= this.rows || targetCol < 0 || targetCol >= this.cols) {
      return;
    }

    // Limpa seleção anterior se houver
    this.selectedGem = null;
    
    // Executa o swap
    this.swapGems({ row, col }, { row: targetRow, col: targetCol });
  }
}
