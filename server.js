import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '25mb' }));

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'leagues_db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('[DB] Erro ao ler leagues_db.json:', err.message);
  }
  return { leagues: {} };
}

function saveDB(db) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[DB] Erro ao gravar leagues_db.json:', err.message);
    return false;
  }
}

function getClubInitialsServer(name) {
  if (!name) return "CLU";
  const words = name.trim().split(/\s+/);
  if (words.length >= 3) {
    return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
  } else if (words.length === 2) {
    return (words[0].substring(0, 2) + words[1][0]).toUpperCase();
  } else {
    return name.substring(0, 3).toUpperCase();
  }
}

app.get('/api/leagues', (req, res) => {
  try {
    const db = loadDB();
    const list = Object.values(db.leagues || {}).map(l => ({
      code: l.code,
      name: l.name,
      creatorName: l.creatorName,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      claimedClubsCount: Object.keys(l.claimedClubs || {}).length
    }));
    res.json({ ok: true, leagues: list });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Erro ao listar ligas.' });
  }
});

app.get('/api/health', (req, res) => {
  const db = loadDB();
  res.json({
    ok: true,
    server: 'Tiki-Taka Multiplayer Engine v2.0',
    timestamp: new Date().toISOString(),
    totalLeagues: Object.keys(db.leagues || {}).length
  });
});

app.post('/api/leagues', (req, res) => {
  try {
    const { name, code, password, creatorName, creatorClubId, customClubName, leagueState } = req.body;
    if (!name || !code || !password || !leagueState) {
      return res.status(400).json({ ok: false, error: 'Dados incompletos para criar a liga.' });
    }

    const cleanCode = code.trim().toUpperCase();
    const db = loadDB();

    if (db.leagues[cleanCode]) {
      if (cleanCode === 'TIKI-OFICIAL' || (password && String(db.leagues[cleanCode].password).trim() === String(password).trim())) {
        return res.json({ ok: true, league: db.leagues[cleanCode], existing: true });
      }
      return res.status(409).json({ ok: false, error: 'Já existe uma liga com este código de convite!' });
    }

    const chosenClubId = creatorClubId || 'lusitano';
    const cleanCreatorName = (creatorName || 'Treinador Principal').trim();

    if (customClubName && leagueState.clubs) {
      const cleanName = customClubName.trim();
      const dup = leagueState.clubs.find(x => x.id !== chosenClubId && x.name.trim().toLowerCase() === cleanName.toLowerCase());
      if (dup) {
        return res.status(409).json({ ok: false, error: `Já existe um clube com o nome "${cleanName}" neste campeonato! Escolhe um nome único.` });
      }
      const c = leagueState.clubs.find(x => x.id === chosenClubId);
      if (c) c.name = cleanName;
    }

    const newLeague = {
      id: 'srv_league_' + Date.now(),
      name: name.trim(),
      code: cleanCode,
      password: String(password).trim(),
      creatorName: cleanCreatorName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      claimedClubs: {
        [chosenClubId]: {
          managerName: cleanCreatorName,
          isCreator: true,
          claimedAt: new Date().toISOString()
        }
      },
      leagueState
    };

    db.leagues[cleanCode] = newLeague;
    saveDB(db);

    console.log(`[LIGA] Criada: "${name}" (${cleanCode}) por ${cleanCreatorName} [Clube: ${chosenClubId}]`);
    res.json({ ok: true, league: newLeague });
  } catch (err) {
    console.error('[API] Erro ao criar liga:', err);
    res.status(500).json({ ok: false, error: 'Erro interno ao criar a liga no servidor.' });
  }
});

app.get('/api/leagues/:code', (req, res) => {
  try {
    const cleanCode = req.params.code.trim().toUpperCase();
    const db = loadDB();
    const league = db.leagues[cleanCode];

    if (!league) {
      return res.status(404).json({ ok: false, error: 'Liga não encontrada com este código.' });
    }

    const clubsSummary = (league.leagueState.clubs || []).map(c => {
      const claim = league.claimedClubs ? league.claimedClubs[c.id] : null;
      return {
        id: c.id,
        name: c.name,
        short: c.short,
        primaryColor: c.primaryColor,
        secondaryColor: c.secondaryColor,
        isClaimed: !!claim,
        managerName: claim ? claim.managerName : null,
        isCreator: claim ? !!claim.isCreator : false
      };
    });

    res.json({
      ok: true,
      name: league.name,
      code: league.code,
      creatorName: league.creatorName,
      season: league.leagueState.season || 1,
      currentRound: league.leagueState.currentRound || 1,
      claimedClubs: league.claimedClubs || {},
      clubs: clubsSummary,
      updatedAt: league.updatedAt
    });
  } catch (err) {
    console.error('[API] Erro ao carregar detalhes da liga:', err);
    res.status(500).json({ ok: false, error: 'Erro interno no servidor.' });
  }
});

