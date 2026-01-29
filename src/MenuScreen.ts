// Tela de Menu Inicial

import { GameMode } from './GameState';

export class MenuScreen {
  private container: HTMLElement;
  private onModeSelect: (mode: GameMode) => void;

  constructor(onModeSelect: (mode: GameMode) => void) {
    this.onModeSelect = onModeSelect;
    this.container = document.createElement('div');
    this.container.className = 'menu-screen';
    this.render();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="menu-content">
        <h1 class="menu-title">🎮 Match Monsters</h1>
        <p class="menu-subtitle">Escolha o modo de jogo</p>
        
        <div class="menu-buttons">
          <button class="menu-btn solo-btn" data-mode="solo">
            <span class="btn-emoji">🎯</span>
            <span class="btn-title">SOLO</span>
            <span class="btn-desc">Jogue sozinho</span>
          </button>
          
          <button class="menu-btn vsai-btn" data-mode="vs_ai">
            <span class="btn-emoji">🤖</span>
            <span class="btn-title">VS IA</span>
            <span class="btn-desc">Desafie a máquina!</span>
          </button>
        </div>
        
        <p class="menu-footer">Criado por Cláudio 🤖</p>
      </div>
    `;

    // Event listeners
    this.container.querySelectorAll('.menu-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = (btn as HTMLElement).dataset.mode;
        if (mode === 'solo') {
          this.onModeSelect(GameMode.SOLO);
        } else if (mode === 'vs_ai') {
          this.onModeSelect(GameMode.VS_AI);
        }
      });
    });
  }

  public getElement(): HTMLElement {
    return this.container;
  }

  public show(): void {
    this.container.style.display = 'flex';
  }

  public hide(): void {
    this.container.style.display = 'none';
  }
}
