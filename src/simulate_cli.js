// CLI Match Simulator for Tiki-Taka Engine
const { LEAGUE_TEAMS } = require('./engine/teams.js');

function rollDice() {
  return Math.floor(Math.random() * 6) + 1;
}

function runMatchSimulation() {
  const homeTeam = LEAGUE_TEAMS[0]; // Lusitano FC
  const awayTeam = LEAGUE_TEAMS[1]; // Estrela do Ribatejo

  console.log("==================================================================");
  console.log(`⚽ TIKI-TAKA SIMULADOR DE PARTIDA: ${homeTeam.name} vs ${awayTeam.name}`);
  console.log("==================================================================");
  console.log(`Tática Casa: ${homeTeam.tactics.formation} | Mentalidade: ${homeTeam.tactics.mentality} | Pressão: ${homeTeam.tactics.pressing}`);
  console.log(`Tática Fora: ${awayTeam.tactics.formation} | Mentalidade: ${awayTeam.tactics.mentality} | Pressão: ${awayTeam.tactics.pressing}`);
  console.log("------------------------------------------------------------------\n");

  const homeStarters = homeTeam.players.filter(p => p.isStarter);
  const awayStarters = awayTeam.players.filter(p => p.isStarter);

  const avg = (arr) => arr.length > 0 ? arr.reduce((acc, p) => acc + p.overall, 0) / arr.length : 5;
  const getPower = (team, starters) => {
    let gr = avg(starters.filter(p => p.position === 'GR'));
    let df = avg(starters.filter(p => p.position === 'DF'));
    let md = avg(starters.filter(p => p.position === 'MD'));
    let av = avg(starters.filter(p => p.position === 'AV'));
    if (team.tactics.mentality === 'attacking') { df -= 1; av += 1; }
    if (team.tactics.mentality === 'defensive') { df += 1; av -= 1; }
    if (team.tactics.pressing === 'high') { md += 1; df -= 0.5; }
    if (team.tactics.buildup === 'tiki_taka') { md += 0.8; }
    return { gr, df, md, av };
  };

  const homePower = getPower(homeTeam, homeStarters);
  const awayPower = getPower(awayTeam, awayStarters);

  console.log(`Poder ${homeTeam.shortName}: GR ${homePower.gr.toFixed(1)} | DF ${homePower.df.toFixed(1)} | MD ${homePower.md.toFixed(1)} | AV ${homePower.av.toFixed(1)}`);
  console.log(`Poder ${awayTeam.shortName}: GR ${awayPower.gr.toFixed(1)} | DF ${awayPower.df.toFixed(1)} | MD ${awayPower.md.toFixed(1)} | AV ${awayPower.av.toFixed(1)}`);
  console.log("\n--- INÍCIO DA PARTIDA ---\n");

  let minute = 0;
  let homeScore = 0;
  let awayScore = 0;
  let shotsH = 0, shotsA = 0, onTargetH = 0, onTargetA = 0, tacklesH = 0, tacklesA = 0;
  let possHCount = 0, possACount = 0;

  while (minute < 90) {
    minute += 3;

    // Janelas Táticas a cada 15'
    if (minute === 45) {
      console.log(`\n[45'] ⏸️ INTERVALO: ${homeTeam.name} ${homeScore} - ${awayScore} ${awayTeam.name}\n`);
    }

    // Duelo 1: Meio-campo
    const dH_MD = rollDice();
    const dA_MD = rollDice();
    const scoreMDH = homePower.md + dH_MD;
    const scoreMDA = awayPower.md + dA_MD;

    let attSide, defSide, attTeam, defTeam, attStarters, defStarters, attPow, defPow;
    if (scoreMDH >= scoreMDA) {
      attSide = 'H'; defSide = 'A'; attTeam = homeTeam; defTeam = awayTeam;
      attStarters = homeStarters; defStarters = awayStarters;
      attPow = homePower; defPow = awayPower;
      possHCount++;
    } else {
      attSide = 'A'; defSide = 'H'; attTeam = awayTeam; defTeam = homeTeam;
      attStarters = awayStarters; defStarters = homeStarters;
      attPow = awayPower; defPow = homePower;
      possACount++;
    }

    // Duelo 2: Ataque vs Defesa
    const dAtt = rollDice();
    const dDef = rollDice();
    const attRoll = attPow.av + dAtt;
    const defRoll = defPow.df + dDef;

    if (defRoll >= attRoll) {
      if (defSide === 'H') tacklesH++; else tacklesA++;
      if (Math.random() < 0.25) {
        const defP = defStarters.filter(p => p.position === 'DF')[0];
        console.log(`[${minute}'] 🛡️ Corte seguro de ${defP.name} (${defTeam.shortName}), travando a ofensiva adversária.`);
      }
      continue;
    }

    // Passou a defesa! Remate!
    if (attSide === 'H') shotsH++; else shotsA++;
    const forward = attStarters.filter(p => p.position === 'AV')[Math.floor(Math.random() * attStarters.filter(p => p.position === 'AV').length)];
    const gk = defStarters.filter(p => p.position === 'GR')[0];

    const dShot = rollDice();
    const dGK = rollDice();
    const shotRating = forward.overall + dShot;
    const gkRating = defPow.gr + dGK + 1.5;

    if (shotRating > gkRating) {
      if (attSide === 'H') { homeScore++; onTargetH++; }
      else { awayScore++; onTargetA++; }
      console.log(`[${minute}'] ⚽ GOLOOOO DO ${attTeam.name.toUpperCase()}! Remate certeiro de ${forward.name}! (${homeTeam.shortName} ${homeScore} - ${awayScore} ${awayTeam.shortName})`);
    } else if (gkRating - shotRating <= 2.0) {
      if (attSide === 'H') onTargetH++; else onTargetA++;
      console.log(`[${minute}'] 🧤 GRANDE DEFESA! ${gk.name} (${defTeam.shortName}) estica-se e nega o golo a ${forward.name}!`);
    } else {
      console.log(`[${minute}'] 💥 Remate ao lado de ${forward.name} (${attTeam.shortName}) após desmarcação na grande área.`);
    }
  }

  const totalTicks = possHCount + possACount;
  const possHPct = Math.round((possHCount / totalTicks) * 100);
  const possAPct = 100 - possHPct;

  console.log("\n==================================================================");
  console.log(`🏆 APITO FINAL: ${homeTeam.name} ${homeScore} - ${awayScore} ${awayTeam.name}`);
  console.log("==================================================================");
  console.log(`Posse de Bola: ${homeTeam.shortName} ${possHPct}% - ${possAPct}% ${awayTeam.shortName}`);
  console.log(`Remates (À baliza): ${homeTeam.shortName} ${shotsH} (${onTargetH}) - ${shotsA} (${onTargetA}) ${awayTeam.shortName}`);
  console.log(`Desarmes Defensivos: ${homeTeam.shortName} ${tacklesH} - ${tacklesA} ${awayTeam.shortName}`);
  console.log("==================================================================\n");
}

runMatchSimulation();
