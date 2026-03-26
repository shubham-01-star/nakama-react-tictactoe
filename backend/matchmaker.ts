/**
 * Intercepts the matchmaker when two players are matched.
 * We automatically create a new authoritative Tic-Tac-Toe match on the server,
 * and return its ID so the players are joined directly into the game.
 */
export const matchmakerMatched: nkruntime.MatchmakerMatchedFunction = function(
    context: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    matches: nkruntime.MatchmakerResult[]
): string {
    logger.info("Matchmaker matched users! Creating Tic-Tac-Toe match...");
    
    try {
        // We create a match registered as "tictactoe" module.
        // We can pass fast_mode boolean if we want to differentiate timed vs standard in future.
        const matchId = nk.matchCreate("tictactoe", { fast_mode: false });
        // Return the match ID to automatically instruct the clients to join this match
        return matchId;
    } catch (error) {
        logger.error("Failed to create match from matchmaker: %s", error);
        throw error;
    }
};
