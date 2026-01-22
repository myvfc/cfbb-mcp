import express from 'express';

const app = express();
const PORT = process.env.PORT || 8080;
const MCP_API_KEY = process.env.MCP_API_KEY;
const CFBD_BASKETBALL_KEY = process.env.CFBD_BASKETBALL_KEY;

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Root
app.get('/', (req, res) => {
  res.json({ 
    service: 'CFBD Basketball MCP Server', 
    status: 'running', 
    tools: 7,
    sport: 'basketball'
  });
});

// MCP endpoint
app.all('/mcp', async (req, res) => {
  console.log(`${req.method} /mcp`);
  
  // Handle GET (connection check)
  if (req.method === 'GET') {
    return res.json({ service: 'Basketball MCP Server', status: 'ready' });
  }
  
  // Handle POST (MCP protocol)
  try {
    // Auth check
    if (MCP_API_KEY) {
      const auth = req.headers.authorization;
      if (!auth || auth !== `Bearer ${MCP_API_KEY}`) {
        return res.status(401).json({
          jsonrpc: '2.0',
          error: { code: -32001, message: 'Unauthorized' },
          id: req.body?.id
        });
      }
    }
    
    const { method, params, id } = req.body;
    console.log(`  Method: ${method}`);
    
    // Initialize
    if (method === 'initialize') {
      return res.json({
        jsonrpc: '2.0',
        result: {
          protocolVersion: '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name: 'cfbd-basketball', version: '1.0.0' }
        },
        id
      });
    }
    
    // List tools
    if (method === 'tools/list') {
      return res.json({
        jsonrpc: '2.0',
        result: {
          tools: [
            {
              name: 'get_basketball_score',
              description: 'Get recent basketball game scores and results',
              inputSchema: {
                type: 'object',
                properties: {
                  team: { type: 'string', description: 'Team name (e.g., "oklahoma")' },
                  year: { type: 'number', description: 'Season year (default: 2025)' }
                },
                required: ['team']
              }
            },
            {
              name: 'get_basketball_player_stats',
              description: 'Get individual basketball player statistics for a team',
              inputSchema: {
                type: 'object',
                properties: {
                  team: { type: 'string', description: 'Team name (e.g., "oklahoma")' },
                  year: { type: 'number', description: 'Season year (default: 2025)' },
                  query: { type: 'string', description: 'Optional player name to filter' }
                },
                required: ['team']
              }
            },
            {
              name: 'get_basketball_team_stats',
              description: 'Get team basketball statistics for a season',
              inputSchema: {
                type: 'object',
                properties: {
                  team: { type: 'string', description: 'Team name (e.g., "oklahoma")' },
                  year: { type: 'number', description: 'Season year (default: 2025)' }
                },
                required: ['team']
              }
            },
            {
              name: 'get_basketball_schedule',
              description: 'Get basketball team schedule',
              inputSchema: {
                type: 'object',
                properties: {
                  team: { type: 'string', description: 'Team name (e.g., "oklahoma")' },
                  year: { type: 'number', description: 'Season year (default: 2025)' }
                },
                required: ['team']
              }
            },
            {
              name: 'get_basketball_rankings',
              description: 'Get basketball team rankings (AP Poll, Coaches Poll)',
              inputSchema: {
                type: 'object',
                properties: {
                  team: { type: 'string', description: 'Team name (e.g., "oklahoma")' },
                  year: { type: 'number', description: 'Season year (default: 2025)' }
                },
                required: ['team']
              }
            },
            {
              name: 'get_basketball_shooting_stats',
              description: 'Get shooting statistics (FG%, 3PT%, FT%) for team or player',
              inputSchema: {
                type: 'object',
                properties: {
                  team: { type: 'string', description: 'Team name (e.g., "oklahoma")' },
                  year: { type: 'number', description: 'Season year (default: 2025)' },
                  query: { type: 'string', description: 'Optional player name to filter' }
                },
                required: ['team']
              }
            },
            {
              name: 'get_basketball_roster',
              description: 'Get current team roster',
              inputSchema: {
                type: 'object',
                properties: {
                  team: { type: 'string', description: 'Team name (e.g., "oklahoma")' },
                  year: { type: 'number', description: 'Season year (default: 2025)' }
                },
                required: ['team']
              }
            }
          ]
        },
        id
      });
    }
    
    // Call tool
    if (method === 'tools/call') {
      const { name, arguments: args } = params;
      console.log(`  Tool call: ${name}`, args);
      
      if (!CFBD_BASKETBALL_KEY) {
        return res.json({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: 'Error: CFBD Basketball API key not configured' }] },
          id
        });
      }
      
      const team = (args.team || 'oklahoma').toLowerCase();
      const year = args.year || 2025;
      
      // TOOL 1: Get Basketball Score
      if (name === 'get_basketball_score') {
        const url = `https://api.collegefootballdata.com/cbb/games?team=${team}&year=${year}`;
        console.log(`  Fetching: ${url}`);
        
        try {
          const response = await fetch(url, {
            headers: { Authorization: `Bearer ${CFBD_BASKETBALL_KEY}` },
            signal: AbortSignal.timeout(10000)
          });
          
          if (!response.ok) {
            return res.json({
              jsonrpc: '2.0',
              result: { content: [{ type: 'text', text: `CFBD API error: ${response.status}` }] },
              id
            });
          }
          
          const data = await response.json();
          
          if (!data || data.length === 0) {
            return res.json({
              jsonrpc: '2.0',
              result: { content: [{ type: 'text', text: `No basketball games found for ${team.toUpperCase()} in ${year}` }] },
              id
            });
          }
          
          // Get most recent game
          const recentGame = data[data.length - 1];
          
          let text = `🏀 ${team.toUpperCase()} BASKETBALL - Most Recent Game\n\n`;
          
          const isHome = recentGame.home_team?.toLowerCase() === team;
          const opponent = isHome ? recentGame.away_team : recentGame.home_team;
          const teamScore = isHome ? recentGame.home_score : recentGame.away_score;
          const oppScore = isHome ? recentGame.away_score : recentGame.home_score;
          const result = teamScore > oppScore ? 'W' : 'L';
          
          text += `${result} vs ${opponent}\n`;
          text += `Final: ${teamScore}-${oppScore}\n`;
          if (recentGame.status === 'completed') {
            text += `Status: Final\n`;
          }
          
          return res.json({
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text }] },
            id
          });
          
        } catch (err) {
          console.error('  Error:', err.message);
          return res.json({
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: `Error: ${err.message}` }] },
            id
          });
        }
      }
      
      // TOOL 2: Get Basketball Player Stats
      if (name === 'get_basketball_player_stats') {
        const url = `https://api.collegefootballdata.com/cbb/stats/player/season?team=${team}&year=${year}`;
        console.log(`  Fetching: ${url}`);
        
        try {
          const response = await fetch(url, {
            headers: { Authorization: `Bearer ${CFBD_BASKETBALL_KEY}` },
            signal: AbortSignal.timeout(10000)
          });
          
          if (!response.ok) {
            return res.json({
              jsonrpc: '2.0',
              result: { content: [{ type: 'text', text: `CFBD API error: ${response.status}` }] },
              id
            });
          }
          
          const data = await response.json();
          
          if (!data || data.length === 0) {
            return res.json({
              jsonrpc: '2.0',
              result: { content: [{ type: 'text', text: `No player stats found for ${team.toUpperCase()} basketball in ${year}` }] },
              id
            });
          }
          
          // Extract player name if provided
          let playerName = null;
          if (args.query) {
            const nameMatch = args.query.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z']+)+)\b/);
            if (nameMatch) {
              playerName = nameMatch[1].trim();
              console.log(`  Extracted player name: ${playerName}`);
            }
          }
          
          // Filter by player if specified
          let filteredData = data;
          if (playerName) {
            filteredData = data.filter(p => 
              p.player?.toLowerCase().includes(playerName.toLowerCase()) ||
              playerName.toLowerCase().includes(p.player?.toLowerCase())
            );
            
            if (filteredData.length === 0) {
              return res.json({
                jsonrpc: '2.0',
                result: { 
                  content: [{ 
                    type: 'text', 
                    text: `${playerName} is not listed in ${team.toUpperCase()}'s ${year} basketball roster.\n\nThis player may:\n• Play for a different team\n• Not have recorded stats this season\n• Have a different spelling of their name` 
                  }] 
                },
                id
              });
            }
          }
          
          let text = '';
          
          // If specific player, show detailed stats
          if (playerName && filteredData.length === 1) {
            const player = filteredData[0];
            text = `🏀 ${player.player?.toUpperCase() || 'PLAYER'} - ${year}\n\n`;
            
            if (player.ppg !== undefined) text += `Points Per Game: ${player.ppg}\n`;
            if (player.rpg !== undefined) text += `Rebounds Per Game: ${player.rpg}\n`;
            if (player.apg !== undefined) text += `Assists Per Game: ${player.apg}\n`;
            if (player.fg_pct !== undefined) text += `FG%: ${(player.fg_pct * 100).toFixed(1)}%\n`;
            if (player.three_pt_pct !== undefined) text += `3PT%: ${(player.three_pt_pct * 100).toFixed(1)}%\n`;
            if (player.ft_pct !== undefined) text += `FT%: ${(player.ft_pct * 100).toFixed(1)}%\n`;
          } else {
            // Show top scorers
            text = `🏀 ${team.toUpperCase()} BASKETBALL LEADERS - ${year}\n\n`;
            
            const topScorers = filteredData.sort((a, b) => (b.ppg || 0) - (a.ppg || 0)).slice(0, 5);
            
            text += `TOP SCORERS:\n`;
            topScorers.forEach((p, i) => {
              text += `${i + 1}. ${p.player}: ${p.ppg} PPG\n`;
            });
          }
          
          return res.json({
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text }] },
            id
          });
          
        } catch (err) {
          console.error('  Error:', err.message);
          return res.json({
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: `Error: ${err.message}` }] },
            id
          });
        }
      }
      
      // TOOL 3: Get Basketball Team Stats
      if (name === 'get_basketball_team_stats') {
        const url = `https://api.collegefootballdata.com/cbb/stats/team/season?team=${team}&year=${year}`;
        console.log(`  Fetching: ${url}`);
        
        try {
          const response = await fetch(url, {
            headers: { Authorization: `Bearer ${CFBD_BASKETBALL_KEY}` },
            signal: AbortSignal.timeout(10000)
          });
          
          if (!response.ok) {
            return res.json({
              jsonrpc: '2.0',
              result: { content: [{ type: 'text', text: `CFBD API error: ${response.status}` }] },
              id
            });
          }
          
          const data = await response.json();
          
          if (!data || data.length === 0) {
            return res.json({
              jsonrpc: '2.0',
              result: { content: [{ type: 'text', text: `No team stats found for ${team.toUpperCase()} basketball in ${year}` }] },
              id
            });
          }
          
          const stats = data[0];
          let text = `🏀 ${team.toUpperCase()} BASKETBALL TEAM STATS - ${year}\n\n`;
          
          if (stats.ppg !== undefined) text += `Points Per Game: ${stats.ppg}\n`;
          if (stats.rpg !== undefined) text += `Rebounds Per Game: ${stats.rpg}\n`;
          if (stats.apg !== undefined) text += `Assists Per Game: ${stats.apg}\n`;
          if (stats.fg_pct !== undefined) text += `FG%: ${(stats.fg_pct * 100).toFixed(1)}%\n`;
          if (stats.three_pt_pct !== undefined) text += `3PT%: ${(stats.three_pt_pct * 100).toFixed(1)}%\n`;
          if (stats.ft_pct !== undefined) text += `FT%: ${(stats.ft_pct * 100).toFixed(1)}%\n`;
          
          return res.json({
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text }] },
            id
          });
          
        } catch (err) {
          console.error('  Error:', err.message);
          return res.json({
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: `Error: ${err.message}` }] },
            id
          });
        }
      }
      
      // TOOL 4: Get Basketball Schedule
      if (name === 'get_basketball_schedule') {
        const url = `https://api.collegefootballdata.com/cbb/games?team=${team}&year=${year}`;
        console.log(`  Fetching: ${url}`);
        
        try {
          const response = await fetch(url, {
            headers: { Authorization: `Bearer ${CFBD_BASKETBALL_KEY}` },
            signal: AbortSignal.timeout(10000)
          });
          
          if (!response.ok) {
            return res.json({
              jsonrpc: '2.0',
              result: { content: [{ type: 'text', text: `CFBD API error: ${response.status}` }] },
              id
            });
          }
          
          const data = await response.json();
          
          if (!data || data.length === 0) {
            return res.json({
              jsonrpc: '2.0',
              result: { content: [{ type: 'text', text: `No schedule found for ${team.toUpperCase()} basketball in ${year}` }] },
              id
            });
          }
          
          let text = `🏀 ${team.toUpperCase()} BASKETBALL SCHEDULE - ${year}\n\n`;
          
          data.forEach((game, idx) => {
            const isHome = game.home_team?.toLowerCase() === team;
            const opponent = isHome ? game.away_team : game.home_team;
            const location = isHome ? 'vs' : '@';
            
            text += `${idx + 1}. ${location} ${opponent}`;
            if (game.status === 'completed') {
              const teamScore = isHome ? game.home_score : game.away_score;
              const oppScore = isHome ? game.away_score : game.home_score;
              const result = teamScore > oppScore ? 'W' : 'L';
              text += ` - ${result} ${teamScore}-${oppScore}`;
            }
            text += `\n`;
          });
          
          return res.json({
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text }] },
            id
          });
          
        } catch (err) {
          console.error('  Error:', err.message);
          return res.json({
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: `Error: ${err.message}` }] },
            id
          });
        }
      }
      
      // TOOL 5: Get Basketball Rankings
      if (name === 'get_basketball_rankings') {
        const url = `https://api.collegefootballdata.com/cbb/rankings?team=${team}&year=${year}`;
        console.log(`  Fetching: ${url}`);
        
        try {
          const response = await fetch(url, {
            headers: { Authorization: `Bearer ${CFBD_BASKETBALL_KEY}` },
            signal: AbortSignal.timeout(10000)
          });
          
          if (!response.ok) {
            return res.json({
              jsonrpc: '2.0',
              result: { content: [{ type: 'text', text: `CFBD API error: ${response.status}` }] },
              id
            });
          }
          
          const data = await response.json();
          
          if (!data || data.length === 0) {
            return res.json({
              jsonrpc: '2.0',
              result: { 
                content: [{ 
                  type: 'text', 
                  text: `${team.toUpperCase()} was not ranked at any point during the ${year} basketball season.` 
                }] 
              },
              id
            });
          }
          
          // Get most recent ranking
          const latestRanking = data[data.length - 1];
          
          let text = `🏀 ${team.toUpperCase()} BASKETBALL RANKINGS - ${year}\n\n`;
          
          let foundRankings = false;
          
          if (latestRanking.polls && latestRanking.polls.length > 0) {
            latestRanking.polls.forEach(poll => {
              const teamRank = poll.ranks?.find(r => r.school?.toLowerCase() === team);
              if (teamRank) {
                foundRankings = true;
                text += `${poll.poll}: #${teamRank.rank}\n`;
              }
            });
          }
          
          if (!foundRankings) {
            text = `🏀 ${team.toUpperCase()} - ${year} BASKETBALL SEASON\n\n`;
            text += `${team.toUpperCase()} was not ranked in the most recent ${year} basketball polls.`;
          }
          
          return res.json({
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text }] },
            id
          });
          
        } catch (err) {
          console.error('  Error:', err.message);
          return res.json({
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: `Error: ${err.message}` }] },
            id
          });
        }
      }
      
      // TOOL 6: Get Basketball Shooting Stats
      if (name === 'get_basketball_shooting_stats') {
        const url = `https://api.collegefootballdata.com/cbb/stats/player/shooting/season?team=${team}&year=${year}`;
        console.log(`  Fetching: ${url}`);
        
        try {
          const response = await fetch(url, {
            headers: { Authorization: `Bearer ${CFBD_BASKETBALL_KEY}` },
            signal: AbortSignal.timeout(10000)
          });
          
          if (!response.ok) {
            return res.json({
              jsonrpc: '2.0',
              result: { content: [{ type: 'text', text: `CFBD API error: ${response.status}` }] },
              id
            });
          }
          
          const data = await response.json();
          
          if (!data || data.length === 0) {
            return res.json({
              jsonrpc: '2.0',
              result: { content: [{ type: 'text', text: `No shooting stats found for ${team.toUpperCase()} basketball in ${year}` }] },
              id
            });
          }
          
          // Extract player name if provided
          let playerName = null;
          if (args.query) {
            const nameMatch = args.query.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z']+)+)\b/);
            if (nameMatch) {
              playerName = nameMatch[1].trim();
            }
          }
          
          let text = `🏀 ${team.toUpperCase()} SHOOTING STATS - ${year}\n\n`;
          
          if (playerName) {
            const player = data.find(p => 
              p.player?.toLowerCase().includes(playerName.toLowerCase())
            );
            
            if (!player) {
              return res.json({
                jsonrpc: '2.0',
                result: { 
                  content: [{ 
                    type: 'text', 
                    text: `No shooting stats found for ${playerName} on ${team.toUpperCase()} in ${year}` 
                  }] 
                },
                id
              });
            }
            
            text = `🏀 ${player.player?.toUpperCase()} SHOOTING - ${year}\n\n`;
            if (player.fg_pct !== undefined) text += `FG%: ${(player.fg_pct * 100).toFixed(1)}%\n`;
            if (player.two_pt_pct !== undefined) text += `2PT%: ${(player.two_pt_pct * 100).toFixed(1)}%\n`;
            if (player.three_pt_pct !== undefined) text += `3PT%: ${(player.three_pt_pct * 100).toFixed(1)}%\n`;
            if (player.ft_pct !== undefined) text += `FT%: ${(player.ft_pct * 100).toFixed(1)}%\n`;
          } else {
            // Top 3PT shooters
            const top3PT = data.filter(p => p.three_pt_pct).sort((a, b) => b.three_pt_pct - a.three_pt_pct).slice(0, 5);
            
            text += `TOP 3-POINT SHOOTERS:\n`;
            top3PT.forEach((p, i) => {
              text += `${i + 1}. ${p.player}: ${(p.three_pt_pct * 100).toFixed(1)}%\n`;
            });
          }
          
          return res.json({
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text }] },
            id
          });
          
        } catch (err) {
          console.error('  Error:', err.message);
          return res.json({
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: `Error: ${err.message}` }] },
            id
          });
        }
      }
      
      // TOOL 7: Get Basketball Roster
      if (name === 'get_basketball_roster') {
        const url = `https://api.collegefootballdata.com/cbb/teams/roster?team=${team}&year=${year}`;
        console.log(`  Fetching: ${url}`);
        
        try {
          const response = await fetch(url, {
            headers: { Authorization: `Bearer ${CFBD_BASKETBALL_KEY}` },
            signal: AbortSignal.timeout(10000)
          });
          
          if (!response.ok) {
            return res.json({
              jsonrpc: '2.0',
              result: { content: [{ type: 'text', text: `CFBD API error: ${response.status}` }] },
              id
            });
          }
          
          const data = await response.json();
          
          if (!data || data.length === 0) {
            return res.json({
              jsonrpc: '2.0',
              result: { content: [{ type: 'text', text: `No roster found for ${team.toUpperCase()} basketball in ${year}` }] },
              id
            });
          }
          
          let text = `🏀 ${team.toUpperCase()} BASKETBALL ROSTER - ${year}\n\n`;
          
          data.forEach((player, idx) => {
            text += `${idx + 1}. ${player.player}`;
            if (player.position) text += ` - ${player.position}`;
            if (player.height) text += ` (${player.height})`;
            text += `\n`;
          });
          
          return res.json({
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text }] },
            id
          });
          
        } catch (err) {
          console.error('  Error:', err.message);
          return res.json({
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: `Error: ${err.message}` }] },
            id
          });
        }
      }
      
      // Unknown tool
      return res.json({
        jsonrpc: '2.0',
        error: { code: -32601, message: `Unknown tool: ${name}` },
        id
      });
    }
    
    // Unknown method
    return res.json({
      jsonrpc: '2.0',
      error: { code: -32601, message: `Unknown method: ${method}` },
      id
    });
    
  } catch (error) {
    console.error('MCP error:', error);
    return res.status(500).json({
      jsonrpc: '2.0',
      error: { code: -32603, message: error.message },
      id: req.body?.id
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🏀 CFBD Basketball MCP Server running on port ${PORT}`);
  console.log(`📊 Tools available: 7`);
  console.log(`CFBD Basketball Key: ${CFBD_BASKETBALL_KEY ? 'SET ✓' : 'MISSING ✗'}`);
  console.log(`MCP Key: ${MCP_API_KEY ? 'SET ✓' : 'NONE'}\n`);
});

// Keep alive
setInterval(() => {
  fetch(`http://localhost:${PORT}/health`).catch(() => {});
  console.log(`💓 Alive: ${Math.floor(process.uptime())}s`);
}, 30000);
