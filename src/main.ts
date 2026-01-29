import './style.css';
import { Board } from './Board';

class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private board!: Board;
  private scoreElement: HTMLElement;

  // Grid 7x5 como Match Monsters
  private readonly COLS = 7;
  private readonly ROWS = 5;

  constructor() {
    this.canvas = document.getElementById('game') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.scoreElement = document.getElementById('score')!;

    this.setupGame();
    this.setupEventListeners();
    this.gameLoop();

    // Recalcula no resize
    window.addEventListener('resize', () => this.setupGame());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.setupGame(), 100);
    });
  }

  private setupGame(): void {
    // Calcula tamanho da célula baseado na largura disponível
    const maxWidth = Math.min(window.innerWidth - 32, 420);
    const cellSize = Math.floor(maxWidth / this.COLS);
    
    // Recria o board se o tamanho mudou significativamente
    const currentScore = this.board?.getScore() || 0;
    
    this.board = new Board(
      this.ROWS,
      this.COLS,
      cellSize,
      (score) => this.updateScore(score)
    );

    // Se tinha score, mantém (não ideal mas funciona pro MVP)
    if (currentScore > 0) {
      this.board = new Board(
        this.ROWS,
        this.COLS,
        cellSize,
        (score) => this.updateScore(score)
      );
    }

    // Ajusta canvas
    this.canvas.width = this.board.getWidth();
    this.canvas.height = this.board.getHeight();
    
    // CSS para escalar suavemente
    this.canvas.style.width = `${this.board.getWidth()}px`;
    this.canvas.style.height = `${this.board.getHeight()}px`;
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener('click', (e) => this.handleInput(e));
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.handleInput(e.touches[0]);
    }, { passive: false });
  }

  private handleInput(e: MouseEvent | Touch): void {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    this.board.handleClick(x, y);
  }

  private updateScore(score: number): void {
    this.scoreElement.textContent = score.toString();
  }

  private gameLoop = (): void => {
    this.render();
    requestAnimationFrame(this.gameLoop);
  };

  private render(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.board.render(this.ctx);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new Game();
});
