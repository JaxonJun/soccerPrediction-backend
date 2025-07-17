const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from the current directory

// MongoDB 连接
mongoose.connect('mongodb+srv://wanoarckaido:IKlOtl8D9bBEn1IR@soccer-prediction.aaekq3f.mongodb.net/soccer-prediction?retryWrites=true&w=majority&appName=Football-Prediction', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB Connected'));

// 模型定义
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  predictions: [{ matchId: String, selectedTeam: String, guessA: Number, guessB: Number }],
  ticketId: String,
  createdAt: Date,
});
const MatchSchema = new mongoose.Schema({
  matchId: String,
  sportKey: String,
  teamA: String,
  teamB: String,
  oddsA: Number,
  oddsB: Number,
  scoreA: Number,
  scoreB: Number,
  result: String,
  status: { type: String, default: 'not_started' },
  lastUpdated: { type: Date, default: Date.now },
});
const TicketSchema = new mongoose.Schema({
  ticketId: String,
  username: String,
  predictions: [{ matchId: String, selectedTeam: String, guessA: Number, guessB: Number }],
  status: String,
  createdAt: Date,
});
const AdminSchema = new mongoose.Schema({
  username: String,
  password: String,
});

const User = mongoose.model('User', UserSchema);
const Match = mongoose.model('Match', MatchSchema);
const Ticket = mongoose.model('Ticket', TicketSchema);
const Admin = mongoose.model('Admin', AdminSchema);

// 初始化管理员
const initAdmin = async () => {
  const adminExists = await Admin.findOne({ username: 'admin' });
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await Admin.create({ username: 'admin', password: hashedPassword });
  }
};

