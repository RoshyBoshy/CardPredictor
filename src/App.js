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

  // Fetch team details and players
  const fetchMatchDetails = async (match) => {
    try {
      setLoadingDetails(true);
      setSelectedMatch(match);

      // Fetch home team details
      const homeTeamResponse = await fetch(
        `/team?key=${API_KEY}&team_id=${match.home_id}`
      );
      const homeTeamData = homeTeamResponse.ok
        ? await homeTeamResponse.json()
        : null;

      // Fetch away team details
      const awayTeamResponse = await fetch(
        `/team?key=${API_KEY}&team_id=${match.away_id}`
      );
      const awayTeamData = awayTeamResponse.ok
        ? await awayTeamResponse.json()
        : null;

      // Get league/competition ID for player fetching
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
          // Filter players by team
          const homePlayers = leaguePlayersData.data.filter(
            (player) =>
              player.team_id &&
              player.team_id.toString() === match.home_id.toString()
          );
          const awayPlayers = leaguePlayersData.data.filter(
            (player) =>
              player.team_id &&
              player.team_id.toString() === match.away_id.toString()
          );

          // Fetch individual player stats for home team (limit to first 15 for performance)
          for (let i = 0; i < Math.min(homePlayers.length, 15); i++) {
            const player = homePlayers[i];
            try {
              const playerStatsResponse = await fetch(
                `/player-individual?key=${API_KEY}&player_id=${player.player_id}`
              );
              if (playerStatsResponse.ok) {
                const playerStatsData = await playerStatsResponse.json();
                homePlayersWithStats.push({
                  ...player,
                  stats: playerStatsData?.data,
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

          // Fetch individual player stats for away team (limit to first 15 for performance)
          for (let i = 0; i < Math.min(awayPlayers.length, 15); i++) {
            const player = awayPlayers[i];
            try {
              const playerStatsResponse = await fetch(
                `/player-individual?key=${API_KEY}&player_id=${player.player_id}`
              );
              if (playerStatsResponse.ok) {
                const playerStatsData = await playerStatsResponse.json();
                awayPlayersWithStats.push({
                  ...player,
                  stats: playerStatsData?.data,
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

      setMatchDetails({
        homeTeam: homeTeamData?.data,
        awayTeam: awayTeamData?.data,
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

  // Close match details
  const closeMatchDetails = () => {
    setSelectedMatch(null);
    setMatchDetails(null);
  };

  // Sort all matches by date
  const sortedMatches = matches.sort(
    (a, b) => new Date(a.match_start) - new Date(b.match_start)
  );

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="app-container">
        <div className="main-content">
          <h1 className="app-title">⚽ Football Matches</h1>
          <div className="card">
            <div className="text-center">Loading matches...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container">
        <div className="main-content">
          <h1 className="app-title">⚽ Football Matches</h1>
          <div className="card">
            <div className="text-center" style={{ color: "red" }}>
              Error: {error}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="main-content">
        <h1 className="app-title">⚽ All Football Matches - Next 7 Days</h1>

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
                  <p>Loading match details...</p>
                </div>
              ) : matchDetails ? (
                <div className="modal-body">
                  {/* Match Info */}
                  <div className="match-info">
                    <p>
                      <strong>League:</strong> {matchDetails.league_name}
                    </p>
                    <p>
                      <strong>League ID:</strong> {matchDetails.league_id}
                    </p>
                    <p>
                      <strong>Competition ID:</strong>{" "}
                      {matchDetails.competition_id}
                    </p>
                    <p>
                      <strong>Season ID:</strong> {matchDetails.season_id}
                    </p>
                    <p>
                      <strong>Date:</strong>{" "}
                      {formatDate(selectedMatch.match_start)} at{" "}
                      {formatTime(selectedMatch.match_start)}
                    </p>
                  </div>

                  {/* Teams and Players */}
                  <div className="teams-container">
                    {/* Home Team */}
                    <div className="team-section">
                      <h3>{selectedMatch.home_name}</h3>
                      {matchDetails.homeTeam && (
                        <div className="team-details">
                          <p>
                            <strong>Team ID:</strong> {selectedMatch.home_id}
                          </p>
                          <p>
                            <strong>Founded:</strong>{" "}
                            {matchDetails.homeTeam.founded || "N/A"}
                          </p>
                          <p>
                            <strong>Stadium:</strong>{" "}
                            {matchDetails.homeTeam.venue_name || "N/A"}
                          </p>
                        </div>
                      )}

                      <h4>Players ({matchDetails.homePlayers.length})</h4>
                      <div className="players-list">
                        {matchDetails.homePlayers.map((player, index) => (
                          <div key={index} className="player-card-detailed">
                            <div className="player-header">
                              <span className="player-name">
                                {player.player_name}
                              </span>
                              <span className="player-position">
                                {player.position}
                              </span>
                            </div>
                            <div className="player-stats">
                              <div className="stat-row">
                                <span className="stat-label">Age:</span>
                                <span className="stat-value">
                                  {player.age || "N/A"}
                                </span>
                              </div>
                              <div className="stat-row">
                                <span className="stat-label">Nationality:</span>
                                <span className="stat-value">
                                  {player.nationality || "N/A"}
                                </span>
                              </div>
                              {player.stats && (
                                <>
                                  <div className="stat-row highlight">
                                    <span className="stat-label">
                                      Cards per 90:
                                    </span>
                                    <span className="stat-value">
                                      {player.stats.cards_per_90 || "0.00"}
                                    </span>
                                  </div>
                                  <div className="stat-row">
                                    <span className="stat-label">Goals:</span>
                                    <span className="stat-value">
                                      {player.stats.goals || "0"}
                                    </span>
                                  </div>
                                  <div className="stat-row">
                                    <span className="stat-label">Assists:</span>
                                    <span className="stat-value">
                                      {player.stats.assists || "0"}
                                    </span>
                                  </div>
                                  <div className="stat-row">
                                    <span className="stat-label">Minutes:</span>
                                    <span className="stat-value">
                                      {player.stats.minutes_played || "0"}
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                        {matchDetails.homePlayers.length === 0 && (
                          <p className="no-players">
                            No players found for this team in this league.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Away Team */}
                    <div className="team-section">
                      <h3>{selectedMatch.away_name}</h3>
                      {matchDetails.awayTeam && (
                        <div className="team-details">
                          <p>
                            <strong>Team ID:</strong> {selectedMatch.away_id}
                          </p>
                          <p>
                            <strong>Founded:</strong>{" "}
                            {matchDetails.awayTeam.founded || "N/A"}
                          </p>
                          <p>
                            <strong>Stadium:</strong>{" "}
                            {matchDetails.awayTeam.venue_name || "N/A"}
                          </p>
                        </div>
                      )}

                      <h4>Players ({matchDetails.awayPlayers.length})</h4>
                      <div className="players-list">
                        {matchDetails.awayPlayers.map((player, index) => (
                          <div key={index} className="player-card-detailed">
                            <div className="player-header">
                              <span className="player-name">
                                {player.player_name}
                              </span>
                              <span className="player-position">
                                {player.position}
                              </span>
                            </div>
                            <div className="player-stats">
                              <div className="stat-row">
                                <span className="stat-label">Age:</span>
                                <span className="stat-value">
                                  {player.age || "N/A"}
                                </span>
                              </div>
                              <div className="stat-row">
                                <span className="stat-label">Nationality:</span>
                                <span className="stat-value">
                                  {player.nationality || "N/A"}
                                </span>
                              </div>
                              {player.stats && (
                                <>
                                  <div className="stat-row highlight">
                                    <span className="stat-label">
                                      Cards per 90:
                                    </span>
                                    <span className="stat-value">
                                      {player.stats.cards_per_90 || "0.00"}
                                    </span>
                                  </div>
                                  <div className="stat-row">
                                    <span className="stat-label">Goals:</span>
                                    <span className="stat-value">
                                      {player.stats.goals || "0"}
                                    </span>
                                  </div>
                                  <div className="stat-row">
                                    <span className="stat-label">Assists:</span>
                                    <span className="stat-value">
                                      {player.stats.assists || "0"}
                                    </span>
                                  </div>
                                  <div className="stat-row">
                                    <span className="stat-label">Minutes:</span>
                                    <span className="stat-value">
                                      {player.stats.minutes_played || "0"}
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                        {matchDetails.awayPlayers.length === 0 && (
                          <p className="no-players">
                            No players found for this team in this league.
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
            All Matches ({sortedMatches.length})
          </h2>

          {sortedMatches.length === 0 ? (
            <p className="text-center" style={{ color: "#666" }}>
              No upcoming matches found.
            </p>
          ) : (
            <div className="fixtures-grid">
              {sortedMatches.map((match, index) => (
                <div
                  key={index}
                  className="fixture-card clickable"
                  onClick={() => fetchMatchDetails(match)}
                >
                  <div className="fixture-league">
                    {match.league_name || "Unknown League"}
                  </div>
                  <div className="fixture-date">
                    {formatDate(match.match_start)} •{" "}
                    {formatTime(match.match_start)}
                  </div>
                  <div className="fixture-team">
                    {match.home_name} (ID: {match.home_id})
                  </div>
                  <div className="fixture-vs">vs</div>
                  <div className="fixture-team">
                    {match.away_name} (ID: {match.away_id})
                  </div>
                  <div className="click-hint">Click for details</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
