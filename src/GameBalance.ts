/**
 * Sistema de Balanceamento do Jogo
 * Configurações para dificuldade progressiva e equilíbrio
 */

import { Team, createRandomTeam } from './Monster';

export interface DifficultyConfig {
  stage: number;
  enemyMonsterCount: number;
  enemyHpMultiplier: number;
  aiDifficulty: number; // 0.1 a 1.0
  timeMultiplier: number;
  rewardMultiplier: number;
}

export interface StageRewards {
  stage: number;
  unlockMessage: string;
  newMonsters?: string[];
  bonusHp?: number;
  bonusEvolution?: number;
}

// Configurações de dificuldade por stage
export const DIFFICULTY_PROGRESSION: DifficultyConfig[] = [
  // Stage 1-3: Tutorial/Easy
  { stage: 1, enemyMonsterCount: 1, enemyHpMultiplier: 0.8, aiDifficulty: 0.3, timeMultiplier: 1.5, rewardMultiplier: 1.0 },
  { stage: 2, enemyMonsterCount: 2, enemyHpMultiplier: 0.9, aiDifficulty: 0.4, timeMultiplier: 1.3, rewardMultiplier: 1.1 },
  { stage: 3, enemyMonsterCount: 2, enemyHpMultiplier: 1.0, aiDifficulty: 0.5, timeMultiplier: 1.2, rewardMultiplier: 1.2 },
  
  // Stage 4-6: Normal
  { stage: 4, enemyMonsterCount: 2, enemyHpMultiplier: 1.1, aiDifficulty: 0.6, timeMultiplier: 1.1, rewardMultiplier: 1.3 },
  { stage: 5, enemyMonsterCount: 3, enemyHpMultiplier: 1.2, aiDifficulty: 0.7, timeMultiplier: 1.0, rewardMultiplier: 1.4 },
  { stage: 6, enemyMonsterCount: 3, enemyHpMultiplier: 1.3, aiDifficulty: 0.8, timeMultiplier: 0.9, rewardMultiplier: 1.5 },
  
  // Stage 7+: Hard
  { stage: 7, enemyMonsterCount: 3, enemyHpMultiplier: 1.5, aiDifficulty: 0.9, timeMultiplier: 0.8, rewardMultiplier: 2.0 },
  { stage: 8, enemyMonsterCount: 3, enemyHpMultiplier: 1.7, aiDifficulty: 1.0, timeMultiplier: 0.8, rewardMultiplier: 2.5 },
  { stage: 9, enemyMonsterCount: 3, enemyHpMultiplier: 2.0, aiDifficulty: 1.0, timeMultiplier: 0.7, rewardMultiplier: 3.0 },
  { stage: 10, enemyMonsterCount: 3, enemyHpMultiplier: 2.5, aiDifficulty: 1.0, timeMultiplier: 0.6, rewardMultiplier: 4.0 },
];

// Recompensas por stage
export const STAGE_REWARDS: StageRewards[] = [
  { stage: 1, unlockMessage: "🎉 Parabéns! Primeiro inimigo derrotado!" },
  { stage: 2, unlockMessage: "🔥 Novo elemento desbloqueado: Fogo vs Grama!" },
  { stage: 3, unlockMessage: "⚡ Sistema de evolução ativado!", bonusEvolution: 50 },
  { stage: 4, unlockMessage: "💧 Elemento Água desbloqueado!" },
  { stage: 5, unlockMessage: "🌿 Equipes de 3 monstros liberadas!", bonusHp: 20 },
  { stage: 6, unlockMessage: "🔮 Elemento Psíquico desbloqueado!" },
  { stage: 7, unlockMessage: "🌑 Elemento Sombrio desbloqueado!" },
  { stage: 8, unlockMessage: "⚡ Elemento Elétrico desbloqueado!" },
  { stage: 9, unlockMessage: "👑 Você chegou ao nível MESTRE!", bonusHp: 50 },
  { stage: 10, unlockMessage: "🏆 LENDA! Você dominou o Match Monsters!", bonusHp: 100 }
];

// Busca configuração de dificuldade por stage
export function getDifficultyConfig(stage: number): DifficultyConfig {
  // Se o stage for maior que o máximo definido, usa a última configuração
  const config = DIFFICULTY_PROGRESSION.find(d => d.stage === stage);
  if (config) {
    return config;
  }
  
  // Para stages muito altos, usa progressão exponencial
  const lastConfig = DIFFICULTY_PROGRESSION[DIFFICULTY_PROGRESSION.length - 1];
  const extraStages = stage - lastConfig.stage;
  
  return {
    stage,
    enemyMonsterCount: 3,
    enemyHpMultiplier: lastConfig.enemyHpMultiplier * Math.pow(1.2, extraStages),
    aiDifficulty: 1.0,
    timeMultiplier: Math.max(0.4, lastConfig.timeMultiplier * Math.pow(0.95, extraStages)),
    rewardMultiplier: lastConfig.rewardMultiplier * Math.pow(1.3, extraStages)
  };
}

// Cria equipe inimiga balanceada para o stage
export function createEnemyTeam(stage: number): Team {
  const config = getDifficultyConfig(stage);
  
  // Cria equipe base
  const enemyTeam = createRandomTeam(
    `Boss Lv.${stage}`,
    '👹',
    config.enemyMonsterCount
  );
  
  // Aplica multiplicadores de HP
  enemyTeam.monsters.forEach(monster => {
    monster.maxHp = Math.round(monster.maxHp * config.enemyHpMultiplier);
    monster.currentHp = monster.maxHp;
  });
  
  // Recalcula HP total da equipe
  enemyTeam.currentHp = enemyTeam.monsters.reduce((sum, m) => sum + m.currentHp, 0);
  enemyTeam.totalHp = enemyTeam.monsters.reduce((sum, m) => sum + m.maxHp, 0);
  
  return enemyTeam;
}

// Calcula tempo por turno baseado no stage
export function getBattleTimeLimit(stage: number): number {
  const config = getDifficultyConfig(stage);
  const baseTime = 30; // 30 segundos base
  return Math.round(baseTime * config.timeMultiplier);
}

// Calcula dificuldade da IA baseado no stage
export function getAIDifficulty(stage: number): number {
  const config = getDifficultyConfig(stage);
  return config.aiDifficulty;
}

// Verifica se há recompensa para o stage
export function getStageReward(stage: number): StageRewards | null {
  return STAGE_REWARDS.find(r => r.stage === stage) || null;
}

// Sistema de pontuação progressiva
export function calculateStageScore(stage: number, timeBonus: number, combos: number): number {
  const config = getDifficultyConfig(stage);
  const baseScore = stage * 100;
  const comboBonus = combos * 50;
  const finalScore = (baseScore + timeBonus + comboBonus) * config.rewardMultiplier;
  return Math.round(finalScore);
}

// Verifica se o jogador pode evoluir monstros (desbloqueado no stage 3)
export function canEvolveMonsters(stage: number): boolean {
  return stage >= 3;
}

// Quantidade máxima de monstros por equipe baseado no stage
export function getMaxTeamSize(stage: number): number {
  if (stage >= 5) return 3;
  if (stage >= 2) return 2;
  return 1;
}