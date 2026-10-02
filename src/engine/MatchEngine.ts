import { Team, Player, MatchState, MatchEvent, MatchStats, EventType, Tactics } from './types';

export interface SectorPower {
  gr: number;
  df: number;
  md: number;
  av: number;
}

export function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export class MatchEngine {
  public state: MatchState;
  private homeStarters: Player[];
  private awayStarters: Player[];
  private homePossessionTicks: number = 0;
  private awayPossessionTicks: number = 0;

  constructor(homeTeam: Team, awayTeam: Team, matchId: string = 'match_' + Date.now()) {
    // Clonar para não alterar referências externas
    const homeClone: Team = JSON.parse(JSON.stringify(homeTeam));
    const awayClone: Team = JSON.parse(JSON.stringify(awayTeam));

    this.homeStarters = homeClone.players.filter(p => p.isStarter);
    this.awayStarters = awayClone.players.filter(p => p.isStarter);

    const initialStats: MatchStats = {
      shotsHome: 0,
      shotsAway: 0,
      shotsOnTargetHome: 0,
      shotsOnTargetAway: 0,
      possessionHome: 50,
      possessionAway: 50,
      tacklesHome: 0,
      tacklesAway: 0,
      savesHome: 0,
      savesAway: 0,
    };

    this.state = {
      matchId,
      homeTeam: homeClone,
      awayTeam: awayClone,
      minute: 0,
      homeScore: 0,
      awayScore: 0,
      ballPossession: Math.random() > 0.5 ? 'home' : 'away',
      ballZone: 'midfield_home',
      events: [],
      stats: initialStats,
      isPaused: false,
      isFinished: false,
      tacticalWindowPending: false,
    };

    this.logEvent({
      minute: 0,
      type: 'kickoff',
      teamSide: this.state.ballPossession,
      teamName: this.state.ballPossession === 'home' ? homeClone.name : awayClone.name,
      description: `Apito inicial! O árbitro dá início ao jogo entre ${homeClone.name} e ${awayClone.name}.`,
      scoreHome: 0,
      scoreAway: 0,
    });
  }

  // Obter força do setor com modificadores táticos ("A Manta Curta")
  public getSectorPower(team: Team, starters: Player[]): SectorPower {
    const grPlayers = starters.filter(p => p.position === 'GR');
    const dfPlayers = starters.filter(p => p.position === 'DF');
    const mdPlayers = starters.filter(p => p.position === 'MD');
    const avPlayers = starters.filter(p => p.position === 'AV');

    const avg = (arr: Player[]) => arr.length > 0 ? arr.reduce((acc, p) => acc + p.overall, 0) / arr.length : 5;

    let gr = avg(grPlayers);
    let df = avg(dfPlayers);
    let md = avg(mdPlayers);
    let av = avg(avPlayers);

    // 1. Modificadores de Mentalidade
    switch (team.tactics.mentality) {
      case 'ultra_defensive':
        gr += 1.0;
        df += 2.0;
        md += 1.0;
        av -= 2.0;
        break;
      case 'defensive':
        df += 1.0;
        av -= 1.0;
        break;
      case 'attacking':
        df -= 1.0;
        av += 1.0;
        break;
      case 'all_out_attack':
        df -= 2.0;
        md += 1.0;
        av += 2.0;
        break;
      case 'balanced':
      default:
        break;
    }

    // 2. Modificadores de Pressão
    switch (team.tactics.pressing) {
      case 'high':
        md += 1.0; // Ganho de bolas
        df -= 0.5; // Linha alta / espaço nas costas
        break;
      case 'low':
        df += 1.0; // Bloco baixo
        md -= 0.5;
        break;
      case 'balanced':
      default:
        break;
    }

    // 3. Modificadores de Estilo de Saída
    switch (team.tactics.buildup) {
      case 'tiki_taka':
        md += 0.8;
        break;
      case 'direct':
        df += 0.5;
        av += 0.5;
        md -= 0.5;
        break;
      case 'balanced':
      default:
        break;
    }

    return { gr, df, md, av };
  }

  public getRandomPlayer(starters: Player[], position?: 'GR' | 'DF' | 'MD' | 'AV'): Player {
    const pool = position ? starters.filter(p => p.position === position) : starters;
    if (pool.length === 0) return starters[0];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private logEvent(event: MatchEvent) {
    this.state.events.unshift(event);
  }

  private updatePossessionStats() {
    if (this.state.ballPossession === 'home') {
      this.homePossessionTicks++;
    } else {
      this.awayPossessionTicks++;
    }
    const total = this.homePossessionTicks + this.awayPossessionTicks;
    if (total > 0) {
      this.state.stats.possessionHome = Math.round((this.homePossessionTicks / total) * 100);
      this.state.stats.possessionAway = 100 - this.state.stats.possessionHome;
    }
  }

  // Aplica ordens táticas de uma equipa
  public updateTactics(side: 'home' | 'away', newTactics: Partial<Tactics>) {
    const targetTeam = side === 'home' ? this.state.homeTeam : this.state.awayTeam;
    targetTeam.tactics = { ...targetTeam.tactics, ...newTactics };
    
    this.logEvent({
      minute: this.state.minute,
      type: 'tactical_window',
      teamSide: side,
      teamName: targetTeam.name,
      description: `Ajuste tático no ${targetTeam.name}: Mentalidade: ${targetTeam.tactics.mentality}, Pressão: ${targetTeam.tactics.pressing}, Estilo: ${targetTeam.tactics.buildup}.`,
      scoreHome: this.state.homeScore,
      scoreAway: this.state.awayScore,
    });
  }

  // Avança a simulação num intervalo de minutos (ex: 1, 2 ou 3 minutos por tick)
  public step(minutesToAdvance: number = 2): MatchState {
    if (this.state.isFinished) return this.state;

    const previousMinute = this.state.minute;
    this.state.minute = Math.min(90, this.state.minute + minutesToAdvance);

    this.updatePossessionStats();

    // Verificação de Janelas Táticas (15, 30, 45, 60, 75)
    const checkWindows = [15, 30, 45, 60, 75];
    for (const win of checkWindows) {
      if (previousMinute < win && this.state.minute >= win) {
        this.state.tacticalWindowPending = true;
        if (win === 45) {
          this.logEvent({
            minute: 45,
            type: 'halftime',
            teamSide: 'home',
            teamName: 'Árbitro',
            description: `Intervalo! As equipas recolhem aos balneários. Resultado atual: ${this.state.homeTeam.name} ${this.state.homeScore} - ${this.state.awayScore} ${this.state.awayTeam.name}.`,
            scoreHome: this.state.homeScore,
            scoreAway: this.state.awayScore,
          });
        }
      }
    }

    if (this.state.minute >= 90) {
      this.state.isFinished = true;
      this.logEvent({
        minute: 90,
        type: 'fulltime',
        teamSide: 'home',
        teamName: 'Árbitro',
        description: `Fim do encontro! Resultado final: ${this.state.homeTeam.name} ${this.state.homeScore} - ${this.state.awayScore} ${this.state.awayTeam.name}.`,
        scoreHome: this.state.homeScore,
        scoreAway: this.state.awayScore,
      });
      return this.state;
    }

    // Execução da jogada do bloco
    this.simulatePossessionSequence();

    return this.state;
  }

  private simulatePossessionSequence() {
    const homePower = this.getSectorPower(this.state.homeTeam, this.homeStarters);
    const awayPower = this.getSectorPower(this.state.awayTeam, this.awayStarters);

    // Duelo 1: Disputa do Meio-Campo (Posse e Saída)
    const diceHomeMD = rollDice();
    const diceAwayMD = rollDice();
    const scoreMDHome = homePower.md + diceHomeMD;
    const scoreMDAway = awayPower.md + diceAwayMD;

    let attackingSide: 'home' | 'away';
    let defendingSide: 'home' | 'away';
    let attackingTeam: Team;
    let defendingTeam: Team;
    let attStarters: Player[];
    let defStarters: Player[];
    let attPower: SectorPower;
    let defPower: SectorPower;

    if (scoreMDHome >= scoreMDAway) {
      attackingSide = 'home';
      defendingSide = 'away';
      attackingTeam = this.state.homeTeam;
      defendingTeam = this.state.awayTeam;
      attStarters = this.homeStarters;
      defStarters = this.awayStarters;
      attPower = homePower;
      defPower = awayPower;
      this.state.ballPossession = 'home';
    } else {
      attackingSide = 'away';
      defendingSide = 'home';
      attackingTeam = this.state.awayTeam;
      defendingTeam = this.state.homeTeam;
      attStarters = this.awayStarters;
      defStarters = this.homeStarters;
      attPower = awayPower;
      defPower = homePower;
      this.state.ballPossession = 'away';
    }

    const playmaker = this.getRandomPlayer(attStarters, 'MD');
    this.state.activePlayerId = playmaker.id;

    // Duelo 2: Progressão Ofensiva (Ataque vs Defesa)
    const diceAtt = rollDice();
    const diceDef = rollDice();
    const attackRoll = attPower.av + diceAtt;
    const defenseRoll = defPower.df + diceDef;

    // Se a defesa ganhar o lance
    if (defenseRoll >= attackRoll) {
      const defender = this.getRandomPlayer(defStarters, 'DF');
      if (defendingSide === 'home') this.state.stats.tacklesHome++;
      else this.state.stats.tacklesAway++;

      this.state.ballZone = defendingSide === 'home' ? 'defense_home' : 'defense_away';

      // Chance de relatar o corte
      if (Math.random() < 0.6) {
        this.logEvent({
          minute: this.state.minute,
          type: 'tackle',
          teamSide: defendingSide,
          teamName: defendingTeam.name,
          playerName: defender.name,
          description: `Corte imperial de ${defender.name} (${defendingTeam.shortName}), travando a investida de ${playmaker.name}.`,
          scoreHome: this.state.homeScore,
          scoreAway: this.state.awayScore,
          details: { diceAttacker: diceAtt, diceDefender: diceDef, rollResult: `Defesa venceu (${defenseRoll.toFixed(1)} vs ${attackRoll.toFixed(1)})` }
        });
      }
      return;
    }

    // Ataque passou a muralha defensiva! Cria oportunidade de golo!
    const forward = this.getRandomPlayer(attStarters, 'AV');
    this.state.activePlayerId = forward.id;
    this.state.ballZone = attackingSide === 'home' ? 'box_away' : 'box_home';

    if (attackingSide === 'home') this.state.stats.shotsHome++;
    else this.state.stats.shotsAway++;

    // Duelo 3: Finalização (Avançado vs Guarda-Redes)
    const diceShot = rollDice();
    const diceGK = rollDice();
    // Bónus de baliza (+1.5 para o GR para manter médias de golos realistas no futebol)
    const shotRating = forward.overall + diceShot;
    const gkRating = defPower.gr + diceGK + 1.5;

    const gk = this.getRandomPlayer(defStarters, 'GR');

    if (shotRating > gkRating) {
      // GOLO!
      if (attackingSide === 'home') {
        this.state.homeScore++;
        this.state.stats.shotsOnTargetHome++;
      } else {
        this.state.awayScore++;
        this.state.stats.shotsOnTargetAway++;
      }

      this.logEvent({
        minute: this.state.minute,
        type: 'goal',
        teamSide: attackingSide,
        teamName: attackingTeam.name,
        playerName: forward.name,
        description: `⚽ GOLOOOO DO ${attackingTeam.name.toUpperCase()}! Remate fulminante de ${forward.name} sem qualquer hipótese para ${gk.name}!`,
        scoreHome: this.state.homeScore,
        scoreAway: this.state.awayScore,
        details: { diceAttacker: diceShot, diceDefender: diceGK, rollResult: `Golo! Remate ${shotRating.toFixed(1)} superou GK ${gkRating.toFixed(1)}` }
      });
    } else if (gkRating - shotRating <= 2.0) {
      // GR Defende com categoria!
      if (attackingSide === 'home') {
        this.state.stats.shotsOnTargetHome++;
        this.state.stats.savesAway++;
      } else {
        this.state.stats.shotsOnTargetAway++;
        this.state.stats.savesHome++;
      }

      this.logEvent({
        minute: this.state.minute,
        type: 'shot_saved',
        teamSide: defendingSide,
        teamName: defendingTeam.name,
        playerName: gk.name,
        description: `🧤 ENORME DEFESA DE ${gk.name}! O avançado ${forward.name} rematou com selo de golo, mas o guarda-redes voou para desviar!`,
        scoreHome: this.state.homeScore,
        scoreAway: this.state.awayScore,
        details: { diceAttacker: diceShot, diceDefender: diceGK, rollResult: `Defendido! GK ${gkRating.toFixed(1)} travou Remate ${shotRating.toFixed(1)}` }
      });
    } else {
      // Remate para fora / ao lado
      this.logEvent({
        minute: this.state.minute,
        type: 'shot_missed',
        teamSide: attackingSide,
        teamName: attackingTeam.name,
        playerName: forward.name,
        description: `${forward.name} (${attackingTeam.shortName}) teve espaço na grande área, mas o remate saiu a rasar o poste!`,
        scoreHome: this.state.homeScore,
        scoreAway: this.state.awayScore,
        details: { diceAttacker: diceShot, diceDefender: diceGK, rollResult: `Ao lado (${shotRating.toFixed(1)} vs ${gkRating.toFixed(1)})` }
      });
    }
  }

  // Simula o jogo completo instantaneamente (Modo Bot vs Bot ou Fast Sim)
  public simulateFullMatch(): MatchState {
    while (!this.state.isFinished) {
      this.step(3);
    }
    return this.state;
  }
}