app.post('/api/leagues/:code/join', (req, res) => {
  try {
    const cleanCode = req.params.code.trim().toUpperCase();
    const { password, managerName, chosenClubId, customClubName } = req.body;
    const db = loadDB();
    const league = db.leagues[cleanCode];

    if (!league) {
      return res.status(404).json({ ok: false, error: 'Liga não encontrada com este código.' });
    }

    if (String(league.password).trim() !== String(password).trim()) {
      return res.status(401).json({ ok: false, error: 'Palavra-passe incorreta para este campeonato.' });
    }

    if (!chosenClubId) {
      return res.status(400).json({ ok: false, error: 'Tens de selecionar uma equipa para jogar!' });
    }

    if (!league.claimedClubs) {
      league.claimedClubs = {};
    }

    if (league.claimedClubs[chosenClubId]) {
      const existing = league.claimedClubs[chosenClubId];
      const isPasswordValid = String(league.password).trim() === String(password).trim();
      if (!isPasswordValid) {
        return res.status(409).json({
          ok: false,
          error: `A equipa selecionada já está ocupada pelo treinador "${existing.managerName}"! Escolhe outra equipa livre ou insere a senha correta.`
        });
      }
      if (managerName) existing.managerName = managerName.trim();
      existing.claimedAt = new Date().toISOString();
      league.updatedAt = new Date().toISOString();
      saveDB(db);
      console.log(`[LIGA] ${existing.managerName} retomou o comando de ${chosenClubId} em ${cleanCode}`);
      return res.json({
        ok: true,
        leagueState: league.leagueState,
        claimedClubs: league.claimedClubs,
        chosenClubId,
        leagueName: league.name,
        code: league.code,
        resumed: true
      });
    }

    const cleanManagerName = (managerName || 'Treinador Convidado').trim();

    league.claimedClubs[chosenClubId] = {
      managerName: cleanManagerName,
      isCreator: false,
      claimedAt: new Date().toISOString()
    };

    if (customClubName && league.leagueState && league.leagueState.clubs) {
      const cleanName = customClubName.trim();
      const dup = league.leagueState.clubs.find(x => x.id !== chosenClubId && x.name.trim().toLowerCase() === cleanName.toLowerCase());
      if (dup) {
        return res.status(409).json({ ok: false, error: `Já existe um clube com o nome "${cleanName}" neste campeonato! Escolhe um nome único.` });
      }
      const c = league.leagueState.clubs.find(x => x.id === chosenClubId);
      if (c) c.name = cleanName;
    }

    league.updatedAt = new Date().toISOString();
    saveDB(db);

    console.log(`[LIGA] ${cleanManagerName} entrou na liga "${league.name}" (${cleanCode}) com a equipa ${chosenClubId}`);

    res.json({
      ok: true,
      leagueState: league.leagueState,
      claimedClubs: league.claimedClubs,
      chosenClubId,
      leagueName: league.name,
      code: league.code
    });
  } catch (err) {
    console.error('[API] Erro ao entrar na liga:', err);
    res.status(500).json({ ok: false, error: 'Erro interno ao entrar na liga.' });
  }
});

app.post('/api/leagues/:code/club', (req, res) => {
  try {
    const cleanCode = req.params.code.trim().toUpperCase();
    const { clubId, name, primaryColor, secondaryColor } = req.body;
    const db = loadDB();
    const league = db.leagues[cleanCode];
    if (!league) return res.status(404).json({ ok: false, error: 'Liga não encontrada.' });
    if (!clubId || !name) return res.status(400).json({ ok: false, error: 'Dados incompletos.' });

    const cleanName = name.trim();
    const dup = (league.leagueState.clubs || []).find(x => x.id !== clubId && x.name.trim().toLowerCase() === cleanName.toLowerCase());
    if (dup) {
      return res.status(409).json({ ok: false, error: `Já existe um clube com o nome "${cleanName}" neste campeonato! Escolhe um nome único.` });
    }

    const c = (league.leagueState.clubs || []).find(x => x.id === clubId);
    if (c) {
      c.name = cleanName;
      c.short = getClubInitialsServer(cleanName);
      if (primaryColor) c.primaryColor = primaryColor;
      if (secondaryColor) c.secondaryColor = secondaryColor;
      league.updatedAt = new Date().toISOString();
      saveDB(db);
    }
    res.json({ ok: true, club: c });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Erro ao atualizar clube no servidor.' });
  }
});

