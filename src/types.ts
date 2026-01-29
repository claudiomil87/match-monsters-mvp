// Tipos de gemas baseados nos elementos do Match Monsters
export enum GemType {
  FIRE = 'fire',
  WATER = 'water',
  GRASS = 'grass',
  ELECTRIC = 'electric',
  PSYCHIC = 'psychic',
  DARK = 'dark',
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
  [GemType.FIRE]: '#ff5252',
  [GemType.WATER]: '#42a5f5',
  [GemType.GRASS]: '#66bb6a',
  [GemType.ELECTRIC]: '#ffca28',
  [GemType.PSYCHIC]: '#ab47bc',
  [GemType.DARK]: '#ec407a',
};
