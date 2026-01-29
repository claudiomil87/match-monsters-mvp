import './style.css';
import { Board } from './Board';

class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private board: Board;
  private scoreElement: HTMLElement;

  constructor() {
    // Setup canvas
    this.canvas = document.getElementById('game') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;

    // Setup score display
    this.scoreElement = document.getElementById('score')!;

    // Create board
    this.board = new Board(8, 8, 60, (score) => this.updateScore(score));

    // Set canvas size
    this.canvas.width = this.board.getWidth();
    this.canvas.height = this.board.getHeight();

    // Event listeners
    this.setupEventListeners();

    // Start game loop
    this.gameLoop();
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      this.board.handleClick(x, y);
    });

    // Touch support
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const x = (touch.clientX - rect.left) * scaleX;
      const y = (touch.clientY - rect.top) * scaleY;
      this.board.handleClick(x, y);
    });
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

// Start game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new Game();
});
