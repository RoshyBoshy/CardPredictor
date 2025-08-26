import React, { useState } from "react";
import "./App.css";

function App() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [matchDetails, setMatchDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState(null);

  const API_KEY =
    "36bea08546e20a5c858b6239f3dc5c55c9900b890ac6d0482f1cb802bd9ea9ae";

  const leagues = {
    "Premier League": {
      season_24_25: 12325,
      season_25_26: 15050,
    },
    Bundesliga: {
      season_24_25: 12529,
      season_25_26: 14968,
    },
    "La Liga": {
      season_24_25: 12316,
      season_25_26: 14956,
    },
    "Ligue 1": {
      season_24_25: 12337,
      season_25_26: 14932,
    },
    "Serie A": {
      season_24_25: 12530,
      season_25_26: 15068,
    },
  };

  const fetchMatchesForLeague = async (leagueName) => {
    try {
      setLoading(true);
      setSelectedLeague(leagueName);
      setMatches([]);
      setError(null);

      const league = leagues[leagueName];
      if (!league) {
        throw new Error(`Invalid league name: ${leagueName}`);
      }

      const seasonId = league.season_25_26;
      const maxTime = Math.floor((Date.now() + 7 * 24 * 60 * 60 * 1000) / 1000);

      const response = await fetch(
        `/api/league-matches?key=${API_KEY}&season_id=${seasonId}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          const upcomingMatches = data.data.filter(
            (match) => match.date_unix <= maxTime
          );
          setMatches(upcomingMatches);
        } else {
          setMatches([]);
        }
      } else {
        throw new Error(`Failed to fetch matches for ${leagueName}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatchDetails = async (match) => {
    try {
      setLoadingDetails(true);
      setSelectedMatch(match);

      const league = leagues[selectedLeague];
      if (!league) {
        throw new Error(`Season IDs not found for league: ${selectedLeague}`);
      }

      let homePlayersMap = new Map();
      let awayPlayersMap = new Map();

      for (const seasonId of [league.season_24_25, league.season_25_26]) {
        const leaguePlayersResponse = await fetch(
          `/api/league-players?key=${API_KEY}&season_id=${seasonId}`
        );
        const leaguePlayersData = await leaguePlayersResponse.json();

        if (leaguePlayersData?.data) {
          leaguePlayersData.data.forEach((player) => {
            if (player.club_team_id?.toString() === match.homeID.toString()) {
              if (!homePlayersMap.has(player.id)) {
                homePlayersMap.set(player.id, player);
              }
            } else if (
              player.club_team_id?.toString() === match.awayID.toString()
            ) {
              if (!awayPlayersMap.has(player.id)) {
                awayPlayersMap.set(player.id, player);
              }
            }
          });
        }
      }

      const fetchPlayerStats = async (playersMap) => {
        const playersWithStats = [];
        for (const player of playersMap.values()) {
          try {
            const playerStatsResponse = await fetch(
              `/api/player-stats?key=${API_KEY}&player_id=${player.id}`
            );
            if (playerStatsResponse.ok) {
              const playerStatsData = await playerStatsResponse.json();

              // Filter the array for stats from our league's seasons
              if (
                playerStatsData?.data &&
                Array.isArray(playerStatsData.data)
              ) {
                const relevantStats = playerStatsData.data.filter(
                  (stat) =>
                    stat.competition_id === leagues.season_24_25 ||
                    stat.competition_id === leagues.season_25_26
                );

                // Get the highest cards_per_90_overall from relevant seasons
                let bestStats = relevantStats[0] || {};
                relevantStats.forEach((stat) => {
                  if (
                    parseFloat(stat.cards_per_90_overall || 0) >
                    parseFloat(bestStats.cards_per_90_overall || 0)
                  ) {
                    bestStats = stat;
                  }
                });

                playersWithStats.push({
                  ...player,
                  stats: bestStats,
                });
              } else {
                playersWithStats.push(player);
              }
            } else {
              playersWithStats.push(player);
            }
          } catch (err) {
            console.error(`Error fetching stats for player ${player.id}:`, err);
            playersWithStats.push(player);
          }
        }

        // Sort by cards per 90 (highest first)
        return playersWithStats.sort((a, b) => {
          const aCards = parseFloat(a.stats?.cards_per_90_overall || 0);
          const bCards = parseFloat(b.stats?.cards_per_90_overall || 0);
          return bCards - aCards;
        });
      };

      const homePlayersWithStats = await fetchPlayerStats(homePlayersMap);
      const awayPlayersWithStats = await fetchPlayerStats(awayPlayersMap);

      setMatchDetails({
        homePlayers: homePlayersWithStats,
        awayPlayers: awayPlayersWithStats,
        league_name: selectedLeague,
      });
    } catch (err) {
      console.error("Error fetching match details:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeMatchDetails = () => {
    setSelectedMatch(null);
    setMatchDetails(null);
  };

  const sortedMatches = matches.sort((a, b) => a.date_unix - b.date_unix);

  const formatDate = (unixTimestamp) => {
    const date = new Date(unixTimestamp * 1000);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (unixTimestamp) => {
    const date = new Date(unixTimestamp * 1000);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="app-container">
      <div className="main-content">
        <h1 className="app-title">⚽ Card Predictor</h1>

        <div className="leagues-container card">
          <h2>Select a League</h2>
          <div className="leagues-grid">
            {Object.keys(leagues).map((leagueName) => (
              <button
                key={leagueName}
                className={`league-button ${
                  selectedLeague === leagueName ? "active" : ""
                }`}
                onClick={() => fetchMatchesForLeague(leagueName)}
              >
                {leagueName}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="card">
            <div className="text-center">Loading matches...</div>
          </div>
        )}

        {error && (
          <div className="card">
            <div className="text-center" style={{ color: "red" }}>
              Error: {error}
            </div>
          </div>
        )}

        {selectedLeague && !loading && (
          <div className="card">
            <h2
              style={{
                fontSize: "1.5rem",
                fontWeight: "600",
                marginBottom: "1.5rem",
              }}
            >
              Upcoming Matches for {selectedLeague} ({sortedMatches.length})
            </h2>

            {sortedMatches.length === 0 ? (
              <p className="text-center" style={{ color: "#666" }}>
                No upcoming matches found for this league in the next 7 days.
              </p>
            ) : (
              <div className="fixtures-grid">
                {sortedMatches.map((match, index) => (
                  <div
                    key={index}
                    className="fixture-card clickable"
                    onClick={() => fetchMatchDetails(match)}
                  >
                    <div className="fixture-league">{selectedLeague}</div>
                    <div className="fixture-date">
                      {formatDate(match.date_unix)} •{" "}
                      {formatTime(match.date_unix)}
                    </div>
                    <div className="fixture-team">{match.home_name}</div>
                    <div className="fixture-vs">vs</div>
                    <div className="fixture-team">{match.away_name}</div>
                    <div className="click-hint">Click for details</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
                  <div className="match-info">
                    <p>
                      <strong>League:</strong> {matchDetails.league_name}
                    </p>
                    <p>
                      <strong>Date:</strong>{" "}
                      {formatDate(selectedMatch.date_unix)} at{" "}
                      {formatTime(selectedMatch.date_unix)}
                    </p>
                  </div>

                  <div className="teams-container">
                    <div className="team-section">
                      <h3>{selectedMatch.home_name}</h3>
                      <h4>Players</h4>
                      <div className="players-list">
                        {matchDetails.homePlayers.map((player, index) => (
                          <div key={index} className="player-card-detailed">
                            <div className="player-header">
                              <span className="player-name">
                                {player.known_as}
                              </span>
                            </div>
                            <div className="player-stats">
                              {player.stats && (
                                <>
                                  <div className="stat-row highlight">
                                    <span className="stat-label">
                                      Cards per 90:
                                    </span>
                                    <span className="stat-value">
                                      {player.stats.cards_per_90_overall ||
                                        "0.00"}
                                    </span>
                                  </div>
                                  <div className="stat-row">
                                    <span className="stat-label">
                                      Mins per Card:
                                    </span>
                                    <span className="stat-value">
                                      {player.stats.min_per_card_overall ||
                                        "N/A"}
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                        {matchDetails.homePlayers.length === 0 && (
                          <p className="no-players">No players found.</p>
                        )}
                      </div>
                    </div>

                    <div className="team-section">
                      <h3>{selectedMatch.away_name}</h3>
                      <h4>Players</h4>
                      <div className="players-list">
                        {matchDetails.awayPlayers.map((player, index) => (
                          <div key={index} className="player-card-detailed">
                            <div className="player-header">
                              <span className="player-name">
                                {player.known_as}
                              </span>
                            </div>
                            <div className="player-stats">
                              {player.stats && (
                                <>
                                  <div className="stat-row highlight">
                                    <span className="stat-label">
                                      Cards per 90:
                                    </span>
                                    <span className="stat-value">
                                      {player.stats.cards_per_90_overall ||
                                        "0.00"}
                                    </span>
                                  </div>
                                  <div className="stat-row">
                                    <span className="stat-label">
                                      Mins per Card:
                                    </span>
                                    <span className="stat-value">
                                      {player.stats.min_per_card_overall ||
                                        "N/A"}
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                        {matchDetails.awayPlayers.length === 0 && (
                          <p className="no-players">No players found.</p>
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
      </div>
    </div>
  );
}

export default App;
