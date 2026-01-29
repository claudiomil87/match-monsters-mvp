// Sistema de Power-ups

export enum PowerUpType {
  BOMB = 'bomb',       // Explode 3x3
  LIGHTNING = 'lightning', // Cruz (linha + coluna)
  RAINBOW = 'rainbow',   // Remove todas de uma cor
  SHUFFLE = 'shuffle',   // Embaralha tudo
}

export interface PowerUpConfig {
  type: PowerUpType;
  name: string;
  emoji: string;
  cost: number;
  description: string;
}

export const POWER_UPS: PowerUpConfig[] = [
  {
    type: PowerUpType.BOMB,
    name: 'Bomba',
    emoji: '💣',
    cost: 1,
    description: 'Explode área 3x3',
  },
  {
    type: PowerUpType.SHUFFLE,
    name: 'Shuffle',
    emoji: '🔀',
    cost: 1,
    description: 'Embaralha o tabuleiro',
  },
  {
    type: PowerUpType.LIGHTNING,
    name: 'Raio',
    emoji: '⚡',
    cost: 2,
    description: 'Elimina linha + coluna',
  },
  {
    type: PowerUpType.RAINBOW,
    name: 'Arco-íris',
    emoji: '🌈',
    cost: 3,
    description: 'Remove todas de uma cor',
  },
];

export const MAX_ENERGY = 4;

export function getPowerUpByType(type: PowerUpType): PowerUpConfig | undefined {
  return POWER_UPS.find(p => p.type === type);
}
