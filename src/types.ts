// Tipos de gemas baseados nos elementos do Match Monsters
export enum GemType {
  FIRE = 'fire',      // Vermelho
  WATER = 'water',    // Azul
  GRASS = 'grass',    // Verde
  ELECTRIC = 'electric', // Amarelo
  PSYCHIC = 'psychic',   // Roxo
  DARK = 'dark',      // Rosa/Cereja
}

export interface Position {
  row: number;
  col: number;
}

export interface Gem {
  type: GemType;
  row: number;
  col: number;
  x: number;
  y: number;
  targetY: number;
  isMatched: boolean;
  isNew: boolean;
}

export interface Match {
  gems: Position[];
  type: GemType;
}

export const GEM_COLORS: Record<GemType, string> = {
  [GemType.FIRE]: '#ff4444',
  [GemType.WATER]: '#44aaff',
  [GemType.GRASS]: '#44dd44',
  [GemType.ELECTRIC]: '#ffdd44',
  [GemType.PSYCHIC]: '#aa44ff',
  [GemType.DARK]: '#ff44aa',
};

export const GEM_ICONS: Record<GemType, string> = {
  [GemType.FIRE]: '🔥',
  [GemType.WATER]: '💧',
  [GemType.GRASS]: '🌿',
  [GemType.ELECTRIC]: '⚡',
  [GemType.PSYCHIC]: '🔮',
  [GemType.DARK]: '🍒',
};
