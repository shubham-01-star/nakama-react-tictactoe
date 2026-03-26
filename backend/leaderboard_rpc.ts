/**
 * RPC handler: Returns combined leaderboard data (wins, losses, best streak).
 * Called by the frontend via client.rpc(session, "get_leaderboard", "").
 */

interface PlayerStats {
    userId: string;
    username: string;
    wins: number;
    losses: number;
    streak: number;
}

export const getLeaderboardRpc: nkruntime.RpcFunction = function(
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    payload: string
): string {
    const limit = 20;

    // Fetch all three leaderboards
    let winsRecords: nkruntime.LeaderboardRecord[] = [];
    let lossesRecords: nkruntime.LeaderboardRecord[] = [];
    let streaksRecords: nkruntime.LeaderboardRecord[] = [];

    try {
        const winsResult = nk.leaderboardRecordsList("global_wins", undefined, limit);
        winsRecords = winsResult.records || [];
    } catch (e) { logger.warn("Failed to read global_wins: %s", e); }

    try {
        const lossesResult = nk.leaderboardRecordsList("global_losses", undefined, limit);
        lossesRecords = lossesResult.records || [];
    } catch (e) { logger.warn("Failed to read global_losses: %s", e); }

    try {
        const streaksResult = nk.leaderboardRecordsList("global_streaks", undefined, limit);
        streaksRecords = streaksResult.records || [];
    } catch (e) { logger.warn("Failed to read global_streaks: %s", e); }

    // Merge into a player map keyed by owner_id
    const playerMap: { [userId: string]: PlayerStats } = {};

    for (const r of winsRecords) {
        if (!r.ownerId) continue;
        if (!playerMap[r.ownerId]) playerMap[r.ownerId] = { userId: r.ownerId, username: r.username || "", wins: 0, losses: 0, streak: 0 };
        playerMap[r.ownerId].wins = Number(r.score) || 0;
        if (r.username) playerMap[r.ownerId].username = r.username;
    }
    for (const r of lossesRecords) {
        if (!r.ownerId) continue;
        if (!playerMap[r.ownerId]) playerMap[r.ownerId] = { userId: r.ownerId, username: r.username || "", wins: 0, losses: 0, streak: 0 };
        playerMap[r.ownerId].losses = Number(r.score) || 0;
        if (r.username) playerMap[r.ownerId].username = r.username;
    }
    for (const r of streaksRecords) {
        if (!r.ownerId) continue;
        if (!playerMap[r.ownerId]) playerMap[r.ownerId] = { userId: r.ownerId, username: r.username || "", wins: 0, losses: 0, streak: 0 };
        playerMap[r.ownerId].streak = Number(r.score) || 0;
        if (r.username) playerMap[r.ownerId].username = r.username;
    }

    // Convert to sorted array (by wins descending)
    const keys = Object.keys(playerMap);
    const players: PlayerStats[] = [];
    for (const key of keys) {
        players.push(playerMap[key]);
    }
    players.sort(function(a: PlayerStats, b: PlayerStats) { return b.wins - a.wins; });
    const result = players.slice(0, limit);

    return JSON.stringify({ players: result });
};
