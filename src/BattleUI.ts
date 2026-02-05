/**
 * Interface de Usuário da Batalha
 * Renderiza monstros, HP, timer, turnos, etc.
 */

import { Team, Monster } from './Monster';
import { BattleState } from './BattleSystem';
import { GEM_COLORS } from './types';

// Configurações visuais
const UI_CONFIG = {
  // Cores
  playerColor: '#4CAF50',
  enemyColor: '#f44336',
  hpBarBg: '#333',
  hpBarFill: '#4CAF50',
  hpBarLow: '#ff9800',
  hpBarCritical: '#f44336',
  evolutionColor: '#ffd700',
  timerWarning: '#ff9800',
  timerCritical: '#f44336',
  
  // Dimensões
  monsterSize: 60,
  hpBarWidth: 80,
  hpBarHeight: 8,
  avatarSize: 40,
  padding: 10,
};

// Animação de dano
interface DamagePopup {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  offsetY: number;
}

// Animação de evolução
interface EvolutionEffect {
  x: number;
  y: number;
  progress: number;
  monsterName: string;
}

export class BattleUI {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  
  // Animações
  private damagePopups: DamagePopup[] = [];
  private evolutionEffects: EvolutionEffect[] = [];
  private lastTime: number = 0;
  
  // Mensagens de ação
  private actionMessage: string = '';
  private actionMessageTimer: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.width = canvas.width;
    this.height = canvas.height;
  }

  // Atualiza dimensões
  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  // Adiciona popup de dano
  public addDamagePopup(x: number, y: number, amount: number, isHeal: boolean = false, isSuperEffective: boolean = false): void {
    const text = isHeal ? `+${amount}` : `-${amount}`;
    let color = isHeal ? '#4CAF50' : '#f44336';
    if (isSuperEffective) color = '#ffd700';
    
    this.damagePopups.push({
      x,
      y,
      text,
      color,
      alpha: 1,
      offsetY: 0,
    });
  }

  // Adiciona efeito de evolução
  public addEvolutionEffect(x: number, y: number, monsterName: string): void {
    this.evolutionEffects.push({
      x,
      y,
      progress: 0,
      monsterName,
    });
  }

  // Mostra mensagem de ação
  public showActionMessage(message: string, duration: number = 2000): void {
    this.actionMessage = message;
    this.actionMessageTimer = duration;
  }

  // Atualiza animações
  public update(deltaTime: number): void {
    // Atualiza popups de dano
    this.damagePopups = this.damagePopups.filter(popup => {
      popup.alpha -= deltaTime * 0.001;
      popup.offsetY -= deltaTime * 0.05;
      return popup.alpha > 0;
    });

    // Atualiza efeitos de evolução
    this.evolutionEffects = this.evolutionEffects.filter(effect => {
      effect.progress += deltaTime * 0.001;
      return effect.progress < 2;
    });

    // Atualiza timer de mensagem
    if (this.actionMessageTimer > 0) {
      this.actionMessageTimer -= deltaTime;
      if (this.actionMessageTimer <= 0) {
        this.actionMessage = '';
      }
    }
  }

  // Renderiza a UI completa
  public render(state: BattleState, boardY: number): void {
    const now = performance.now();
    const deltaTime = now - this.lastTime;
    this.lastTime = now;
    
    this.update(deltaTime);
    
    // Área acima do board para UI de batalha
    const uiHeight = boardY;
    
    // Renderiza header (timer, turnos, stage)
    this.renderHeader(state, uiHeight * 0.15);
    
    // Renderiza jogador (esquerda)
    this.renderTeamPanel(
      state.playerTeam, 
      'player',
      UI_CONFIG.padding, 
      uiHeight * 0.2,
      this.width * 0.45,
      uiHeight * 0.75,
      state.currentTurn === 'player'
    );
    
    // Renderiza inimigo (direita)
    this.renderTeamPanel(
      state.enemyTeam, 
      'enemy',
      this.width * 0.55, 
      uiHeight * 0.2,
      this.width * 0.45 - UI_CONFIG.padding,
      uiHeight * 0.75,
      state.currentTurn === 'enemy'
    );

    // Renderiza popups de dano
    this.renderDamagePopups();
    
    // Renderiza efeitos de evolução
    this.renderEvolutionEffects();
    
    // Renderiza mensagem de ação
    if (this.actionMessage) {
      this.renderActionMessage();
    }

    // Overlay de fim de jogo
    if (state.isGameOver) {
      this.renderGameOver(state);
    }
  }

  private renderHeader(state: BattleState, y: number): void {
    const ctx = this.ctx;
    const centerX = this.width / 2;
    
    // Fundo do header
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, this.width, y + 30);
    
    // Timer
    const timerSize = 50;
    ctx.fillStyle = state.timeLeft <= 5 ? UI_CONFIG.timerCritical : 
                    state.timeLeft <= 10 ? UI_CONFIG.timerWarning : '#fff';
    ctx.font = `bold ${timerSize * 0.6}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Círculo do timer
    ctx.beginPath();
    ctx.arc(centerX, y, timerSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fill();
    ctx.strokeStyle = state.timeLeft <= 5 ? UI_CONFIG.timerCritical : '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Número do timer
    ctx.fillStyle = state.timeLeft <= 5 ? UI_CONFIG.timerCritical : '#fff';
    ctx.fillText(state.timeLeft.toString(), centerX, y);
    
    // Label "TIMER"
    ctx.font = 'bold 10px Arial';
    ctx.fillStyle = '#aaa';
    ctx.fillText('TIMER', centerX, y - timerSize / 2 - 8);
    
    // Indicador de turno
    const turnText = state.currentTurn === 'player' ? 'SUA VEZ' : 'VEZ DO OPONENTE';
    const turnColor = state.currentTurn === 'player' ? UI_CONFIG.playerColor : UI_CONFIG.enemyColor;
    
    ctx.fillStyle = turnColor;
    ctx.font = 'bold 14px Arial';
    ctx.fillText(turnText, centerX, y + timerSize / 2 + 15);
    
    // MOVES (jogadas restantes)
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`MOVES`, centerX - 80, y + timerSize / 2 + 15);
    
    // Ícones de moves
    for (let i = 0; i < 2; i++) {
      const moveX = centerX - 55 + i * 20;
      const moveY = y + timerSize / 2 + 13;
      ctx.beginPath();
      ctx.arc(moveX, moveY, 6, 0, Math.PI * 2);
      ctx.fillStyle = i < state.movesLeft ? '#4CAF50' : '#333';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    
    // Stage/Etapa
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.fillText(`ETAPA ${state.stage}`, centerX + 80, y + timerSize / 2 + 15);
  }

  private renderTeamPanel(
    team: Team, 
    side: 'player' | 'enemy',
    x: number, 
    y: number, 
    width: number, 
    height: number,
    isActive: boolean
  ): void {
    const ctx = this.ctx;
    
    // Fundo do painel
    ctx.fillStyle = isActive ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 10);
    ctx.fill();
    
    if (isActive) {
      ctx.strokeStyle = side === 'player' ? UI_CONFIG.playerColor : UI_CONFIG.enemyColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    // Header do jogador
    const headerHeight = 35;
    ctx.fillStyle = side === 'player' ? 'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.3)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, headerHeight, [10, 10, 0, 0]);
    ctx.fill();
    
    // Avatar e nome
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = side === 'player' ? 'left' : 'right';
    ctx.textBaseline = 'middle';
    
    const nameX = side === 'player' ? x + 10 : x + width - 10;
    ctx.fillText(team.playerName, nameX, y + headerHeight / 2);
    
    // HP total da equipe
    const hpText = `${team.currentHp}`;
    ctx.fillStyle = '#ff6b6b';
    ctx.font = 'bold 16px Arial';
    const hpX = side === 'player' ? x + width - 40 : x + 40;
    ctx.textAlign = 'center';
    ctx.fillText('❤️', hpX, y + headerHeight / 2);
    ctx.fillStyle = '#fff';
    ctx.fillText(hpText, hpX + 25, y + headerHeight / 2);
    
    // Renderiza monstros
    const monstersY = y + headerHeight + 10;
    const monstersHeight = height - headerHeight - 20;
    const monsterHeight = monstersHeight / team.monsters.length;
    
    team.monsters.forEach((monster, index) => {
      this.renderMonster(
        monster,
        x + 10,
        monstersY + index * monsterHeight,
        width - 20,
        monsterHeight - 5,
        side
      );
    });
  }

  private renderMonster(
    monster: Monster,
    x: number,
    y: number,
    width: number,
    height: number,
    side: 'player' | 'enemy'
  ): void {
    const ctx = this.ctx;
    
    // Fundo do card do monstro
    ctx.fillStyle = monster.isDefeated ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 8);
    ctx.fill();
    
    // Sprite do monstro
    const spriteSize = Math.min(height - 10, 50);
    const spriteX = side === 'player' ? x + 5 : x + width - spriteSize - 5;
    const spriteY = y + (height - spriteSize) / 2;
    
    // Fundo do elemento
    const elementColor = GEM_COLORS[monster.data.element];
    ctx.fillStyle = monster.isDefeated ? '#333' : elementColor;
    ctx.beginPath();
    ctx.roundRect(spriteX, spriteY, spriteSize, spriteSize, 8);
    ctx.fill();
    
    // Emoji do monstro
    ctx.font = `${spriteSize * 0.6}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      monster.isEvolved ? monster.data.evolvedSprite : monster.data.sprite,
      spriteX + spriteSize / 2,
      spriteY + spriteSize / 2
    );
    
    // Indicador de tipo (ícone pequeno)
    const typeIconSize = 16;
    ctx.fillStyle = elementColor;
    ctx.beginPath();
    ctx.arc(
      spriteX + spriteSize - typeIconSize / 2,
      spriteY + spriteSize - typeIconSize / 2,
      typeIconSize / 2,
      0, Math.PI * 2
    );
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Info do monstro
    const infoX = side === 'player' ? spriteX + spriteSize + 10 : x + 5;
    const infoWidth = width - spriteSize - 20;
    
    // Nome
    ctx.fillStyle = monster.isDefeated ? '#666' : '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = side === 'player' ? 'left' : 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(monster.data.name, infoX + (side === 'player' ? 0 : infoWidth), y + 5);
    
    // EVOLVE! indicator
    if (!monster.isDefeated && !monster.isEvolved && monster.evolutionProgress >= monster.evolutionThreshold * 0.8) {
      const pulse = (Math.sin(Date.now() / 200) + 1) / 2;
      ctx.fillStyle = `rgba(255, 215, 0, ${0.7 + pulse * 0.3})`;
      ctx.font = 'bold 10px Arial';
      ctx.fillText('EVOLVE!', infoX + (side === 'player' ? infoWidth : 0), y + 5);
    }
    
    // Barra de HP
    const hpBarY = y + 22;
    const hpBarWidth = infoWidth;
    const hpBarHeight = 8;
    const hpPercent = monster.currentHp / monster.maxHp;
    
    // Fundo da barra
    ctx.fillStyle = UI_CONFIG.hpBarBg;
    ctx.beginPath();
    ctx.roundRect(infoX, hpBarY, hpBarWidth, hpBarHeight, 4);
    ctx.fill();
    
    // Preenchimento da barra
    let hpColor = UI_CONFIG.hpBarFill;
    if (hpPercent < 0.25) hpColor = UI_CONFIG.hpBarCritical;
    else if (hpPercent < 0.5) hpColor = UI_CONFIG.hpBarLow;
    
    if (!monster.isDefeated) {
      ctx.fillStyle = hpColor;
      ctx.beginPath();
      ctx.roundRect(infoX, hpBarY, hpBarWidth * hpPercent, hpBarHeight, 4);
      ctx.fill();
    }
    
    // Texto HP
    ctx.fillStyle = monster.isDefeated ? '#666' : '#fff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${monster.currentHp}/${monster.maxHp}`,
      infoX + hpBarWidth / 2,
      hpBarY + hpBarHeight + 10
    );
    
    // Barra de evolução (se não evoluiu)
    if (!monster.isDefeated && !monster.isEvolved) {
      const evoBarY = hpBarY + hpBarHeight + 18;
      const evoBarWidth = infoWidth;
      const evoBarHeight = 4;
      const evoPercent = monster.evolutionProgress / monster.evolutionThreshold;
      
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.roundRect(infoX, evoBarY, evoBarWidth, evoBarHeight, 2);
      ctx.fill();
      
      ctx.fillStyle = UI_CONFIG.evolutionColor;
      ctx.beginPath();
      ctx.roundRect(infoX, evoBarY, evoBarWidth * evoPercent, evoBarHeight, 2);
      ctx.fill();
    }
    
    // Indicador de derrotado
    if (monster.isDefeated) {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, 8);
      ctx.fill();
      
      ctx.strokeStyle = '#f44336';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 10, y + 10);
      ctx.lineTo(x + width - 10, y + height - 10);
      ctx.moveTo(x + width - 10, y + 10);
      ctx.lineTo(x + 10, y + height - 10);
      ctx.stroke();
    }
  }

  private renderDamagePopups(): void {
    const ctx = this.ctx;
    
    for (const popup of this.damagePopups) {
      ctx.globalAlpha = popup.alpha;
      ctx.fillStyle = popup.color;
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      ctx.fillText(popup.text, popup.x, popup.y + popup.offsetY);
      ctx.shadowBlur = 0;
    }
    
    ctx.globalAlpha = 1;
  }

  private renderEvolutionEffects(): void {
    const ctx = this.ctx;
    
    for (const effect of this.evolutionEffects) {
      const scale = 1 + effect.progress * 0.5;
      const alpha = 1 - (effect.progress / 2);
      
      ctx.globalAlpha = alpha;
      ctx.fillStyle = UI_CONFIG.evolutionColor;
      ctx.font = `bold ${24 * scale}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 20;
      ctx.fillText('✨ EVOLVE! ✨', effect.x, effect.y - effect.progress * 30);
      ctx.shadowBlur = 0;
    }
    
    ctx.globalAlpha = 1;
  }

  private renderActionMessage(): void {
    const ctx = this.ctx;
    const alpha = Math.min(1, this.actionMessageTimer / 500);
    
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, this.height / 2 - 30, this.width, 60);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.actionMessage, this.width / 2, this.height / 2);
    
    ctx.globalAlpha = 1;
  }

  private renderGameOver(state: BattleState): void {
    const ctx = this.ctx;
    
    // Overlay escuro
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Texto de vitória/derrota
    const isVictory = state.winner === 'player';
    const mainText = isVictory ? '🎉 VITÓRIA! 🎉' : '💀 DERROTA 💀';
    const subText = isVictory ? 'Você venceu a batalha!' : 'Seus monstros foram derrotados...';
    const mainColor = isVictory ? '#4CAF50' : '#f44336';
    
    ctx.fillStyle = mainColor;
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 20;
    ctx.fillText(mainText, this.width / 2, this.height / 2 - 30);
    
    ctx.fillStyle = '#fff';
    ctx.font = '18px Arial';
    ctx.shadowBlur = 0;
    ctx.fillText(subText, this.width / 2, this.height / 2 + 20);
    
    // Botão de reiniciar
    const btnWidth = 150;
    const btnHeight = 40;
    const btnX = this.width / 2 - btnWidth / 2;
    const btnY = this.height / 2 + 60;
    
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnWidth, btnHeight, 8);
    ctx.fill();
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('JOGAR NOVAMENTE', this.width / 2, btnY + btnHeight / 2);
  }

  // Verifica clique no botão de restart
  public checkRestartClick(x: number, y: number, state: BattleState): boolean {
    if (!state.isGameOver) return false;
    
    const btnWidth = 150;
    const btnHeight = 40;
    const btnX = this.width / 2 - btnWidth / 2;
    const btnY = this.height / 2 + 60;
    
    return x >= btnX && x <= btnX + btnWidth && y >= btnY && y <= btnY + btnHeight;
  }
}
