import React, { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [matchDetails, setMatchDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const API_KEY =
    "36bea08546e20a5c858b6239f3dc5c55c9900b890ac6d0482f1cb802bd9ea9ae";

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const allMatches = [];

      // Get matches for next 7 days
      for (let day = 0; day < 7; day++) {
        const date = new Date();
        date.setDate(date.getDate() + day);
        const dateString = date.toISOString().split("T")[0];

        const response = await fetch(
          `/todays-matches?key=${API_KEY}&date=${dateString}`
        );

        if (response.ok) {
          const data = await response.json();
          if (data.data) {
            allMatches.push(...data.data);
          }
        }
      }

      setMatches(allMatches);
    } catch (err) {
      setError("Failed to fetch matches");
    } finally {
      setLoading(false);
    }
  };

  // Fetch players for both teams using club_team_id filter
  const fetchMatchDetails = async (match) => {
    try {
      setLoadingDetails(true);
      setSelectedMatch(match);

      const leagueId = match.league_id || match.competition_id;
      let homePlayersWithStats = [];
      let awayPlayersWithStats = [];

      if (leagueId) {
        // Fetch league players
        const leaguePlayersResponse = await fetch(
          `/league-players?key=${API_KEY}&league_id=${leagueId}`
        );
        const leaguePlayersData = leaguePlayersResponse.ok
          ? await leaguePlayersResponse.json()
          : null;

        if (leaguePlayersData?.data) {
          // Filter players by club_team_id or team_id
          const homePlayers = leaguePlayersData.data.filter(
            (player) =>
              (player.club_team_id &&
                player.club_team_id.toString() === match.home_id.toString()) ||
              (player.team_id &&
                player.team_id.toString() === match.home_id.toString())
          );
          const awayPlayers = leaguePlayersData.data.filter(
            (player) =>
              (player.club_team_id &&
                player.club_team_id.toString() === match.away_id.toString()) ||
              (player.team_id &&
                player.team_id.toString() === match.away_id.toString())
          );

          // Fetch individual player stats for home team
          for (let i = 0; i < Math.min(homePlayers.length, 20); i++) {
            const player = homePlayers[i];
            try {
              const playerStatsResponse = await fetch(
                `/player-individual?key=${API_KEY}&player_id=${player.player_id}`
              );
              if (playerStatsResponse.ok) {
                const playerStatsData = await playerStatsResponse.json();
                const stats = playerStatsData?.data;
                const cardsPerGame = calculateCardsPerGame(stats);

                homePlayersWithStats.push({
                  ...player,
                  player_name: player.player_name || player.name || "Unknown",
                  stats: {
                    cards_per_90: cardsPerGame,
                    yellow_cards: stats?.yellow_cards || 0,
                    red_cards: stats?.red_cards || 0,
                    games_played: stats?.appearances || stats?.games || 0,
                    minutes_played: stats?.minutes_played || 0,
                    goals: stats?.goals || 0,
                    assists: stats?.assists || 0,
                  },
                });
              } else {
                homePlayersWithStats.push(player);
              }
            } catch (err) {
              console.error(
                `Error fetching stats for player ${player.player_id}:`,
                err
              );
              homePlayersWithStats.push(player);
            }
          }

          // Fetch individual player stats for away team
          for (let i = 0; i < Math.min(awayPlayers.length, 20); i++) {
            const player = awayPlayers[i];
            try {
              const playerStatsResponse = await fetch(
                `/player-individual?key=${API_KEY}&player_id=${player.player_id}`
              );
              if (playerStatsResponse.ok) {
                const playerStatsData = await playerStatsResponse.json();
                const stats = playerStatsData?.data;
                const cardsPerGame = calculateCardsPerGame(stats);

                awayPlayersWithStats.push({
                  ...player,
                  player_name: player.player_name || player.name || "Unknown",
                  stats: {
                    cards_per_90: cardsPerGame,
                    yellow_cards: stats?.yellow_cards || 0,
                    red_cards: stats?.red_cards || 0,
                    games_played: stats?.appearances || stats?.games || 0,
                    minutes_played: stats?.minutes_played || 0,
                    goals: stats?.goals || 0,
                    assists: stats?.assists || 0,
                  },
                });
              } else {
                awayPlayersWithStats.push(player);
              }
            } catch (err) {
              console.error(
                `Error fetching stats for player ${player.player_id}:`,
                err
              );
              awayPlayersWithStats.push(player);
            }
          }
        }
      }

      // Sort players by cards per 90 (highest first)
      homePlayersWithStats.sort((a, b) => {
        const aCards = parseFloat(a.stats?.cards_per_90 || 0);
        const bCards = parseFloat(b.stats?.cards_per_90 || 0);
        return bCards - aCards;
      });

      awayPlayersWithStats.sort((a, b) => {
        const aCards = parseFloat(a.stats?.cards_per_90 || 0);
        const bCards = parseFloat(b.stats?.cards_per_90 || 0);
        return bCards - aCards;
      });

      setMatchDetails({
        homePlayers: homePlayersWithStats,
        awayPlayers: awayPlayersWithStats,
        competition_id: match.competition_id,
        season_id: match.season_id,
        league_id: leagueId,
        league_name: match.league_name,
      });
    } catch (err) {
      console.error("Error fetching match details:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Calculate cards per 90 minutes
  const calculateCardsPerGame = (stats) => {
    if (!stats) return "0.00";

    const yellowCards = parseInt(stats.yellow_cards) || 0;
    const redCards = parseInt(stats.red_cards) || 0;
    const minutesPlayed = parseInt(stats.minutes_played) || 0;

    if (minutesPlayed === 0 || minutesPlayed < 90) return "0.00";

    const totalCards = yellowCards + redCards;
    const cardsPerNinety = (totalCards / minutesPlayed) * 90;

    return cardsPerNinety.toFixed(2);
  };

  // Close match details modal
  const closeMatchDetails = () => {
    setSelectedMatch(null);
    setMatchDetails(null);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="app-container">
        <div className="main-content">
          <h1 className="app-title">⚽ Football Card Predictor</h1>
          <div className="card">
            <div className="text-center">
              Loading matches from top 5 leagues...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container">
        <div className="main-content">
          <h1 className="app-title">⚽ Football Card Predictor</h1>
          <div className="card">
            <div className="text-center" style={{ color: "red" }}>
              Error: {error}
            </div>
            <button
              onClick={fetchMatches}
              style={{
                marginTop: "20px",
                padding: "10px 20px",
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                display: "block",
                margin: "20px auto",
              }}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="main-content">
        <h1 className="app-title">
          ⚽ Football Card Predictor - Top 5 Leagues
        </h1>

        {/* Match Details Modal */}
        {selectedMatch && (
          <div className="modal-overlay" onClick={closeMatchDetails}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>
                  {selectedMatch.home_name} vs {selectedMatch.away_name}
                </h2>
                <button className="close-button" onClick={closeMatchDetails}>
                  ×
                </button>
              </div>

              {loadingDetails ? (
                <div className="modal-body">
                  <p>Loading player card statistics...</p>
                </div>
              ) : matchDetails ? (
                <div className="modal-body">
                  {/* Match Info */}
                  <div className="match-info">
                    <p>
                      <strong>League:</strong> {matchDetails.league_name}
                    </p>
                    <p>
                      <strong>Date & Time:</strong>{" "}
                      {formatDate(selectedMatch.match_start)} at{" "}
                      {formatTime(selectedMatch.match_start)}
                    </p>
                    <p
                      style={{
                        color: "#666",
                        fontSize: "0.9rem",
                        marginTop: "10px",
                      }}
                    >
                      * Cards per 90: Average yellow + red cards per 90 minutes
                      based on season stats
                    </p>
                  </div>

                  {/* Teams and Players */}
                  <div className="teams-container">
                    {/* Home Team */}
                    <div className="team-section">
                      <h3>{selectedMatch.home_name}</h3>
                      <h4>Squad ({matchDetails.homePlayers.length} players)</h4>

                      <div className="players-list">
                        {matchDetails.homePlayers.length > 0 ? (
                          matchDetails.homePlayers.map((player, index) => (
                            <div
                              key={player.player_id || index}
                              className="player-card-detailed"
                            >
                              <div className="player-header">
                                <span className="player-name">
                                  {player.player_name}
                                </span>
                                <span className="player-position">
                                  {player.position}
                                </span>
                              </div>
                              <div className="player-stats">
                                <div
                                  className="stat-row highlight"
                                  style={{
                                    backgroundColor: getCardColor(
                                      player.stats?.cards_per_90
                                    ),
                                  }}
                                >
                                  <span className="stat-label">Cards/90:</span>
                                  <span className="stat-value">
                                    {player.stats?.cards_per_90 || "0.00"}
                                  </span>
                                </div>
                                <div className="stat-row">
                                  <span className="stat-label">Yellow:</span>
                                  <span className="stat-value">
                                    {player.stats?.yellow_cards}
                                  </span>
                                </div>
                                <div className="stat-row">
                                  <span className="stat-label">Red:</span>
                                  <span className="stat-value">
                                    {player.stats?.red_cards}
                                  </span>
                                </div>
                                <div className="stat-row">
                                  <span className="stat-label">Games:</span>
                                  <span className="stat-value">
                                    {player.stats?.games_played}
                                  </span>
                                </div>
                                <div className="stat-row">
                                  <span className="stat-label">Minutes:</span>
                                  <span className="stat-value">
                                    {player.stats?.minutes_played}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="no-players">
                            No player data available for this team
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Away Team */}
                    <div className="team-section">
                      <h3>{selectedMatch.away_name}</h3>
                      <h4>Squad ({matchDetails.awayPlayers.length} players)</h4>

                      <div className="players-list">
                        {matchDetails.awayPlayers.length > 0 ? (
                          matchDetails.awayPlayers.map((player, index) => (
                            <div
                              key={player.player_id || index}
                              className="player-card-detailed"
                            >
                              <div className="player-header">
                                <span className="player-name">
                                  {player.player_name}
                                </span>
                                <span className="player-position">
                                  {player.position}
                                </span>
                              </div>
                              <div className="player-stats">
                                <div
                                  className="stat-row highlight"
                                  style={{
                                    backgroundColor: getCardColor(
                                      player.stats?.cards_per_90
                                    ),
                                  }}
                                >
                                  <span className="stat-label">Cards/90:</span>
                                  <span className="stat-value">
                                    {player.stats?.cards_per_90 || "0.00"}
                                  </span>
                                </div>
                                <div className="stat-row">
                                  <span className="stat-label">Yellow:</span>
                                  <span className="stat-value">
                                    {player.stats?.yellow_cards}
                                  </span>
                                </div>
                                <div className="stat-row">
                                  <span className="stat-label">Red:</span>
                                  <span className="stat-value">
                                    {player.stats?.red_cards}
                                  </span>
                                </div>
                                <div className="stat-row">
                                  <span className="stat-label">Games:</span>
                                  <span className="stat-value">
                                    {player.stats?.games_played}
                                  </span>
                                </div>
                                <div className="stat-row">
                                  <span className="stat-label">Minutes:</span>
                                  <span className="stat-value">
                                    {player.stats?.minutes_played}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="no-players">
                            No player data available for this team
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="modal-body">
                  <p>Failed to load match details.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Matches Display */}
        <div className="card">
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: "600",
              marginBottom: "1.5rem",
            }}
          >
            Upcoming Matches - Next 7 Days ({matches.length})
          </h2>

          {matches.length === 0 ? (
            <p className="text-center" style={{ color: "#666" }}>
              No upcoming matches found in the top 5 leagues.
            </p>
          ) : (
            <div className="fixtures-grid">
              {matches.map((match, index) => (
                <div
                  key={`${match.id}-${index}`}
                  className="fixture-card clickable"
                  onClick={() => fetchMatchDetails(match)}
                >
                  <div className="fixture-league">
                    {match.league_name || "League"}
                  </div>
                  <div className="fixture-date">
                    {formatDate(match.match_start)} •{" "}
                    {formatTime(match.match_start)}
                  </div>
                  <div className="fixture-team">{match.home_name}</div>
                  <div className="fixture-vs">vs</div>
                  <div className="fixture-team">{match.away_name}</div>
                  <div className="click-hint">Click for card stats</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper function to get color based on cards per 90
function getCardColor(cardsPerNinety) {
  const value = parseFloat(cardsPerNinety || 0);
  if (value >= 0.5) return "#fee2e2"; // Red - Very high card risk
  if (value >= 0.3) return "#fed7aa"; // Orange - High card risk
  if (value >= 0.2) return "#fef3c7"; // Yellow - Medium card risk
  if (value >= 0.1) return "#d1fae5"; // Light green - Low card risk
  return "#f3f4f6"; // Gray - Very low/no card risk
}

export default App;
