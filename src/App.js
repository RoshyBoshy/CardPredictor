import React, { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [matchDetails, setMatchDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);

  const API_KEY =
    "36bea08546e20a5c858b6239f3dc5c55c9900b890ac6d0482f1cb802bd9ea9ae";

  const API_BASE_URL = "/api";

  // Competition ID to Name mapping
  const COMPETITION_MAP = {
    // England
    15050: "Premier League",
    14930: "Championship",
    15137: "League Cup",
    15238: "FA Cup",

    // Europe
    14924: "UEFA Champions League",
    15002: "UEFA Europa League",
    14904: "UEFA Europa Conference League",

    // France
    14932: "Ligue 1",

    // Germany
    14968: "Bundesliga",
    15034: "DFL Super Cup",
    15035: "DFB Pokal",

    // Italy
    15068: "Serie A",
    15037: "Coppa Italia",
    15866: "Primavera Cup",

    // Spain
    14956: "La Liga",
  };

  // Generate next 7 days
  const getNext7Days = () => {
    const days = [];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      days.push({
        date: date.toISOString().split("T")[0], // YYYY-MM-DD format
        displayDate: date.toDateString(),
        shortDate: `${date.getDate()} ${date.toLocaleString("default", {
          month: "short",
        })}`,
        dayOfWeek: date.toLocaleString("default", { weekday: "short" }),
        isToday: i === 0,
      });
    }
    return days;
  };

  const next7Days = getNext7Days();

  // Auto-load today's matches on component mount
  useEffect(() => {
    const today = next7Days[0];
    if (today) {
      fetchMatchesForDate(today.date, today.displayDate);
    }
  }, []); // Empty dependency array means this runs once on mount

  const fetchMatchesForDate = async (dateStr, displayDate) => {
    try {
      setLoading(true);
      setSelectedDate({ date: dateStr, displayDate });
      setMatches([]);
      setError(null);

      const url = `/todays-matches?key=${API_KEY}&date=${dateStr}`;
      console.log("Fetching matches for date:", dateStr);

      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        if (data.data && Array.isArray(data.data)) {
          console.log(`Found ${data.data.length} matches for ${dateStr}`);

          // Fetch competition details for each match using the match ID
          const matchesWithCompetition = await Promise.all(
            data.data.map(async (match) => {
              try {
                // Use the match.id to get full match details including competition_id
                const matchDetailUrl = `/match?key=${API_KEY}&match_id=${match.id}`;
                console.log(`Fetching details for match ${match.id}`);

                const matchResponse = await fetch(matchDetailUrl);

                if (matchResponse.ok) {
                  const matchData = await matchResponse.json();
                  console.log(`Match ${match.id} response:`, matchData);

                  // The competition_id should be in the response
                  // Try different possible locations for the competition_id
                  const competitionId =
                    matchData.competition_id ||
                    matchData.data?.competition_id ||
                    matchData.data?.[0]?.competition_id ||
                    null;

                  console.log(
                    `Match ${match.id} has competition_id: ${competitionId}`
                  );

                  const competitionName = competitionId
                    ? COMPETITION_MAP[competitionId] ||
                      `Unknown Competition (ID: ${competitionId})`
                    : "Unknown Competition";

                  // Also extract team names if available
                  const home_name =
                    matchData.home_name ||
                    matchData.data?.home_name ||
                    matchData.data?.[0]?.home_name ||
                    match.home_name ||
                    `Team ${match.homeID}`;

                  const away_name =
                    matchData.away_name ||
                    matchData.data?.away_name ||
                    matchData.data?.[0]?.away_name ||
                    match.away_name ||
                    `Team ${match.awayID}`;

                  return {
                    ...match,
                    competition_id: competitionId,
                    competition_name: competitionName,
                    home_name: home_name,
                    away_name: away_name,
                    date_unix: match.date_unix,
                  };
                } else {
                  console.error(
                    `Failed to fetch details for match ${match.id}: ${matchResponse.status}`
                  );
                  return {
                    ...match,
                    competition_name: "Unknown Competition",
                    home_name: match.home_name || `Team ${match.homeID}`,
                    away_name: match.away_name || `Team ${match.awayID}`,
                    date_unix: match.date_unix,
                  };
                }
              } catch (err) {
                console.error(`Error fetching match ${match.id} details:`, err);
                return {
                  ...match,
                  competition_name: "Unknown Competition",
                  home_name: match.home_name || `Team ${match.homeID}`,
                  away_name: match.away_name || `Team ${match.awayID}`,
                  date_unix: match.date_unix,
                };
              }
            })
          );

          console.log("All matches with competitions:", matchesWithCompetition);

          // Sort matches by time (we'll group them later)
          const sortedMatches = matchesWithCompetition.sort((a, b) => {
            return (a.date_unix || 0) - (b.date_unix || 0);
          });

          setMatches(sortedMatches);
        } else {
          setMatches([]);
        }
      } else {
        throw new Error(`Failed to fetch matches for ${displayDate}`);
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

      let homePlayersMap = new Map();
      let awayPlayersMap = new Map();

      // Try to get players from the competition/season
      try {
        const competitionId = match.competition_id;
        const leaguePlayersResponse = await fetch(
          `/league-players?key=${API_KEY}&season_id=${competitionId}`
        );

        if (leaguePlayersResponse.ok) {
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
      } catch (err) {
        console.log("Could not fetch league players:", err);
      }

      const fetchPlayerStats = async (playersMap) => {
        const playersWithStats = [];
        for (const player of playersMap.values()) {
          try {
            const playerStatsResponse = await fetch(
              `/player-stats?key=${API_KEY}&player_id=${player.id}`
            );

            if (playerStatsResponse.ok) {
              const playerStatsData = await playerStatsResponse.json();

              if (
                playerStatsData?.data &&
                Array.isArray(playerStatsData.data)
              ) {
                // Get the best stats from available seasons
                let bestStats = playerStatsData.data[0] || {};
                playerStatsData.data.forEach((stat) => {
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
        competition_name: match.competition_name || "Unknown Competition",
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

  const formatDate = (unixTimestamp) => {
    const date = new Date(unixTimestamp * 1000);
    return date.toDateString();
  };

  const formatTime = (unixTimestamp) => {
    if (!unixTimestamp) return "Time TBD";
    const date = new Date(unixTimestamp * 1000);
    return date.toLocaleTimeString();
  };

  // Group matches by competition
  const groupMatchesByCompetition = (matches) => {
    const grouped = {};
    matches.forEach((match) => {
      const competition = match.competition_name || "Unknown Competition";
      if (!grouped[competition]) {
        grouped[competition] = [];
      }
      grouped[competition].push(match);
    });

    // Sort matches within each competition by time
    Object.keys(grouped).forEach((competition) => {
      grouped[competition].sort(
        (a, b) => (a.date_unix || 0) - (b.date_unix || 0)
      );
    });

    return grouped;
  };

  const groupedMatches = groupMatchesByCompetition(matches);

  // Sort competitions by priority for display
  const competitionPriority = {
    "UEFA Champions League": 1,
    "UEFA Europa League": 2,
    "UEFA Europa Conference League": 3,
    "Premier League": 4,
    "La Liga": 5,
    "Serie A": 6,
    Bundesliga: 7,
    "Ligue 1": 8,
    Championship: 9,
    "FA Cup": 10,
    "League Cup": 11,
    "Coppa Italia": 12,
    "DFB Pokal": 13,
    "DFL Super Cup": 14,
    "Primavera Cup": 15,
  };

  const sortedCompetitions = Object.keys(groupedMatches).sort((a, b) => {
    const priorityA = competitionPriority[a] || 99;
    const priorityB = competitionPriority[b] || 99;
    return priorityA - priorityB;
  });

  return (
    <div className="app-container">
      <div className="main-content">
        <h1 className="app-title">⚽ Card Predictor</h1>

        <div className="days-container card">
          <h2>Select a Day</h2>
          <div className="days-grid">
            {next7Days.map((day, index) => (
              <button
                key={day.date}
                className={`day-button ${
                  selectedDate?.date === day.date ? "active" : ""
                } ${day.isToday ? "today" : ""}`}
                onClick={() => fetchMatchesForDate(day.date, day.displayDate)}
              >
                <div className="day-of-week">{day.dayOfWeek}</div>
                <div className="day-date">{day.shortDate}</div>
                {day.isToday && <div className="today-indicator">Today</div>}
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

        {selectedDate && !loading && (
          <div className="card">
            <h2
              style={{
                fontSize: "1.5rem",
                fontWeight: "600",
                marginBottom: "1.5rem",
              }}
            >
              Matches for {selectedDate.displayDate} ({matches.length})
            </h2>

            {matches.length === 0 ? (
              <p className="text-center" style={{ color: "#666" }}>
                No matches found for this day.
              </p>
            ) : (
              <div className="competitions-container">
                {sortedCompetitions.map((competition) => (
                  <div key={competition} className="competition-section">
                    <h3 className="competition-title">
                      {competition} ({groupedMatches[competition].length})
                    </h3>
                    <div className="fixtures-grid">
                      {groupedMatches[competition].map((match, index) => (
                        <div
                          key={`${competition}-${index}`}
                          className="fixture-card clickable"
                          onClick={() => fetchMatchDetails(match)}
                        >
                          <div className="fixture-league">{competition}</div>
                          <div className="fixture-date">
                            {formatTime(match.date_unix)}
                          </div>
                          <div className="fixture-team">
                            {match.home_name || `Team ${match.homeID}`}
                          </div>
                          <div className="fixture-vs">vs</div>
                          <div className="fixture-team">
                            {match.away_name || `Team ${match.awayID}`}
                          </div>
                          <div className="click-hint">Click for details</div>
                        </div>
                      ))}
                    </div>
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
                  {selectedMatch.home_name || `Team ${selectedMatch.homeID}`} vs{" "}
                  {selectedMatch.away_name || `Team ${selectedMatch.awayID}`}
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
                      <strong>Competition:</strong>{" "}
                      {matchDetails.competition_name}
                    </p>
                    <p>
                      <strong>Date:</strong>{" "}
                      {formatDate(selectedMatch.date_unix)} at{" "}
                      {formatTime(selectedMatch.date_unix)}
                    </p>
                  </div>

                  <div className="teams-container">
                    <div className="team-section">
                      <h3>
                        {selectedMatch.home_name ||
                          `Team ${selectedMatch.homeID}`}
                      </h3>
                      <h4>Players</h4>
                      <div className="players-list">
                        {matchDetails.homePlayers.length > 0 ? (
                          matchDetails.homePlayers.map((player, index) => (
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
                          ))
                        ) : (
                          <p className="no-players">No players found.</p>
                        )}
                      </div>
                    </div>

                    <div className="team-section">
                      <h3>
                        {selectedMatch.away_name ||
                          `Team ${selectedMatch.awayID}`}
                      </h3>
                      <h4>Players</h4>
                      <div className="players-list">
                        {matchDetails.awayPlayers.length > 0 ? (
                          matchDetails.awayPlayers.map((player, index) => (
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
                          ))
                        ) : (
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
