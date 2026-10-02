export type Position = 'GR' | 'DF' | 'MD' | 'AV';

export interface Player {
  id: string;
  name: string;
  position: Position;
  overall: number;
  age: number;
  tec: number;
  fis: number;
  dec: number;
  evolutionPoints: number;
  marketValue: number;
  isStarter: boolean;
}

export type Formation = '4-4-2' | '4-3-3' | '3-5-2' | '5-3-2';
export type Mentality = 'defensive' | 'balanced' | 'attacking';
export type Pressing = 'low' | 'balanced' | 'high';
export type Buildup = 'curta' | 'flancos' | 'longa';

export interface Tactics {
  formation: Formation;
  mentality: Mentality;
  pressing: Pressing;
  buildup: Buildup;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  isBot: boolean;
  tactics: Tactics;
  players: Player[];
}
