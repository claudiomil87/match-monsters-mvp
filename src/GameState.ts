// Estado do jogo

export enum GameMode {
  MENU = 'menu',
  SOLO = 'solo',
  VS_AI = 'vs_ai',
}

export enum Player {
  HUMAN = 'human',
  AI = 'ai',
}

export interface GameConfig {
  turnDuration: number;  // segundos
  winScore: number;      // pontos para vencer
}

export const DEFAULT_CONFIG: GameConfig = {
  turnDuration: 10,
  winScore: 2000,
};

export interface VsAIState {
  currentTurn: Player;
  humanScore: number;
  aiScore: number;
  timeLeft: number;
  isGameOver: boolean;
  winner: Player | null;
  humanEnergy: number;
  aiEnergy: number;
}

export function createInitialVsAIState(): VsAIState {
  return {
    currentTurn: Player.HUMAN, // Humano começa
    humanScore: 0,
    aiScore: 0,
    timeLeft: DEFAULT_CONFIG.turnDuration,
    isGameOver: false,
    winner: null,
    humanEnergy: 0,
    aiEnergy: 0,
  };
}
