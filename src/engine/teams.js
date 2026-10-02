
function createPlayer(id, name, position, overall, age, isStarter) {
  return { id, name, position, overall, age, isStarter };
}

const LEAGUE_TEAMS = [
  {
    id: 'lusitano',
    name: 'Lusitano Ginásio',
    shortName: 'LUS',
    primaryColor: '#16a34a',
    secondaryColor: '#ffffff',
    isBot: false,
    tactics: { formation: '4-3-3', mentality: 'balanced', pressing: 'high', buildup: 'tiki_taka' },
    players: [
      createPlayer('lus_1', 'Rui Patrício', 'GR', 7, 28, true),
      createPlayer('lus_2', 'João Cancelo', 'DF', 7, 26, true),
      createPlayer('lus_3', 'Rúben Dias', 'DF', 8, 25, true),
      createPlayer('lus_4', 'Gonçalo Inácio', 'DF', 7, 22, true),
      createPlayer('lus_5', 'Nuno Mendes', 'DF', 7, 21, true),
      createPlayer('lus_6', 'João Palhinha', 'MD', 7, 27, true),
      createPlayer('lus_7', 'Vitinha', 'MD', 8, 23, true),
      createPlayer('lus_8', 'Bernardo Silva', 'MD', 8, 29, true),
      createPlayer('lus_9', 'Pedro Neto', 'AV', 7, 23, true),
      createPlayer('lus_10', 'Gonçalo Ramos', 'AV', 7, 22, true),
      createPlayer('lus_11', 'Rafael Leão', 'AV', 8, 24, true),
    ]
  },
  {
    id: 'estrela_ribatejo',
    name: 'Estrela do Ribatejo',
    shortName: 'EST',
    primaryColor: '#dc2626',
    secondaryColor: '#ffffff',
    isBot: true,
    tactics: { formation: '4-4-2', mentality: 'attacking', pressing: 'balanced', buildup: 'direct' },
    players: [
      createPlayer('est_1', 'Vítor Baía', 'GR', 8, 30, true),
      createPlayer('est_2', 'Secretário', 'DF', 6, 29, true),
      createPlayer('est_3', 'Jorge Costa', 'DF', 7, 28, true),
      createPlayer('est_4', 'Fernando Couto', 'DF', 8, 29, true),
      createPlayer('est_5', 'Dimas Teixeira', 'DF', 6, 27, true),
      createPlayer('est_6', 'Paulo Bento', 'MD', 7, 30, true),
      createPlayer('est_7', 'Costinha', 'MD', 6, 26, true),
      createPlayer('est_8', 'Rui Costa', 'MD', 8, 27, true),
      createPlayer('est_9', 'Luís Figo', 'MD', 9, 27, true),
      createPlayer('est_10', 'João Pinto', 'AV', 7, 28, true),
      createPlayer('est_11', 'Pauleta', 'AV', 8, 26, true),
    ]
  }
];

module.exports = { LEAGUE_TEAMS };
