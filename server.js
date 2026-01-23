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
        const url = `https://api.collegebasketballdata.com/games?team=${team}&season=${year}`;
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
          
          console.log(`  DEBUG - Games data length:`, data?.length);
          if (data && data.length > 0) {
            console.log(`  DEBUG - Last game in array:`, JSON.stringify(data[data.length - 1], null, 2).substring(0, 400));
          }
          
          if (!data || data.length === 0) {
            return res.json({
              jsonrpc: '2.0',
              result: { content: [{ type: 'text', text: `No basketball games found for ${team.toUpperCase()} in ${year}` }] },
              id
            });
          }
          
          // Filter to requested season first
          const seasonGames = data.filter(g => g.season === year);
          
          if (seasonGames.length === 0) {
            return res.json({
              jsonrpc: '2.0',
              result: { content: [{ type: 'text', text: `No basketball games found for ${team.toUpperCase()} in the ${year-1}-${year} season` }] },
              id
            });
          }
          
          // Get most recent COMPLETED game
          const completedGames = seasonGames.filter(g => g.status === 'final' && g.homePoints != null && g.awayPoints != null);
          
          if (completedGames.length === 0) {
            return res.json({
              jsonrpc: '2.0',
              result: { content: [{ type: 'text', text: `No completed games found for ${team.toUpperCase()} in the ${year-1}-${year} season yet.` }] },
              id
            });
          }
          
          // Sort by date and get most recent
          const recentGame = completedGames.sort((a, b) => new Date(b.startDate) - new Date(a.startDate))[0];
          
          let text = `🏀 ${team.toUpperCase()} BASKETBALL - Most Recent Game\n\n`;
          
          const isHome = recentGame.homeTeam?.toLowerCase() === team;
          const opponent = isHome ? recentGame.awayTeam : recentGame.homeTeam;
          const teamScore = isHome ? recentGame.homePoints : recentGame.awayPoints;
          const oppScore = isHome ? recentGame.awayPoints : recentGame.homePoints;
          const result = teamScore > oppScore ? 'W' : 'L';
          
          text += `${result} vs ${opponent}\n`;
          text += `Final: ${teamScore}-${oppScore}\n`;
          if (recentGame.status === 'final') {
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
        const url = `https://api.collegebasketballdata.com/stats/player/season?team=${team}&season=${year}`;
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
              result: { content: [{ type: 'text', text: `No player stats found for ${team.toUpperCase()} basketball in the ${year-1}-${year} season` }] },
              id
            });
          }
          
          // Filter to requested season
          const seasonData = data.filter(p => p.season === year);
          
          if (seasonData.length === 0) {
            return res.json({
              jsonrpc: '2.0',
              result: { 
                content: [{ 
                  type: 'text', 
                  text: `No player stats found for ${team.toUpperCase()} basketball in the ${year-1}-${year} season.\n\nThe current season is 2025-2026 (year=${new Date().getFullYear()}). Try asking for that year!` 
                }] 
              },
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
          let filteredData = seasonData;
          if (playerName) {
            filteredData = seasonData.filter(p => 
              p.name?.toLowerCase().includes(playerName.toLowerCase()) ||
              playerName.toLowerCase().includes(p.name?.toLowerCase())
            );
            
            if (filteredData.length === 0) {
              return res.json({
                jsonrpc: '2.0',
                result: { 
                  content: [{ 
                    type: 'text', 
                    text: `${playerName} is not listed in ${team.toUpperCase()}'s ${year-1}-${year} basketball roster.\n\nThis player may:\n• Play for a different team\n• Not have recorded stats this season\n• Have a different spelling of their name` 
                  }] 
                },
                id
              });
            }
          }
          
          let text = '';
          
          // If specific player, show detailed stats
          if (playerName && filteredData.length >= 1) {
            const player = filteredData[0];
            const games = player.games || 1;
            
            text = `🏀 ${player.name?.toUpperCase() || 'PLAYER'} - ${year-1}-${year}\n\n`;
            
            text += `Games: ${player.games}\n`;
            if (player.points) text += `Points Per Game: ${(player.points / games).toFixed(1)}\n`;
            if (player.rebounds) text += `Rebounds Per Game: ${(player.rebounds.total / games).toFixed(1)}\n`;
            if (player.assists) text += `Assists Per Game: ${(player.assists / games).toFixed(1)}\n`;
            if (player.fieldGoals?.pct) text += `FG%: ${player.fieldGoals.pct.toFixed(1)}%\n`;
            if (player.threePointFieldGoals?.pct) text += `3PT%: ${player.threePointFieldGoals.pct.toFixed(1)}%\n`;
            if (player.freeThrows?.pct) text += `FT%: ${player.freeThrows.pct.toFixed(1)}%\n`;
          } else {
            // Show top scorers
            text = `🏀 ${team.toUpperCase()} BASKETBALL LEADERS - ${year-1}-${year}\n\n`;
            
            const topScorers = filteredData
              .filter(p => p.games > 0)
              .sort((a, b) => (b.points / b.games) - (a.points / a.games))
              .slice(0, 5);
            
            text += `TOP SCORERS:\n`;
            topScorers.forEach((p, i) => {
              text += `${i + 1}. ${p.name}: ${(p.points / p.games).toFixed(1)} PPG\n`;
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
        const url = `https://api.collegebasketballdata.com/stats/team/season?team=${team}&season=${year}`;
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
          
          // Filter to only the requested year
          const filteredData = data.filter(d => d.season === year);
          
          if (filteredData.length === 0) {
            return res.json({
              jsonrpc: '2.0',
              result: { 
                content: [{ 
                  type: 'text', 
                  text: `No team stats found for ${team.toUpperCase()} basketball in the ${year-1}-${year} season.\n\nThe current season is 2025-2026 (year=${new Date().getFullYear()}). Try that year!` 
                }] 
              },
              id
            });
          }
          
          const teamData = filteredData[0];
          const stats = teamData.teamStats;
          
          let text = `🏀 ${team.toUpperCase()} BASKETBALL TEAM STATS - ${year-1}-${year} Season\n\n`;
          
          if (teamData.games) text += `Games Played: ${teamData.games}\n`;
          if (teamData.wins !== undefined && teamData.losses !== undefined) {
            text += `Record: ${teamData.wins}-${teamData.losses}\n\n`;
          }
          
          // Field goals
          if (stats.fieldGoals) {
            if (stats.fieldGoals.pct !== null) {
              text += `Field Goal %: ${(stats.fieldGoals.pct * 100).toFixed(1)}%\n`;
            }
          }
          
          // Three pointers
          if (stats.threePointFieldGoals) {
            if (stats.threePointFieldGoals.pct !== null) {
              text += `Three Point %: ${(stats.threePointFieldGoals.pct * 100).toFixed(1)}%\n`;
            }
          }
          
          // Free throws
          if (stats.freeThrows) {
            if (stats.freeThrows.pct !== null) {
              text += `Free Throw %: ${(stats.freeThrows.pct * 100).toFixed(1)}%\n`;
            }
          }
          
          // Other stats - calculate per-game averages
          const games = teamData.games || 1; // Prevent division by zero
          
          if (stats.assists) text += `Assists Per Game: ${(stats.assists / games).toFixed(1)}\n`;
          if (stats.rebounds) text += `Rebounds Per Game: ${(stats.rebounds / games).toFixed(1)}\n`;
          if (stats.steals) text += `Steals Per Game: ${(stats.steals / games).toFixed(1)}\n`;
          if (stats.blocks) text += `Blocks Per Game: ${(stats.blocks / games).toFixed(1)}\n`;
          if (stats.turnovers) text += `Turnovers Per Game: ${(stats.turnovers / games).toFixed(1)}\n`;
          
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
        const url = `https://api.collegebasketballdata.com/games?team=${team}&season=${year}`;
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
          
          // Filter to only games from requested year
          const filteredGames = data.filter(game => game.season === year);
          
          if (filteredGames.length === 0) {
            return res.json({
              jsonrpc: '2.0',
              result: { 
                content: [{ 
                  type: 'text', 
                  text: `No basketball games found for ${team.toUpperCase()} in the ${year-1}-${year} season.\n\nThe current season is 2025-2026 (year=${new Date().getFullYear()}). Try asking for that year!` 
                }] 
              },
              id
            });
          }
          
          let text = `🏀 ${team.toUpperCase()} BASKETBALL SCHEDULE - ${year-1}-${year} Season\n\n`;
          
          filteredGames.forEach((game, idx) => {
            const homeTeam = game.homeTeam;
            const awayTeam = game.awayTeam;
            const isHome = homeTeam?.toLowerCase() === team;
            const opponent = isHome ? awayTeam : homeTeam;
            const location = isHome ? 'vs' : '@';
            
            text += `${idx + 1}. ${location} ${opponent}`;
            
            if (game.status === 'final') {
              const homePoints = game.homePoints;
              const awayPoints = game.awayPoints;
              const teamScore = isHome ? homePoints : awayPoints;
              const oppScore = isHome ? awayPoints : homePoints;
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
        const url = `https://api.collegebasketballdata.com/rankings?team=${team}&season=${year}`;
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
        const url = `https://api.collegebasketballdata.com/stats/player/shooting/season?team=${team}&season=${year}`;
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
          
          console.log(`  DEBUG - Shooting stats data length:`, data?.length);
          if (data && data.length > 0) {
            console.log(`  DEBUG - First shooting entry:`, JSON.stringify(data[0], null, 2).substring(0, 500));
          }
          
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
        const url = `https://api.collegebasketballdata.com/teams/roster?team=${team}&season=${year}`;
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
          
          // Roster returns array with one object containing players array
          if (!data || data.length === 0 || !data[0] || !data[0].players || data[0].players.length === 0) {
            return res.json({
              jsonrpc: '2.0',
              result: { content: [{ type: 'text', text: `No roster found for ${team.toUpperCase()} basketball in the ${year-1}-${year} season` }] },
              id
            });
          }
          
          const rosterData = data[0];
          
          // Filter to requested season
          if (rosterData.season !== year) {
            return res.json({
              jsonrpc: '2.0',
              result: { 
                content: [{ 
                  type: 'text', 
                  text: `No roster found for ${team.toUpperCase()} basketball in the ${year-1}-${year} season.\n\nThe current season is 2025-2026 (year=${new Date().getFullYear()}). Try that year!` 
                }] 
              },
              id
            });
          }
          
          let text = `🏀 ${team.toUpperCase()} BASKETBALL ROSTER - ${year-1}-${year}\n\n`;
          
          rosterData.players.forEach((player, idx) => {
            text += `${idx + 1}. ${player.name}`;
            if (player.position) text += ` - ${player.position}`;
            if (player.jersey) text += ` (#${player.jersey})`;
            if (player.height) text += ` - ${player.height}`;
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





