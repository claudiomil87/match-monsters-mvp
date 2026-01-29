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
  description: string;
}

export const POWER_UPS: PowerUpConfig[] = [
  {
    type: PowerUpType.BOMB,
    name: 'Bomba',
    emoji: '💣',
    description: 'Explode área 3x3',
  },
  {
    type: PowerUpType.SHUFFLE,
    name: 'Shuffle',
    emoji: '🔀',
    description: 'Embaralha o tabuleiro',
  },
  {
    type: PowerUpType.LIGHTNING,
    name: 'Raio',
    emoji: '⚡',
    description: 'Elimina linha + coluna',
  },
  {
    type: PowerUpType.RAINBOW,
    name: 'Arco-íris',
    emoji: '🌈',
    description: 'Remove todas de uma cor',
  },
];

export const ENERGY_NEEDED = 4;

export function getRandomPowerUp(): PowerUpConfig {
  const index = Math.floor(Math.random() * POWER_UPS.length);
  return POWER_UPS[index];
}

export function getPowerUpConfig(type: PowerUpType): PowerUpConfig {
  return POWER_UPS.find(p => p.type === type)!;
}