app.get('/api/leagues/:code/state', (req, res) => {
  try {
    const cleanCode = req.params.code.trim().toUpperCase();
    const db = loadDB();
    const league = db.leagues[cleanCode];

    if (!league) {
      if (leagueState) {
        db.leagues[cleanCode] = {
          id: 'srv_league_' + Date.now(),
          name: req.body.name || (cleanCode === 'TIKI-OFICIAL' ? 'Liga Principal Tiki-Taka' : `Liga ${cleanCode}`),
          code: cleanCode,
          password: String(password || '123').trim(),
          creatorName: req.body.creatorName || 'Treinador Principal',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          claimedClubs: req.body.claimedClubs || {
            [leagueState.userClubId || 'lusitano']: {
              managerName: req.body.creatorName || 'Treinador Principal',
              isCreator: true,
              claimedAt: new Date().toISOString()
            }
          },
          leagueState
        };
        saveDB(db);
        console.log(`[LIGA] Auto-criada via sync: ${cleanCode}`);
        return res.json({ ok: true, autoCreated: true, updatedAt: db.leagues[cleanCode].updatedAt });
      }
      return res.status(404).json({ ok: false, error: 'Liga não encontrada.' });
    }

    res.json({
      ok: true,
      leagueState: league.leagueState,
      claimedClubs: league.claimedClubs || {},
      name: league.name,
      code: league.code,
      updatedAt: league.updatedAt
    });
  } catch (err) {
    console.error('[API] Erro ao obter estado da liga:', err);
    res.status(500).json({ ok: false, error: 'Erro interno no servidor.' });
  }
});

app.post('/api/leagues/:code/sync', (req, res) => {
  try {
    const cleanCode = req.params.code.trim().toUpperCase();
    const { password, leagueState } = req.body;
    const db = loadDB();
    const league = db.leagues[cleanCode];

    if (!league) {
      return res.status(404).json({ ok: false, error: 'Liga não encontrada.' });
    }

    if (password && String(league.password).trim() !== String(password).trim()) {
      return res.status(401).json({ ok: false, error: 'Palavra-passe inválida.' });
    }

    if (leagueState) {
      league.leagueState = leagueState;
      league.updatedAt = new Date().toISOString();
      saveDB(db);
    }

    res.json({ ok: true, updatedAt: league.updatedAt });
  } catch (err) {
    console.error('[API] Erro ao sincronizar liga:', err);
    res.status(500).json({ ok: false, error: 'Erro interno ao sincronizar.' });
  }
});

app.delete('/api/leagues/:code', (req, res) => {
  try {
    const cleanCode = req.params.code.trim().toUpperCase();
    const db = loadDB();
    if (db.leagues && db.leagues[cleanCode]) {
      delete db.leagues[cleanCode];
      saveDB(db);
      console.log(`[LIGA] Apagada da VPS: ${cleanCode}`);
      return res.json({ ok: true, message: 'Liga apagada com sucesso.' });
    }
    res.json({ ok: true, message: 'Liga já não constava na base de dados.' });
  } catch (err) {
    console.error('[API] Erro ao apagar liga:', err);
    res.status(500).json({ ok: false, error: 'Erro ao apagar liga no servidor.' });
  }
});

app.get('/api/backup', (req, res) => {
  const db = loadDB();
  res.setHeader('Content-Disposition', `attachment; filename="tikitaka_vps_backup_${Date.now()}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(db, null, 2));
});

app.post('/api/restore', (req, res) => {
  try {
    const backupData = req.body;
    if (!backupData || typeof backupData !== 'object' || !backupData.leagues) {
      return res.status(400).json({ ok: false, error: 'Formato de backup inválido.' });
    }
    saveDB(backupData);
    res.json({ ok: true, totalLeagues: Object.keys(backupData.leagues).length });
  } catch (err) {
    console.error('[API] Erro ao restaurar backup:', err);
    res.status(500).json({ ok: false, error: 'Erro ao restaurar backup.' });
  }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`⚽ Tiki-Taka Simulator & Multiplayer Server online na porta ${PORT}`);
});