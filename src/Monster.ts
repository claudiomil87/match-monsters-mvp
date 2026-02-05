/**
 * Sistema de Monstros
 * Define monstros, tipos, stats e evolução
 */

import { GemType } from './types';

// Informações base de um monstro
export interface MonsterData {
  id: string;
  name: string;
  element: GemType;
  baseHp: number;
  baseAttack: number;
  sprite: string;        // emoji ou path para sprite
  evolvedSprite: string;
  description: string;
}

// Estado de um monstro em batalha
export interface Monster {
  data: MonsterData;
  currentHp: number;
  maxHp: number;
  attack: number;
  evolutionProgress: number;
  evolutionThreshold: number;
  isEvolved: boolean;
  isDefeated: boolean;
}

// Equipe de monstros
export interface Team {
  monsters: Monster[];
  playerName: string;
  playerAvatar: string;
  totalHp: number;
  currentHp: number;
}

// Catálogo de monstros disponíveis
export const MONSTER_CATALOG: MonsterData[] = [
  // Fogo
  {
    id: 'fennekin',
    name: 'Fennekin',
    element: GemType.FIRE,
    baseHp: 18,
    baseAttack: 12,
    sprite: '🦊',
    evolvedSprite: '🔥',
    description: 'Uma raposa de fogo ágil e esperta'
  },
  {
    id: 'charmander',
    name: 'Charmander',
    element: GemType.FIRE,
    baseHp: 20,
    baseAttack: 10,
    sprite: '🐉',
    evolvedSprite: '🐲',
    description: 'Um pequeno dragão com chama na cauda'
  },
  // Água
  {
    id: 'riolu',
    name: 'Riolu',
    element: GemType.WATER,
    baseHp: 18,
    baseAttack: 11,
    sprite: '🐺',
    evolvedSprite: '💠',
    description: 'Um guerreiro aquático destemido'
  },
  {
    id: 'squirtle',
    name: 'Squirtle',
    element: GemType.WATER,
    baseHp: 22,
    baseAttack: 8,
    sprite: '🐢',
    evolvedSprite: '🌊',
    description: 'Uma tartaruga com casca resistente'
  },
  // Planta
  {
    id: 'snivy',
    name: 'Snivy',
    element: GemType.GRASS,
    baseHp: 16,
    baseAttack: 13,
    sprite: '🐍',
    evolvedSprite: '🌿',
    description: 'Uma serpente vegetal rápida'
  },
  {
    id: 'bulbasaur',
    name: 'Bulbasaur',
    element: GemType.GRASS,
    baseHp: 20,
    baseAttack: 9,
    sprite: '🌱',
    evolvedSprite: '🌺',
    description: 'Um dinossauro com bulbo nas costas'
  },
  // Elétrico
  {
    id: 'pikachu',
    name: 'Pikachu',
    element: GemType.ELECTRIC,
    baseHp: 15,
    baseAttack: 14,
    sprite: '⚡',
    evolvedSprite: '🌩️',
    description: 'Um rato elétrico muito popular'
  },
  {
    id: 'jolteon',
    name: 'Jolteon',
    element: GemType.ELECTRIC,
    baseHp: 17,
    baseAttack: 12,
    sprite: '🦔',
    evolvedSprite: '💛',
    description: 'Rápido como um raio'
  },
  // Psíquico
  {
    id: 'espeon',
    name: 'Espeon',
    element: GemType.PSYCHIC,
    baseHp: 16,
    baseAttack: 14,
    sprite: '🔮',
    evolvedSprite: '💜',
    description: 'Pode prever o futuro'
  },
  {
    id: 'mew',
    name: 'Mew',
    element: GemType.PSYCHIC,
    baseHp: 20,
    baseAttack: 11,
    sprite: '🐱',
    evolvedSprite: '✨',
    description: 'Um ser místico lendário'
  },
  // Dark
  {
    id: 'umbreon',
    name: 'Umbreon',
    element: GemType.DARK,
    baseHp: 24,
    baseAttack: 9,
    sprite: '🌙',
    evolvedSprite: '🖤',
    description: 'Brilha na escuridão'
  },
  {
    id: 'absol',
    name: 'Absol',
    element: GemType.DARK,
    baseHp: 18,
    baseAttack: 13,
    sprite: '🐺',
    evolvedSprite: '⬛',
    description: 'Pressentimentos sombrios'
  },
];

