// Algoritmo da IA para Match-3

import { GemType } from './types';

interface Position {
  row: number;
  col: number;
}

interface Move {
  from: Position;
  to: Position;
  score: number;
  matchSize: number;
  cascadePotential: number;
}

type Grid = (GemType | null)[][];

export class AIPlayer {
  private thinkingDelay: number = 500; // ms antes de jogar
  private moveDelay: number = 300; // ms entre jogadas

  constructor() {}

  // Encontra a melhor jogada no grid
  public findBestMove(grid: Grid, rows: number, cols: number): Move | null {
    const moves = this.findAllMoves(grid, rows, cols);
    
    if (moves.length === 0) return null;

    // Ordena por score (maior primeiro)
    moves.sort((a, b) => {
      // Prioriza matches de 4+ (energia)
      if (a.matchSize >= 4 && b.matchSize < 4) return -1;
      if (b.matchSize >= 4 && a.matchSize < 4) return 1;
      
      // Depois por score total
      const scoreA = a.score + a.cascadePotential * 0.5;
      const scoreB = b.score + b.cascadePotential * 0.5;
      return scoreB - scoreA;
    });

    // Adiciona um pouco de aleatoriedade para não ser previsível
    // 70% escolhe a melhor, 30% escolhe entre as top 3
    if (moves.length > 1 && Math.random() > 0.7) {
      const topMoves = moves.slice(0, Math.min(3, moves.length));
      return topMoves[Math.floor(Math.random() * topMoves.length)];
    }

    return moves[0];
  }

  // Encontra todas as jogadas válidas
  private findAllMoves(grid: Grid, rows: number, cols: number): Move[] {
    const moves: Move[] = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Tenta trocar com a direita
        if (col < cols - 1) {
          const move = this.evaluateMove(grid, rows, cols, 
            { row, col }, { row, col: col + 1 });
          if (move) moves.push(move);
        }
        // Tenta trocar com baixo
        if (row < rows - 1) {
          const move = this.evaluateMove(grid, rows, cols,
            { row, col }, { row: row + 1, col });
          if (move) moves.push(move);
        }
      }
    }

    return moves;
  }

  // Avalia uma jogada específica
  private evaluateMove(
    grid: Grid, 
    rows: number, 
    cols: number,
    from: Position, 
    to: Position
  ): Move | null {
    const gem1 = grid[from.row]?.[from.col];
    const gem2 = grid[to.row]?.[to.col];
    
    if (!gem1 || !gem2) return null;

    // Simula a troca
    const testGrid = this.cloneGrid(grid);
    testGrid[from.row][from.col] = gem2;
    testGrid[to.row][to.col] = gem1;

    // Encontra matches
    const matches = this.findMatches(testGrid, rows, cols);
    
    if (matches.length === 0) return null;

    // Calcula score
    let totalGems = 0;
    let maxMatchSize = 0;
    
    matches.forEach(match => {
      totalGems += match.length;
      maxMatchSize = Math.max(maxMatchSize, match.length);
    });

    const baseScore = totalGems * 10;
    
    // Simula cascata (1 nível)
    const cascadePotential = this.estimateCascade(testGrid, rows, cols, matches);

    return {
      from,
      to,
      score: baseScore,
      matchSize: maxMatchSize,
      cascadePotential,
    };
  }

  // Encontra todos os matches no grid
  private findMatches(grid: Grid, rows: number, cols: number): Position[][] {
    const matches: Position[][] = [];
    const matched: boolean[][] = Array(rows).fill(null).map(() => Array(cols).fill(false));

    // Horizontal
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols - 2; col++) {
        const gem = grid[row][col];
        if (!gem) continue;

        let length = 1;
        while (col + length < cols && grid[row][col + length] === gem) {
          length++;
        }

        if (length >= 3) {
          const match: Position[] = [];
          for (let i = 0; i < length; i++) {
            if (!matched[row][col + i]) {
              match.push({ row, col: col + i });
              matched[row][col + i] = true;
            }
          }
          if (match.length > 0) matches.push(match);
        }
      }
    }

    // Vertical
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows - 2; row++) {
        const gem = grid[row][col];
        if (!gem) continue;

        let length = 1;
        while (row + length < rows && grid[row + length][col] === gem) {
          length++;
        }

        if (length >= 3) {
          const match: Position[] = [];
          for (let i = 0; i < length; i++) {
            if (!matched[row + i][col]) {
              match.push({ row: row + i, col });
              matched[row + i][col] = true;
            }
          }
          if (match.length > 0) matches.push(match);
        }
      }
    }

    return matches;
  }

  // Estima pontos de cascata
  private estimateCascade(
    grid: Grid, 
    rows: number, 
    cols: number, 
    initialMatches: Position[][]
  ): number {
    const testGrid = this.cloneGrid(grid);
    
    // Remove matches iniciais
    initialMatches.forEach(match => {
      match.forEach(pos => {
        testGrid[pos.row][pos.col] = null;
      });
    });

    // Simula queda (simplificado)
    for (let col = 0; col < cols; col++) {
      const column: (GemType | null)[] = [];
      for (let row = rows - 1; row >= 0; row--) {
        if (testGrid[row][col] !== null) {
          column.push(testGrid[row][col]);
        }
      }
      // Preenche com nulls no topo
      while (column.length < rows) {
        column.push(null);
      }
      // Reconstrói coluna
      for (let row = rows - 1; row >= 0; row--) {
        testGrid[row][col] = column[rows - 1 - row];
      }
    }

    // Verifica novos matches (cascata)
    const cascadeMatches = this.findMatches(testGrid, rows, cols);
    let cascadeScore = 0;
    cascadeMatches.forEach(match => {
      cascadeScore += match.length * 10;
    });

    return cascadeScore;
  }

  private cloneGrid(grid: Grid): Grid {
    return grid.map(row => [...row]);
  }

  // Retorna delays para parecer humano
  public getThinkingDelay(): number {
    return this.thinkingDelay + Math.random() * 300;
  }

  public getMoveDelay(): number {
    return this.moveDelay + Math.random() * 200;
  }
}
