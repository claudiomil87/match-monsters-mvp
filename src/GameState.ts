// Estado do jogo

export enum GameMode {
  MENU = 'menu',
  SOLO = 'solo',
  VS_AI_TIME = 'vs_ai_time',   // Modo tempo (10s por turno)
  VS_AI_TURNS = 'vs_ai_turns', // Modo turnos (2 jogadas)
}

export enum Player {
  HUMAN = 'human',
  AI = 'ai',
}

// Config para modo tempo
export interface TimeConfig {
  turnDuration: number;
  winScore: number;
}

export const TIME_CONFIG: TimeConfig = {
  turnDuration: 10,
  winScore: 2000,
};

// Config para modo turnos
export interface TurnsConfig {
  movesPerTurn: number;    // jogadas base por turno
  maxMoves: number;        // máximo de jogadas acumuladas
  moveTimeout: number;     // segundos por jogada
  winScore: number;
}

export const TURNS_CONFIG: TurnsConfig = {
  movesPerTurn: 2,
  maxMoves: 2,
  moveTimeout: 10,
  winScore: 2000,
};

// Estado para modo tempo
export interface VsAITimeState {
  currentTurn: Player;
  humanScore: number;
  aiScore: number;
  timeLeft: number;
  isGameOver: boolean;
  winner: Player | null;
}

// Estado para modo turnos
export interface VsAITurnsState {
  currentTurn: Player;
  humanScore: number;
  aiScore: number;
  humanEnergy: number;
  aiEnergy: number;
  movesLeft: number;       // jogadas restantes no turno
  timeLeft: number;        // tempo para a jogada atual
  isGameOver: boolean;
  winner: Player | null;
  waitingForCascade: boolean; // aguardando cascata terminar
}

export function createVsAITimeState(): VsAITimeState {
  return {
    currentTurn: Player.HUMAN,
    humanScore: 0,
    aiScore: 0,
    timeLeft: TIME_CONFIG.turnDuration,
    isGameOver: false,
    winner: null,
  };
}

export function createVsAITurnsState(): VsAITurnsState {
  return {
    currentTurn: Player.HUMAN,
    humanScore: 0,
    aiScore: 0,
    humanEnergy: 0,
    aiEnergy: 0,
    movesLeft: TURNS_CONFIG.movesPerTurn,
    timeLeft: TURNS_CONFIG.moveTimeout,
    isGameOver: false,
    winner: null,
    waitingForCascade: false,
  };
}
