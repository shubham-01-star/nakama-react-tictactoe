import { matchmakerMatched } from './matchmaker';
import { 
    matchInit, matchJoinAttempt, matchJoin, 
    matchLeave, matchLoop, matchTerminate, matchSignal 
} from './match_handler';
import { getLeaderboardRpc } from './leaderboard_rpc';

let InitModule: nkruntime.InitModule = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, initializer: nkruntime.Initializer) {
    logger.info("Tic-Tac-Toe module loaded!");

    // Create leaderboards (idempotent — Nakama ignores if already exists)
    try {
        nk.leaderboardCreate("global_wins", false, nkruntime.SortOrder.DESCENDING, nkruntime.Operator.INCREMENTAL);
        nk.leaderboardCreate("global_losses", false, nkruntime.SortOrder.DESCENDING, nkruntime.Operator.INCREMENTAL);
        nk.leaderboardCreate("global_streaks", false, nkruntime.SortOrder.DESCENDING, nkruntime.Operator.SET);
    } catch (e) {
        logger.error("Error creating leaderboards: %s", e);
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

    // Register RPC for leaderboard queries
    initializer.registerRpc("get_leaderboard", getLeaderboardRpc);
};

// Reference InitModule to avoid it getting removed on build
// @ts-ignore
!InitModule && InitModule.bind(null);
