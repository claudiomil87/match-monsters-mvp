/**
 * Interface de Usuário da Batalha
 * Renderiza monstros, HP, timer, turnos, etc.
 */

import { Team, Monster } from './Monster';
import { BattleState } from './BattleSystem';
import { GEM_COLORS } from './types';
import { animationManager, Easing } from './Animations';

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
  
  // Screen shake
  private shakeOffset: { x: number; y: number } = { x: 0, y: 0 };
  private shakeIntensity: number = 0;

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

    // Adiciona animação de shake na tela para dano crítico
    if (isSuperEffective && !isHeal) {
      this.addScreenShake(300);
    }
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

  // Adiciona screen shake
  public addScreenShake(duration: number, intensity: number = 5): void {
    this.shakeIntensity = intensity;
    
    animationManager.start(`screenShake`, {
      duration,
      easing: Easing.easeOut,
      onUpdate: (progress) => {
        const currentIntensity = intensity * (1 - progress);
        this.shakeOffset.x = (Math.random() - 0.5) * currentIntensity;
        this.shakeOffset.y = (Math.random() - 0.5) * currentIntensity;
      },
      onComplete: () => {
        this.shakeOffset.x = 0;
        this.shakeOffset.y = 0;
        this.shakeIntensity = 0;
      }
    });
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

  // Renderiza a UI completa - LAYOUT COMPACTO
  public render(state: BattleState, _boardY: number): void {
    const now = performance.now();
    const deltaTime = now - this.lastTime;
    this.lastTime = now;
    
    this.update(deltaTime);
    
    // Aplica screen shake
    if (this.shakeIntensity > 0) {
      this.ctx.save();
      this.ctx.translate(this.shakeOffset.x, this.shakeOffset.y);
    }
    
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    
    // === LAYOUT COMPACTO EM 2 SEÇÕES ===
    // Seção 1 (topo, ~35px): Timer + Turno + Stage
    // Seção 2 (resto): Monstros lado a lado
    
    const topBarHeight = 38;
    
    // Fundo escuro
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, H);
    
    // === SEÇÃO 1: TOP BAR ===
    this.renderTopBar(state, topBarHeight);
    
    // === SEÇÃO 2: ÁREA DOS MONSTROS ===
    const monstersY = topBarHeight + 4;
    const monstersH = H - monstersY - 4;
    const gap = 8;
    const panelW = (W - gap * 3) / 2;
    
    // Painel do jogador (esquerda)
    this.renderMonstersPanel(
      state.playerTeam,
      'player',
      gap,
      monstersY,
      panelW,
      monstersH,
      state.currentTurn === 'player'
    );
    
    // Painel do oponente (direita)
    this.renderMonstersPanel(
      state.enemyTeam,
      'enemy',
      W - gap - panelW,
      monstersY,
      panelW,
      monstersH,
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

    // Restaura contexto se houve shake
    if (this.shakeIntensity > 0) {
      this.ctx.restore();
    }
  }
  
  // Top bar compacta: [HP Você] [Timer/Turno/Stage] [HP Oponente]
  private renderTopBar(state: BattleState, height: number): void {
    const ctx = this.ctx;
    const W = this.width;
    
    // Fundo da barra
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, W, height);
    
    const centerX = W / 2;
    const y = height / 2;
    
    // === ESQUERDA: HP do jogador ===
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.fillText('❤️', 8, y);
    ctx.fillStyle = UI_CONFIG.playerColor;
    ctx.font = 'bold 16px Arial';
    ctx.fillText(`${state.playerTeam.currentHp}`, 28, y);
    
    // === CENTRO: Timer + Turno + Stage ===
    // Timer círculo
    const timerR = 14;
    ctx.beginPath();
    ctx.arc(centerX, y, timerR, 0, Math.PI * 2);
    ctx.fillStyle = state.timeLeft <= 5 ? 'rgba(244,67,54,0.3)' : 'rgba(0,0,0,0.5)';
    ctx.fill();
    ctx.strokeStyle = state.timeLeft <= 5 ? '#f44336' : state.timeLeft <= 10 ? '#ff9800' : '#4CAF50';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.fillStyle = state.timeLeft <= 5 ? '#f44336' : '#fff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(state.timeLeft.toString(), centerX, y + 1);
    
    // Turno
    const turnText = state.currentTurn === 'player' ? 'SUA VEZ' : 'OPONENTE';
    const turnColor = state.currentTurn === 'player' ? UI_CONFIG.playerColor : UI_CONFIG.enemyColor;
    ctx.fillStyle = turnColor;
    ctx.font = 'bold 10px Arial';
    ctx.fillText(turnText, centerX, y + timerR + 10);
    
    // Moves (bolinhas)
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(centerX - 35 + i * 12, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = i < state.movesLeft ? '#4CAF50' : '#333';
      ctx.fill();
    }
    
    // Stage
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`⭐${state.stage}`, centerX + 40, y);
    
    // === DIREITA: HP do oponente ===
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.fillText('❤️', W - 28, y);
    ctx.fillStyle = UI_CONFIG.enemyColor;
    ctx.font = 'bold 16px Arial';
    ctx.fillText(`${state.enemyTeam.currentHp}`, W - 35, y);
  }
  
  // Painel de monstros compacto
  private renderMonstersPanel(
    team: Team,
    side: 'player' | 'enemy',
    x: number,
    y: number,
    w: number,
    h: number,
    isActive: boolean
  ): void {
    const ctx = this.ctx;
    
    // Fundo do painel
    const bgColor = isActive 
      ? (side === 'player' ? 'rgba(76,175,80,0.15)' : 'rgba(244,67,54,0.15)')
      : 'rgba(0,0,0,0.2)';
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    
    // Borda se ativo
    if (isActive) {
      ctx.strokeStyle = side === 'player' ? UI_CONFIG.playerColor : UI_CONFIG.enemyColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    // Nome do time
    ctx.fillStyle = '#aaa';
    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(team.playerName.toUpperCase(), x + w/2, y + 3);
    
    // Monstros em linha horizontal
    const monstersY = y + 16;
    const monstersH = h - 20;
    const count = team.monsters.length;
    const monsterW = Math.min(50, (w - 8) / count);
    const startX = x + (w - count * monsterW) / 2;
    
    team.monsters.forEach((monster, i) => {
      this.renderMiniMonster(
        monster,
        startX + i * monsterW,
        monstersY,
        monsterW - 2,
        monstersH
      );
    });
  }
  
  // Mini card de monstro
  private renderMiniMonster(
    monster: Monster,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const ctx = this.ctx;
    
    // Card com cor do elemento
    const elemColor = GEM_COLORS[monster.data.element];
    ctx.fillStyle = monster.isDefeated ? 'rgba(50,50,50,0.8)' : elemColor + '40';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();
    
    if (!monster.isDefeated) {
      ctx.strokeStyle = elemColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    
    // Emoji do monstro
    const sprite = monster.isEvolved ? monster.data.evolvedSprite : monster.data.sprite;
    const fontSize = Math.min(w * 0.6, 24);
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = monster.isDefeated ? '#666' : '#fff';
    ctx.fillText(sprite, x + w/2, y + h * 0.35);
    
    // HP bar
    const barY = y + h * 0.6;
    const barW = w - 6;
    const barH = 5;
    const hpPct = monster.currentHp / monster.maxHp;
    
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.roundRect(x + 3, barY, barW, barH, 2);
    ctx.fill();
    
    if (hpPct > 0) {
      ctx.fillStyle = hpPct > 0.5 ? '#4CAF50' : hpPct > 0.25 ? '#ff9800' : '#f44336';
      ctx.beginPath();
      ctx.roundRect(x + 3, barY, barW * hpPct, barH, 2);
      ctx.fill();
    }
    
    // HP texto
    ctx.fillStyle = monster.isDefeated ? '#666' : '#fff';
    ctx.font = 'bold 8px Arial';
    ctx.fillText(`${monster.currentHp}`, x + w/2, barY + barH + 8);
    
    // X se derrotado
    if (monster.isDefeated) {
      ctx.strokeStyle = '#f44336';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 5, y + 5);
      ctx.lineTo(x + w - 5, y + h - 5);
      ctx.moveTo(x + w - 5, y + 5);
      ctx.lineTo(x + 5, y + h - 5);
      ctx.stroke();
    }
    
    // Indicador de evolução
    if (!monster.isDefeated && monster.isEvolved) {
      ctx.fillStyle = UI_CONFIG.evolutionColor;
      ctx.font = 'bold 7px Arial';
      ctx.fillText('★', x + w/2, y + h - 6);
    }
  }

  // Métodos antigos removidos - usando layout compacto (renderTopBar, renderMonstersPanel, renderMiniMonster)

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
      
      // Partículas de evolução
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + effect.progress * 2;
        const radius = 40 + effect.progress * 20;
        const particleX = effect.x + Math.cos(angle) * radius;
        const particleY = effect.y + Math.sin(angle) * radius;
        
        ctx.globalAlpha = alpha * 0.7;
        ctx.fillStyle = UI_CONFIG.evolutionColor;
        ctx.beginPath();
        ctx.arc(particleX, particleY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Texto principal
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
