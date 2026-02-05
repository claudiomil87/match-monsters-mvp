/**
 * Sistema de Batalha
 * Gerencia combates entre duas equipes de monstros
 */

import { GemType } from './types';
import { 
  Team, 
  getTypeMultiplier, 
  damageMonster, 
  healMonster,
  addEvolutionProgress,
  getActiveMonster,
  isTeamDefeated,
} from './Monster';
import { getBattleTimeLimit, canEvolveMonsters } from './GameBalance';

// Configurações de batalha
export interface BattleConfig {
  turnTimeLimit: number;     // Tempo por turno (segundos)
  movesPerTurn: number;      // Jogadas por turno
  baseDamagePerGem: number;  // Dano base por gema combinada
  healPerBerry: number;      // Cura por berry
  comboMultiplier: number;   // Multiplicador por combo
  evolutionBonus: number;    // Bônus de dano ao evoluir
}

export const DEFAULT_BATTLE_CONFIG: BattleConfig = {
  turnTimeLimit: 30, // Será ajustado por stage
  movesPerTurn: 2,
  baseDamagePerGem: 2,
  healPerBerry: 5,
  comboMultiplier: 0.25,
  evolutionBonus: 10,
};

// Estado atual da batalha
export interface BattleState {
  playerTeam: Team;
  enemyTeam: Team;
  currentTurn: 'player' | 'enemy';
  turnNumber: number;
  movesLeft: number;
  timeLeft: number;
  isGameOver: boolean;
  winner: 'player' | 'enemy' | null;
  lastAction: BattleAction | null;
  waitingForCascade: boolean;
  stage: number; // Nível/etapa atual
}

// Ação de batalha (para feedback visual)
export interface BattleAction {
  type: 'damage' | 'heal' | 'evolve' | 'defeat' | 'super_effective' | 'not_effective';
  source: 'player' | 'enemy';
  target: 'player' | 'enemy';
  amount: number;
  gemType?: GemType;
  monsterName?: string;
  message: string;
}

// Resultado de um match processado
export interface MatchResult {
  totalDamage: number;
  totalHeal: number;
  actions: BattleAction[];
  evolutions: string[]; // Nomes dos monstros que evoluíram
  defeatedMonsters: string[];
}

// Callbacks para eventos de batalha
export interface BattleCallbacks {
  onDamage: (action: BattleAction) => void;
  onHeal: (action: BattleAction) => void;
  onEvolve: (monsterName: string, team: 'player' | 'enemy') => void;
  onDefeat: (monsterName: string, team: 'player' | 'enemy') => void;
  onTurnChange: (currentTurn: 'player' | 'enemy') => void;
  onGameOver: (winner: 'player' | 'enemy') => void;
  onTimeUpdate: (timeLeft: number) => void;
  onMovesUpdate: (movesLeft: number) => void;
}

export class BattleSystem {
  private state: BattleState;
  private config: BattleConfig;
  private callbacks: Partial<BattleCallbacks>;
  private timerInterval: number | null = null;

  constructor(
    playerTeam: Team,
    enemyTeam: Team,
    config: Partial<BattleConfig> = {},
    callbacks: Partial<BattleCallbacks> = {}
  ) {
    this.config = { ...DEFAULT_BATTLE_CONFIG, ...config };
    this.callbacks = callbacks;
    
    this.state = {
      playerTeam,
      enemyTeam,
      currentTurn: 'player', // Jogador sempre começa
      turnNumber: 1,
      movesLeft: this.config.movesPerTurn,
      timeLeft: this.config.turnTimeLimit,
      isGameOver: false,
      winner: null,
      lastAction: null,
      waitingForCascade: false,
      stage: 1,
    };
  }

  // Inicia o timer do turno
  public startTimer(): void {
    this.stopTimer();
    this.state.timeLeft = this.config.turnTimeLimit;
    
    this.timerInterval = window.setInterval(() => {
      this.state.timeLeft--;
      this.callbacks.onTimeUpdate?.(this.state.timeLeft);
      
      if (this.state.timeLeft <= 0) {
        this.endTurn();
      }
    }, 1000);
  }