// API 路由
app.get('/api/sports', async (req, res) => {
  try {
    const apiKey = '61f4311747f0fa551f5e701d0f24a21d';
    const response = await axios.get('https://api.the-odds-api.com/v4/sports/', {
      params: { apiKey }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Sports fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch sports' });
  }
});

app.get('/api/odds/:sportKey', async (req, res) => {
  try {
    const { sportKey } = req.params;
    const apiKey = '61f4311747f0fa551f5e701d0f24a21d';
    const response = await axios.get(`https://api.the-odds-api.com/v4/sports/${sportKey}/odds`, {
      params: { apiKey, regions: 'us', oddsFormat: 'decimal' }
    });
    const oddsData = response.data;
    await Match.deleteMany({ sportKey });
    
    // Update the Match schema to include drawOdds
    if (!Match.schema.paths.drawOdds) {
      Match.schema.add({ drawOdds: Number });
    }
    
    const insertPromises = oddsData.map(async (match) => {
      // Extract odds for home team, away team, and draw
      let oddsA = 0;
      let oddsB = 0;
      let drawOdds = 0;
      
      // Try to find the bookmaker with the most complete odds
      const bookmaker = match.bookmakers && match.bookmakers.length > 0 ? match.bookmakers[0] : null;
      
      if (bookmaker && bookmaker.markets && bookmaker.markets.length > 0) {
        const market = bookmaker.markets.find(m => m.key === 'h2h') || bookmaker.markets[0];
        
        if (market && market.outcomes && market.outcomes.length > 0) {
          // Find home team odds
          const homeOutcome = market.outcomes.find(o => o.name === match.home_team);
          if (homeOutcome) {
            oddsA = homeOutcome.price;
          }
          
          // Find away team odds
          const awayOutcome = market.outcomes.find(o => o.name === match.away_team);
          if (awayOutcome) {
            oddsB = awayOutcome.price;
          }
          
          // Find draw odds
          const drawOutcome = market.outcomes.find(o => o.name === 'Draw');
          if (drawOutcome) {
            drawOdds = drawOutcome.price;
          }
        }
      }
      
      const newMatch = new Match({
        matchId: match.id,
        sportKey,
        teamA: match.home_team,
        teamB: match.away_team,
        oddsA: oddsA || 0,
        oddsB: oddsB || 0,
        drawOdds: drawOdds || 0,
        status: match.status || 'not_started',
        lastUpdated: new Date()
      });
      return newMatch.save();
    });
    
    await Promise.all(insertPromises);
    res.json({ message: 'Odds data inserted', count: oddsData.length, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Odds fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch odds' });
  }
});

app.get('/api/scores/:sportKey', async (req, res) => {
  try {
    const { sportKey } = req.params;
    const apiKey = '61f4311747f0fa551f5e701d0f24a21d';
    const response = await axios.get(`https://api.the-odds-api.com/v4/sports/${sportKey}/scores`, {
      params: { apiKey, daysFrom: 2 }
    });
    const scoresData = response.data;
    const updatePromises = scoresData.map(async (match) => {
      await Match.findOneAndUpdate(
        { matchId: match.id },
        {
          scoreA: match.scores?.home_score || null,
          scoreB: match.scores?.away_score || null,
          status: match.status || 'completed',
          result: match.scores?.home_score > match.scores?.away_score ? 'teamA' : match.scores?.home_score < match.scores?.away_score ? 'teamB' : 'draw',
          lastUpdated: new Date()
        },
        { new: true, upsert: true }
      );
    });
    await Promise.all(updatePromises);
    await updateTicketStatus();
    res.json({ message: 'Scores updated', count: scoresData.length, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Scores fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch scores' });
  }
});

app.get('/api/matches/:sportKey', async (req, res) => {
  const { sportKey } = req.params;
  const matches = await Match.find({ sportKey });
  res.json(matches);
});

app.get('/api/all-matches', async (req, res) => {
  try {
    const { sportKey } = req.query;

    // If sportKey is provided, filter by it
    const query = sportKey ? { sportKey } : {};

    const matches = await Match.find(query);
    res.json(matches);
  } catch (error) {
    console.error('Error fetching all matches:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// Delete all matches
app.delete('/api/admin/delete-all-matches', async (req, res) => {
  try {
    const { sportKey } = req.body;

    // If sportKey is provided, delete only matches with that sportKey
    const query = sportKey ? { sportKey } : {};

    const result = await Match.deleteMany(query);

    res.json({
      message: sportKey
        ? `All matches for sport key '${sportKey}' deleted successfully`
        : 'All matches deleted successfully',
      count: result.deletedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error deleting matches:', error);
    res.status(500).json({ error: 'Failed to delete matches' });
  }
});

// Delete a specific match
app.delete('/api/admin/delete-match/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;

    const result = await Match.deleteOne({ matchId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json({
      message: `Match with ID '${matchId}' deleted successfully`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error deleting match:', error);
    res.status(500).json({ error: 'Failed to delete match' });
  }
});

app.post('/api/predict', async (req, res) => {
  const { username, predictions } = req.body;
  const userExists = await User.findOne({ username });
  if (userExists) {
    return res.status(400).json({ message: 'User has already predicted' });
  }
  const ticketId = uuidv4();
  const ticket = await Ticket.create({
    ticketId,
    username,
    predictions,
    status: 'pending',
    createdAt: new Date(),
  });
  await User.create({ username, predictions, ticketId, createdAt: new Date() });
  res.json({ ticketId, message: 'Prediction submitted' });
});

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const admin = await Admin.findOne({ username });
  if (!admin || !(await bcrypt.compare(password, admin.password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const token = jwt.sign({ username }, 'secret', { expiresIn: '1h' });
  res.json({ token });
});

app.post('/api/admin/reset-user', async (req, res) => {
  const { token, username } = req.body;
  try {
    jwt.verify(token, 'secret');
    await User.deleteOne({ username });
    await Ticket.deleteOne({ username });
    res.json({ message: 'User reset successfully' });
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

app.post('/api/admin/update-scores', async (req, res) => {
  const { token, matchId, scoreA, scoreB } = req.body;
  try {
    jwt.verify(token, 'secret');
    const match = await Match.findOneAndUpdate(
      { matchId },
      { scoreA, scoreB, status: 'completed', result: scoreA > scoreB ? 'teamA' : scoreA < scoreB ? 'teamB' : 'draw' },
      { new: true }
    );
    await updateTicketStatus();
    res.json({ message: 'Scores updated' });
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

app.get('/api/user-predictions/:username', async (req, res) => {
  const user = await User.findOne({ username: req.params.username });
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
});

app.get('/api/ticket/:ticketId', async (req, res) => {
  const ticket = await Ticket.findOne({ ticketId: req.params.ticketId });
  if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
  res.json(ticket);
});

// Get all tickets (for results page)
app.get('/api/all-tickets', async (req, res) => {
  try {
    const tickets = await Ticket.find().sort({ createdAt: -1 }).limit(100);
    res.json(tickets);
  } catch (error) {
    console.error('Error fetching all tickets:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Get tickets by status (for winners page)
app.get('/api/tickets/by-status/:status', async (req, res) => {
  try {
    const { status } = req.params;
    const tickets = await Ticket.find({ status }).sort({ createdAt: -1 }).limit(50);
    res.json(tickets);
  } catch (error) {
    console.error(`Error fetching tickets by status ${req.params.status}:`, error);
    res.status(500).json({ error: 'Failed to fetch tickets by status' });
  }
});

app.get('/api/results/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const match = await Match.findOne({ matchId });
    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json(match);
  } catch (error) {
    console.error('Results error:', error.message);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

app.post('/api/guess/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { username, guessA, guessB } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const existingGuess = user.predictions.find(p => p.matchId === matchId);
    if (existingGuess) {
      return res.status(400).json({ message: 'Guess already exists for this match' });
    }

    const selectedTeam = guessA > guessB ? 'teamA' : guessA < guessB ? 'teamB' : 'draw';
    user.predictions.push({ matchId, selectedTeam, guessA, guessB });
    await user.save();

    const ticket = await Ticket.findOne({ username });
    if (ticket) {
      ticket.predictions.push({ matchId, selectedTeam, guessA, guessB });
      await ticket.save();
    }

    res.json({ message: 'Guess recorded', ticketId: user.ticketId, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Guess error:', error.message);
    res.status(500).json({ error: 'Failed to record guess' });
  }
});

const updateTicketStatus = async () => {
  const tickets = await Ticket.find();
  for (const ticket of tickets) {
    let correct = true;
    for (const pred of ticket.predictions) {
      const match = await Match.findOne({ matchId: pred.matchId });
      if (match.result && match.result !== pred.selectedTeam) {
        correct = false;
        break;
      } else if (match.scoreA !== null && match.scoreB !== null && (match.scoreA !== pred.guessA || match.scoreB !== pred.guessB)) {
        correct = false;
        break;
      }
    }
    ticket.status = correct ? 'win' : 'lose';
    await ticket.save();
  }
};

// 每天自动更新结果 - DISABLED to save API credits
const updateScoresDaily = async () => {
  try {
    console.log('Daily score update is DISABLED to save API credits.');
    console.log('Use the admin panel to manually fetch odds and scores for specific leagues only.');

    // Create sample matches if no matches exist
    const matchCount = await Match.countDocuments();
    if (matchCount === 0) {
      console.log('No matches found, creating sample matches...');

      // Create sample matches
      const sampleMatches = [
        {
          matchId: 'match_' + Date.now() + '_1',
          sportKey: 'soccer_uefa_champs_league_qualification',
          teamA: 'Manchester United',
          teamB: 'Barcelona',
          oddsA: 2.5,
          oddsB: 1.8,
          scoreA: null,
          scoreB: null,
          status: 'not_started',
          result: 'pending',
          lastUpdated: new Date()
        },
        {
          matchId: 'match_' + Date.now() + '_2',
          sportKey: 'soccer_uefa_champs_league_qualification',
          teamA: 'Real Madrid',
          teamB: 'Bayern Munich',
          oddsA: 1.9,
          oddsB: 2.1,
          scoreA: null,
          scoreB: null,
          status: 'not_started',
          result: 'pending',
          lastUpdated: new Date()
        },
        {
          matchId: 'match_' + Date.now() + '_3',
          sportKey: 'soccer_uefa_champs_league_qualification',
          teamA: 'Liverpool',
          teamB: 'Juventus',
          oddsA: 2.2,
          oddsB: 2.0,
          scoreA: null,
          scoreB: null,
          status: 'not_started',
          result: 'pending',
          lastUpdated: new Date()
        }
      ];

      await Match.insertMany(sampleMatches);
      console.log(`Created ${sampleMatches.length} sample matches`);
    }

    // Update ticket statuses for existing matches
    await updateTicketStatus();
  } catch (error) {
    console.error('Error in daily score update:', error);
  }
};
// Daily update is disabled to save API credits
// setInterval(updateScoresDaily, 24 * 60 * 60 * 1000);

app.post('/api/admin/matches', async (req, res) => {
  const { matches } = req.body;
  const results = {
    added: [],
    updated: [],
    duplicates: []
  };

  try {
    for (const match of matches) {
      const { matchId, teamA, teamB, oddsA, oddsB, scoreA, scoreB, sportKey } = match;
      
      // Check if this match already exists
      const existingMatch = await Match.findOne({ matchId });
      
      // If it's a new match with teams that already exist in a match, consider it a potential duplicate
      if (!existingMatch && teamA && teamB) {
        const duplicateTeamMatch = await Match.findOne({
          teamA: teamA,
          teamB: teamB,
          sportKey: sportKey
        });
        
        if (duplicateTeamMatch) {
          results.duplicates.push({
            matchId,
            teamA,
            teamB,
            existingMatchId: duplicateTeamMatch.matchId
          });
          continue; // Skip this match
        }
      }
      
      let result = 'pending';
      if (scoreA !== null && scoreB !== null) {
        result = scoreA > scoreB ? 'teamA' : scoreA < scoreB ? 'teamB' : 'draw';
      }
      
      if (existingMatch) {
        // Update existing match
        await Match.updateOne(
          { matchId },
          { sportKey, teamA, teamB, oddsA, oddsB, scoreA, scoreB, result, lastUpdated: new Date() }
        );
        results.updated.push({ matchId, teamA, teamB });
      } else {
        // Add new match
        await Match.create({
          matchId, 
          sportKey, 
          teamA, 
          teamB, 
          oddsA, 
          oddsB, 
          scoreA, 
          scoreB, 
          result, 
          lastUpdated: new Date()
        });
        results.added.push({ matchId, teamA, teamB });
      }
    }
    
    // Prepare response message
    let message = '';
    if (results.added.length > 0) {
      message += `${results.added.length} matches added. `;
    }
    if (results.updated.length > 0) {
      message += `${results.updated.length} matches updated. `;
    }
    if (results.duplicates.length > 0) {
      message += `${results.duplicates.length} potential duplicates skipped. `;
    }
    
    res.json({ 
      message: message || 'No changes made',
      results,
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    console.error('Error adding/updating matches:', error);
    res.status(500).json({ 
      error: 'Failed to process matches', 
      details: error.message 
    });
  }
});

// Create sample matches for testing
app.post('/api/admin/create-sample-matches', async (req, res) => {
  try {
    const { sportKey = 'soccer_uefa_champs_league_qualification' } = req.body;

    // Create sample matches
    const sampleMatches = [
      {
        matchId: 'match_' + Date.now() + '_1',
        sportKey,
        teamA: 'Manchester United',
        teamB: 'Barcelona',
        oddsA: 2.5,
        oddsB: 1.8,
        scoreA: null,
        scoreB: null,
        status: 'not_started',
        result: 'pending',
        lastUpdated: new Date()
      },
      {
        matchId: 'match_' + Date.now() + '_2',
        sportKey,
        teamA: 'Real Madrid',
        teamB: 'Bayern Munich',
        oddsA: 1.9,
        oddsB: 2.1,
        scoreA: null,
        scoreB: null,
        status: 'not_started',
        result: 'pending',
        lastUpdated: new Date()
      },
      {
        matchId: 'match_' + Date.now() + '_3',
        sportKey,
        teamA: 'Liverpool',
        teamB: 'Juventus',
        oddsA: 2.2,
        oddsB: 2.0,
        scoreA: null,
        scoreB: null,
        status: 'not_started',
        result: 'pending',
        lastUpdated: new Date()
      }
    ];

    // Insert sample matches
    await Match.insertMany(sampleMatches);

    res.json({
      message: 'Sample matches created successfully',
      count: sampleMatches.length,
      matches: sampleMatches,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error creating sample matches:', error);
    res.status(500).json({ error: 'Failed to create sample matches' });
  }
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} at ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })}`);
  initAdmin();
  // updateScoresDaily() is disabled to save API credits
});