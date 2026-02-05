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

  // Renderiza a UI completa
  public render(state: BattleState, boardY: number): void {
    const now = performance.now();
    const deltaTime = now - this.lastTime;
    this.lastTime = now;
    
    this.update(deltaTime);
    
    // Aplica screen shake
    if (this.shakeIntensity > 0) {
      this.ctx.save();
      this.ctx.translate(this.shakeOffset.x, this.shakeOffset.y);
    }
    
    // Área acima do board para UI de batalha
    const uiHeight = boardY;
    const isMobile = this.width < 380;
    const padding = isMobile ? 6 : 10;
    
    // Renderiza header (timer, HP geral, turno, stage) - ocupa ~50% do topo
    const headerHeight = Math.min(95, uiHeight * 0.45);
    this.renderHeader(state, headerHeight * 0.4);
    
    // Área dos monstros começa após o header
    const monstersStartY = headerHeight + 5;
    const monstersHeight = uiHeight - monstersStartY - padding;
    const panelWidth = (this.width - padding * 3) / 2;
    
    // Renderiza jogador (esquerda)
    this.renderTeamPanel(
      state.playerTeam, 
      'player',
      padding, 
      monstersStartY,
      panelWidth,
      monstersHeight,
      state.currentTurn === 'player'
    );
    
    // Renderiza inimigo (direita)
    this.renderTeamPanel(
      state.enemyTeam, 
      'enemy',
      this.width - padding - panelWidth, 
      monstersStartY,
      panelWidth,
      monstersHeight,
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

  private renderHeader(state: BattleState, y: number): void {
    const ctx = this.ctx;
    const centerX = this.width / 2;
    const isMobile = this.width < 380;
    
    // Fundo gradiente do header
    const headerGradient = ctx.createLinearGradient(0, 0, 0, y + 40);
    headerGradient.addColorStop(0, 'rgba(20, 20, 40, 0.95)');
    headerGradient.addColorStop(1, 'rgba(20, 20, 40, 0.7)');
    ctx.fillStyle = headerGradient;
    ctx.fillRect(0, 0, this.width, y + 40);
    
    // === LINHA 1: HP dos dois lados + Timer no centro ===
    const line1Y = 25;
    
    // HP do Jogador (esquerda)
    ctx.textAlign = 'left';
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText('Você', 10, line1Y - 5);
    
    ctx.fillStyle = '#ff6b6b';
    ctx.font = 'bold 18px Arial';
    ctx.fillText(`❤️ ${state.playerTeam.currentHp}`, 10, line1Y + 15);
    
    // HP do Oponente (direita)
    ctx.textAlign = 'right';
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText('Oponente', this.width - 10, line1Y - 5);
    
    ctx.fillStyle = '#ff6b6b';
    ctx.font = 'bold 18px Arial';
    ctx.fillText(`❤️ ${state.enemyTeam.currentHp}`, this.width - 10, line1Y + 15);
    
    // Timer central grande
    const timerSize = isMobile ? 44 : 50;
    const timerY = line1Y + 5;
    
    // Círculo do timer
    ctx.beginPath();
    ctx.arc(centerX, timerY, timerSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fill();
    
    // Borda com cor baseada no tempo
    ctx.strokeStyle = state.timeLeft <= 5 ? UI_CONFIG.timerCritical : 
                      state.timeLeft <= 10 ? UI_CONFIG.timerWarning : '#4CAF50';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Número do timer
    ctx.fillStyle = state.timeLeft <= 5 ? UI_CONFIG.timerCritical : '#fff';
    ctx.font = `bold ${timerSize * 0.5}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.timeLeft.toString(), centerX, timerY);
    
    // === LINHA 2: Indicador de turno centralizado ===
    const line2Y = line1Y + 45;
    
    // Background do turno
    const turnText = state.currentTurn === 'player' ? 'SUA VEZ' : 'VEZ DO OPONENTE';
    const turnColor = state.currentTurn === 'player' ? UI_CONFIG.playerColor : UI_CONFIG.enemyColor;
    const turnWidth = isMobile ? 120 : 150;
    
    ctx.fillStyle = turnColor + '40'; // 25% opacity
    ctx.beginPath();
    ctx.roundRect(centerX - turnWidth/2, line2Y - 12, turnWidth, 24, 12);
    ctx.fill();
    
    ctx.strokeStyle = turnColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(turnText, centerX, line2Y);
    
    // Moves à esquerda do turno
    ctx.textAlign = 'right';
    ctx.font = 'bold 11px Arial';
    ctx.fillStyle = '#aaa';
    ctx.fillText('MOVES', centerX - turnWidth/2 - 10, line2Y - 5);
    
    // Bolinhas de moves
    for (let i = 0; i < 2; i++) {
      const moveX = centerX - turnWidth/2 - 30 + i * 15;
      ctx.beginPath();
      ctx.arc(moveX, line2Y + 8, 5, 0, Math.PI * 2);
      ctx.fillStyle = i < state.movesLeft ? '#4CAF50' : '#333';
      ctx.fill();
    }
    
    // Stage à direita
    ctx.textAlign = 'left';
    ctx.font = 'bold 11px Arial';
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`⭐ ETAPA ${state.stage}`, centerX + turnWidth/2 + 10, line2Y);
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
    const isMobile = this.width < 380;
    
    // Fundo do painel com gradiente
    const panelGradient = ctx.createLinearGradient(x, y, x, y + height);
    if (isActive) {
      const baseColor = side === 'player' ? '76, 175, 80' : '244, 67, 54';
      panelGradient.addColorStop(0, `rgba(${baseColor}, 0.25)`);
      panelGradient.addColorStop(1, `rgba(${baseColor}, 0.1)`);
    } else {
      panelGradient.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
      panelGradient.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
    }
    
    ctx.fillStyle = panelGradient;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 12);
    ctx.fill();
    
    // Borda brilhante se ativo
    if (isActive) {
      ctx.strokeStyle = side === 'player' ? UI_CONFIG.playerColor : UI_CONFIG.enemyColor;
      ctx.lineWidth = 2;
      ctx.shadowColor = side === 'player' ? UI_CONFIG.playerColor : UI_CONFIG.enemyColor;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    
    // Nome do time no topo do painel
    const nameY = y + 14;
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${isMobile ? 11 : 13}px Arial`;
    ctx.textAlign = side === 'player' ? 'left' : 'right';
    ctx.textBaseline = 'middle';
    
    const nameX = side === 'player' ? x + 8 : x + width - 8;
    const displayName = team.playerName.length > 10 ? team.playerName.slice(0, 10) : team.playerName;
    ctx.fillText(displayName, nameX, nameY);
    
    // Renderiza monstros HORIZONTALMENTE (lado a lado)
    const monstersY = y + 28;
    const monstersHeight = height - 35;
    const monsterCount = team.monsters.length;
    const monsterWidth = Math.min(55, (width - 10) / monsterCount);
    const startX = side === 'player' ? x + 5 : x + width - 5 - (monsterCount * monsterWidth);
    
    team.monsters.forEach((monster, index) => {
      this.renderMonsterCompact(
        monster,
        startX + index * monsterWidth,
        monstersY,
        monsterWidth - 4,
        monstersHeight,
        side
      );
    });
  }
  
  // Versão compacta do monstro para mobile
  private renderMonsterCompact(
    monster: Monster,
    x: number,
    y: number,
    width: number,
    height: number,
    _side: 'player' | 'enemy'
  ): void {
    const ctx = this.ctx;
    const isMobile = this.width < 380;
    
    // Card do monstro
    ctx.fillStyle = monster.isDefeated ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 8);
    ctx.fill();
    
    // Cor do elemento como borda
    const elementColor = GEM_COLORS[monster.data.element];
    if (!monster.isDefeated) {
      ctx.strokeStyle = elementColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    // Sprite do monstro (emoji)
    const spriteSize = Math.min(width - 8, isMobile ? 28 : 35);
    const sprite = monster.isEvolved ? monster.data.evolvedSprite : monster.data.sprite;
    ctx.font = `${spriteSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = monster.isDefeated ? '#666' : '#fff';
    ctx.fillText(sprite, x + width/2, y + spriteSize/2 + 4);
    
    // Nome curto do monstro
    const shortName = monster.data.name.slice(0, 4);
    ctx.font = `bold ${isMobile ? 8 : 9}px Arial`;
    ctx.fillStyle = monster.isDefeated ? '#666' : '#fff';
    ctx.fillText(shortName, x + width/2, y + spriteSize + 12);
    
    // Barra de HP mini
    const hpBarY = y + spriteSize + 20;
    const hpBarWidth = width - 8;
    const hpBarHeight = 6;
    const hpPercent = monster.currentHp / monster.maxHp;
    
    // Fundo da barra
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.roundRect(x + 4, hpBarY, hpBarWidth, hpBarHeight, 3);
    ctx.fill();
    
    // HP preenchido
    if (hpPercent > 0) {
      ctx.fillStyle = hpPercent > 0.5 ? '#4CAF50' : hpPercent > 0.25 ? '#ff9800' : '#f44336';
      ctx.beginPath();
      ctx.roundRect(x + 4, hpBarY, hpBarWidth * hpPercent, hpBarHeight, 3);
      ctx.fill();
    }
    
    // HP texto mini
    ctx.font = `bold ${isMobile ? 8 : 9}px Arial`;
    ctx.fillStyle = '#fff';
    ctx.fillText(`${monster.currentHp}/${monster.maxHp}`, x + width/2, hpBarY + hpBarHeight + 8);
    
    // Barra de evolução (se não evoluiu)
    if (!monster.isDefeated && !monster.isEvolved) {
      const evoBarY = hpBarY + hpBarHeight + 14;
      const evoPercent = monster.evolutionProgress / monster.evolutionThreshold;
      
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.roundRect(x + 4, evoBarY, hpBarWidth, 4, 2);
      ctx.fill();
      
      if (evoPercent > 0) {
        ctx.fillStyle = UI_CONFIG.evolutionColor;
        ctx.beginPath();
        ctx.roundRect(x + 4, evoBarY, hpBarWidth * Math.min(1, evoPercent), 4, 2);
        ctx.fill();
      }
      
      // EVOLVE! indicator
      if (evoPercent >= 0.8) {
        ctx.font = 'bold 7px Arial';
        ctx.fillStyle = UI_CONFIG.evolutionColor;
        ctx.fillText('EVOLVE!', x + width/2, evoBarY + 10);
      }
    }
    
    // Indicador de evoluído
    if (monster.isEvolved && !monster.isDefeated) {
      ctx.font = 'bold 8px Arial';
      ctx.fillStyle = UI_CONFIG.evolutionColor;
      ctx.fillText('★ MAX', x + width/2, y + height - 6);
    }
  }

  // Método renderMonster antigo removido - usando renderMonsterCompact para mobile

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