  // Para o timer
  public stopTimer(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // Pausa o timer (durante cascata)
  public pauseTimer(): void {
    this.stopTimer();
  }

  // Retoma o timer
  public resumeTimer(): void {
    if (!this.state.isGameOver && this.state.timeLeft > 0) {
      this.timerInterval = window.setInterval(() => {
        this.state.timeLeft--;
        this.callbacks.onTimeUpdate?.(this.state.timeLeft);
        
        if (this.state.timeLeft <= 0) {
          this.endTurn();
        }
      }, 1000);
    }
  }

  // Processa matches e aplica dano/cura
  public processMatches(
    matches: { gems: { row: number; col: number }[]; type: GemType }[],
    comboLevel: number = 1
  ): MatchResult {
    const result: MatchResult = {
      totalDamage: 0,
      totalHeal: 0,
      actions: [],
      evolutions: [],
      defeatedMonsters: [],
    };

    if (this.state.isGameOver) return result;

    const attacker = this.state.currentTurn;
    const defender = attacker === 'player' ? 'enemy' : 'player';
    const attackerTeam = attacker === 'player' ? this.state.playerTeam : this.state.enemyTeam;
    const defenderTeam = defender === 'player' ? this.state.playerTeam : this.state.enemyTeam;

    // Processa cada match
    for (const match of matches) {
      const gemCount = match.gems.length;
      const gemType = match.type;
      
      // Berry cura em vez de causar dano
      if (gemType === GemType.BERRY) {
        const healAmount = gemCount * this.config.healPerBerry;
        const activeMonster = getActiveMonster(attackerTeam);
        
        if (activeMonster) {
          const actualHeal = healMonster(activeMonster, healAmount);
          attackerTeam.currentHp = Math.min(
            attackerTeam.totalHp,
            attackerTeam.currentHp + actualHeal
          );
          
          result.totalHeal += actualHeal;
          
          const action: BattleAction = {
            type: 'heal',
            source: attacker,
            target: attacker,
            amount: actualHeal,
            gemType,
            monsterName: activeMonster.data.name,
            message: `${activeMonster.data.name} curou ${actualHeal} HP!`,
          };
          result.actions.push(action);
          this.callbacks.onHeal?.(action);
        }
        continue;
      }

      // Calcula dano base
      let baseDamage = gemCount * this.config.baseDamagePerGem;
      
      // Aplica multiplicador de combo
      baseDamage = Math.floor(baseDamage * (1 + (comboLevel - 1) * this.config.comboMultiplier));
      
      // Bônus por match de 4+
      if (gemCount >= 4) {
        baseDamage = Math.floor(baseDamage * 1.5);
      }
      if (gemCount >= 5) {
        baseDamage = Math.floor(baseDamage * 1.3); // Bônus extra
      }

      // Encontra monstro defensor ativo
      const defenderMonster = getActiveMonster(defenderTeam);
      if (!defenderMonster) continue;

      // Aplica vantagem de tipo
      const typeMultiplier = getTypeMultiplier(gemType, defenderMonster.data.element);
      const finalDamage = Math.floor(baseDamage * typeMultiplier);

      // Aplica dano
      const actualDamage = damageMonster(defenderMonster, finalDamage);
      defenderTeam.currentHp = Math.max(0, defenderTeam.currentHp - actualDamage);
      
      result.totalDamage += actualDamage;

      // Cria ação de dano
      let actionType: BattleAction['type'] = 'damage';
      let message = `${defenderMonster.data.name} recebeu ${actualDamage} de dano!`;
      
      if (typeMultiplier > 1) {
        actionType = 'super_effective';
        message = `Super efetivo! ${defenderMonster.data.name} recebeu ${actualDamage} de dano!`;
      } else if (typeMultiplier < 1) {
        actionType = 'not_effective';
        message = `Não muito efetivo... ${defenderMonster.data.name} recebeu ${actualDamage} de dano.`;
      }

      const damageAction: BattleAction = {
        type: actionType,
        source: attacker,
        target: defender,
        amount: actualDamage,
        gemType,
        monsterName: defenderMonster.data.name,
        message,
      };
      result.actions.push(damageAction);
      this.callbacks.onDamage?.(damageAction);

      // Verifica se monstro foi derrotado
      if (defenderMonster.isDefeated) {
        result.defeatedMonsters.push(defenderMonster.data.name);
        this.callbacks.onDefeat?.(defenderMonster.data.name, defender);
        
        const defeatAction: BattleAction = {
          type: 'defeat',
          source: attacker,
          target: defender,
          amount: 0,
          monsterName: defenderMonster.data.name,
          message: `${defenderMonster.data.name} foi derrotado!`,
        };
        result.actions.push(defeatAction);
      }

      // Adiciona progresso de evolução para monstros do atacante (se desbloqueado)
      if (canEvolveMonsters(this.state.stage)) {
        for (const monster of attackerTeam.monsters) {
          if (!monster.isDefeated && !monster.isEvolved) {
            const evolved = addEvolutionProgress(monster, gemType, gemCount >= 4 ? 2 : 1);
            if (evolved) {
              result.evolutions.push(monster.data.name);
              this.callbacks.onEvolve?.(monster.data.name, attacker);
            
            // Bônus de dano ao evoluir
            const bonusDamage = this.config.evolutionBonus;
            const evolveAction: BattleAction = {
              type: 'evolve',
              source: attacker,
              target: attacker,
              amount: bonusDamage,
              monsterName: monster.data.name,
              message: `${monster.data.name} EVOLUIU! +${bonusDamage} dano bônus!`,
            };
            result.actions.push(evolveAction);
            }
          }
        }
      }
    }

    // Verifica fim de jogo
    this.checkGameOver();

    return result;
  }

  // Notifica que uma jogada foi feita
  public onMoveMade(hadMatch: boolean): void {
    if (this.state.isGameOver) return;
    
    // Só consome jogada se houve match OU se permitimos jogadas sem match
    if (hadMatch) {
      this.state.movesLeft--;
      this.callbacks.onMovesUpdate?.(this.state.movesLeft);
      
      if (this.state.movesLeft <= 0) {
        this.endTurn();
      }
    }
  }

  // Sinaliza início de cascata
  public onCascadeStart(): void {
    this.state.waitingForCascade = true;
    this.pauseTimer();
  }

  // Sinaliza fim de cascata
  public onCascadeEnd(): void {
    this.state.waitingForCascade = false;
    if (!this.state.isGameOver && this.state.movesLeft > 0) {
      this.resumeTimer();
    }
  }

  // Finaliza o turno atual
  public endTurn(): void {
    if (this.state.isGameOver) return;
    
    this.stopTimer();
    
    // Troca de turno
    this.state.currentTurn = this.state.currentTurn === 'player' ? 'enemy' : 'player';
    this.state.turnNumber++;
    this.state.movesLeft = this.config.movesPerTurn;
    this.state.timeLeft = this.config.turnTimeLimit;
    
    this.callbacks.onTurnChange?.(this.state.currentTurn);
    
    // Reinicia timer para novo turno
    this.startTimer();
  }

  // Verifica condição de vitória
  private checkGameOver(): void {
    const playerDefeated = isTeamDefeated(this.state.playerTeam);
    const enemyDefeated = isTeamDefeated(this.state.enemyTeam);
    
    if (playerDefeated || enemyDefeated) {
      this.state.isGameOver = true;
      this.state.winner = playerDefeated ? 'enemy' : 'player';
      this.stopTimer();
      this.callbacks.onGameOver?.(this.state.winner);
    }
  }

  // Força fim de jogo (ex: timeout total)
  public forceGameOver(winner: 'player' | 'enemy'): void {
    this.state.isGameOver = true;
    this.state.winner = winner;
    this.stopTimer();
    this.callbacks.onGameOver?.(winner);
  }

  // Getters
  public getState(): BattleState {
    return { ...this.state };
  }

  public getCurrentTurn(): 'player' | 'enemy' {
    return this.state.currentTurn;
  }

  public isPlayerTurn(): boolean {
    return this.state.currentTurn === 'player';
  }

  public getMovesLeft(): number {
    return this.state.movesLeft;
  }

  public getTimeLeft(): number {
    return this.state.timeLeft;
  }

  public isGameOver(): boolean {
    return this.state.isGameOver;
  }

  public getWinner(): 'player' | 'enemy' | null {
    return this.state.winner;
  }

  public getPlayerTeam(): Team {
    return this.state.playerTeam;
  }

  public getEnemyTeam(): Team {
    return this.state.enemyTeam;
  }

  public getStage(): number {
    return this.state.stage;
  }

  public setStage(stage: number): void {
    this.state.stage = stage;
    
    // Ajusta tempo por turno baseado no stage
    this.config.turnTimeLimit = getBattleTimeLimit(stage);
    this.state.timeLeft = this.config.turnTimeLimit;
  }

  // Destrói o sistema de batalha
  public destroy(): void {
    this.stopTimer();
  }
}