// Vantagens de tipo (atacante → defensor = multiplicador)
export const TYPE_ADVANTAGES: Record<GemType, { strong: GemType[]; weak: GemType[] }> = {
  [GemType.FIRE]: {
    strong: [GemType.GRASS],    // Fogo é forte contra Planta
    weak: [GemType.WATER],      // Fogo é fraco contra Água
  },
  [GemType.WATER]: {
    strong: [GemType.FIRE],     // Água é forte contra Fogo
    weak: [GemType.GRASS, GemType.ELECTRIC], // Água é fraca contra Planta e Elétrico
  },
  [GemType.GRASS]: {
    strong: [GemType.WATER],    // Planta é forte contra Água
    weak: [GemType.FIRE],       // Planta é fraca contra Fogo
  },
  [GemType.ELECTRIC]: {
    strong: [GemType.WATER],    // Elétrico é forte contra Água
    weak: [GemType.GRASS],      // Elétrico é fraco contra Planta
  },
  [GemType.PSYCHIC]: {
    strong: [GemType.DARK],     // Psíquico é forte contra Dark
    weak: [GemType.DARK],       // Psíquico é fraco contra Dark (mútuo)
  },
  [GemType.DARK]: {
    strong: [GemType.PSYCHIC],  // Dark é forte contra Psíquico
    weak: [GemType.PSYCHIC],    // Dark é fraco contra Psíquico (mútuo)
  },
  [GemType.BERRY]: {
    strong: [],                 // Berry não causa dano
    weak: [],                   // Berry não tem fraqueza
  },
};

// Calcula multiplicador de dano baseado em tipos
export function getTypeMultiplier(attackType: GemType, defenderType: GemType): number {
  const advantages = TYPE_ADVANTAGES[attackType];
  
  if (advantages.strong.includes(defenderType)) {
    return 1.5; // Super efetivo
  }
  if (advantages.weak.includes(defenderType)) {
    return 0.5; // Não muito efetivo
  }
  return 1.0; // Normal
}

// Cria um monstro a partir dos dados base
export function createMonster(data: MonsterData, level: number = 1): Monster {
  const hpBonus = Math.floor(level * 0.5);
  const attackBonus = Math.floor(level * 0.3);
  
  return {
    data,
    currentHp: data.baseHp + hpBonus,
    maxHp: data.baseHp + hpBonus,
    attack: data.baseAttack + attackBonus,
    evolutionProgress: 0,
    evolutionThreshold: 8, // Precisa de 8 matches do tipo para evoluir
    isEvolved: false,
    isDefeated: false,
  };
}

// Cria uma equipe aleatória
export function createRandomTeam(playerName: string, avatar: string, teamSize: number = 2): Team {
  const shuffled = [...MONSTER_CATALOG].sort(() => Math.random() - 0.5);
  const selectedMonsters = shuffled.slice(0, teamSize).map(data => createMonster(data));
  
  const totalHp = selectedMonsters.reduce((sum, m) => sum + m.maxHp, 0) * 10; // HP total = soma * 10
  
  return {
    monsters: selectedMonsters,
    playerName,
    playerAvatar: avatar,
    totalHp,
    currentHp: totalHp,
  };
}

// Cria uma equipe específica (por IDs)
export function createTeam(
  playerName: string, 
  avatar: string, 
  monsterIds: string[]
): Team {
  const monsters = monsterIds
    .map(id => MONSTER_CATALOG.find(m => m.id === id))
    .filter((m): m is MonsterData => m !== undefined)
    .map(data => createMonster(data));
  
  const totalHp = monsters.reduce((sum, m) => sum + m.maxHp, 0) * 10;
  
  return {
    monsters,
    playerName,
    playerAvatar: avatar,
    totalHp,
    currentHp: totalHp,
  };
}

// Evolui um monstro
export function evolveMonster(monster: Monster): void {
  if (monster.isEvolved || monster.isDefeated) return;
  
  monster.isEvolved = true;
  monster.maxHp = Math.floor(monster.maxHp * 1.5);
  monster.currentHp = monster.maxHp; // Cura completa ao evoluir
  monster.attack = Math.floor(monster.attack * 1.3);
  monster.evolutionProgress = 0;
}

// Adiciona progresso de evolução
export function addEvolutionProgress(monster: Monster, matchType: GemType, amount: number = 1): boolean {
  if (monster.isEvolved || monster.isDefeated) return false;
  
  // Só ganha progresso se o match for do mesmo tipo do monstro
  if (matchType === monster.data.element) {
    monster.evolutionProgress += amount;
    
    if (monster.evolutionProgress >= monster.evolutionThreshold) {
      evolveMonster(monster);
      return true; // Evoluiu!
    }
  }
  
  return false;
}

// Aplica dano a um monstro
export function damageMonster(monster: Monster, damage: number): number {
  if (monster.isDefeated) return 0;
  
  const actualDamage = Math.min(damage, monster.currentHp);
  monster.currentHp -= actualDamage;
  
  if (monster.currentHp <= 0) {
    monster.currentHp = 0;
    monster.isDefeated = true;
  }
  
  return actualDamage;
}

// Cura um monstro
export function healMonster(monster: Monster, amount: number): number {
  if (monster.isDefeated) return 0;
  
  const actualHeal = Math.min(amount, monster.maxHp - monster.currentHp);
  monster.currentHp += actualHeal;
  
  return actualHeal;
}

// Verifica se a equipe foi derrotada
export function isTeamDefeated(team: Team): boolean {
  return team.monsters.every(m => m.isDefeated);
}

// Encontra o primeiro monstro ativo (não derrotado)
export function getActiveMonster(team: Team): Monster | null {
  return team.monsters.find(m => !m.isDefeated) || null;
}

// Conta monstros vivos
export function countAliveMonsters(team: Team): number {
  return team.monsters.filter(m => !m.isDefeated).length;
}
