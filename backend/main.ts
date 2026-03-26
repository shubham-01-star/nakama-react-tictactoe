import { matchmakerMatched } from './matchmaker';
import { 
    matchInit, matchJoinAttempt, matchJoin, 
    matchLeave, matchLoop, matchTerminate, matchSignal 
} from './match_handler';

let InitModule: nkruntime.InitModule = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, initializer: nkruntime.Initializer) {
    logger.info("Tic-Tac-Toe module loaded!");

    // Create global_wins leaderboard if it doesn't exist
    try {
        nk.leaderboardCreate("global_wins", false, nkruntime.SortOrder.DESCENDING, nkruntime.Operator.INCREMENTAL);
    } catch (e) {
        logger.error("Error creating leaderboard: %s", e);
    }

    // Register Matchmaker Matched hook
    initializer.registerMatchmakerMatched(matchmakerMatched);

    // Register our Tic-Tac-Toe Match Handler
    initializer.registerMatch("tictactoe", {
        matchInit,
        matchJoinAttempt,
        matchJoin,
        matchLeave,
        matchLoop,
        matchTerminate,
        matchSignal
    });
};

// Reference InitModule to avoid it getting removed on build
!InitModule && InitModule.bind(null);
