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
        // Determine the mode from matched players' string properties
        let fastMode = false;
        for (const m of matches) {
            const props = (m as any).properties || {};
            if (props["mode"] === "timed") {
                fastMode = true;
                break;
            }
        }

        const matchId = nk.matchCreate("tictactoe", { fast_mode: String(fastMode) });
        return matchId;
    } catch (error) {
        logger.error("Failed to create match from matchmaker: %s", error);
        throw error;
    }
};
