interface Player {
    presence: nkruntime.Presence;
    mark: number; // 1 (X) or 2 (O)
}

interface MatchState {
    board: number[];
    players: {[sessionId: string]: Player};
    turn: number;
    deadline: number;
    playing: boolean;
    winner: number;
    fastMode: boolean; // true = timed (30s), false = classic (no timer)
}

const OP_MOVE = 1;
const OP_STATE = 2; // general state update

function checkWin(board: number[]): number {
    const winLines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    for (const line of winLines) {
        if (board[line[0]] !== 0 && board[line[0]] === board[line[1]] && board[line[1]] === board[line[2]]) {
            return board[line[0]];
        }
    }
    if (board.indexOf(0) === -1) return 3; // Draw
    return 0; // Playing
}

function broadcastState(dispatcher: nkruntime.MatchDispatcher, state: MatchState) {
    const payload = {
        board: state.board,
        turn: state.turn,
        deadline: state.deadline,
        winner: state.winner,
        marks: {} as {[sessionId: string]: number}
    };
    for (const sessionId in state.players) {
        payload.marks[sessionId] = state.players[sessionId].mark;
    }
    dispatcher.broadcastMessage(OP_STATE, JSON.stringify(payload));
}

function getTime(): number {
    return Math.floor(Date.now() / 1000); // Unix timestamp in seconds
}

export const matchInit: nkruntime.MatchInitFunction = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, params: {[joinMessage: string]: string}) {
    const fastMode = params.fast_mode === "true";
    const state: MatchState = {
        board: [0,0,0, 0,0,0, 0,0,0],
        players: {},
        turn: 1,
        deadline: 0,
        playing: false,
        winner: 0,
        fastMode: fastMode
    };
    return { state, tickRate: 1, label: fastMode ? "tictactoe_timed" : "tictactoe_classic" };
};

export const matchJoinAttempt: nkruntime.MatchJoinAttemptFunction = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, presence: nkruntime.Presence, metadata: {[key: string]: any}) {
    const s = state as MatchState;
    if (Object.keys(s.players).length >= 2) {
        return { state: s, accept: false, rejectReason: "Match is full" };
    }
    return { state: s, accept: true };
};

export const matchJoin: nkruntime.MatchJoinFunction = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, presences: nkruntime.Presence[]) {
    const s = state as MatchState;
    
    for (const presence of presences) {
        if (!s.players[presence.sessionId]) {
            // Assign mark 1 (X) if first player, else mark 2 (O)
            const mark = Object.keys(s.players).length === 0 ? 1 : 2;
            s.players[presence.sessionId] = { presence, mark };
        }
    }

    if (Object.keys(s.players).length === 2 && !s.playing && s.winner === 0) {
        s.playing = true;
        s.turn = 1;
        s.deadline = s.fastMode ? getTime() + 30 : 0;
        broadcastState(dispatcher, s);
    }
    
    return { state: s };
};

export const matchLeave: nkruntime.MatchLeaveFunction = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, presences: nkruntime.Presence[]) {
    const s = state as MatchState;
    
    for (const presence of presences) {
        const leavingPlayer = s.players[presence.sessionId];
        if (leavingPlayer && s.playing) {
            s.winner = leavingPlayer.mark === 1 ? 2 : 1;
            s.playing = false;
        }
    }
    
    if (s.winner !== 0) {
        broadcastState(dispatcher, s);
        return null;
    }

    return { state: s };
};

export const matchLoop: nkruntime.MatchLoopFunction = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, messages: nkruntime.MatchMessage[]) {
    const s = state as MatchState;
    
    if (!s.playing) {
        if (s.winner !== 0) {
            return null; // Next tick will terminate it
        }
        return { state: s };
    }

    // Process moves
    for (const message of messages) {
        if (message.opCode === OP_MOVE) {
            const player = s.players[message.sender.sessionId];
            if (!player || player.mark !== s.turn) continue;

            try {
                const data = JSON.parse(nk.binaryToString(message.data));
                const position = data.position;
                if (position >= 0 && position <= 8 && s.board[position] === 0) {
                    s.board[position] = player.mark;
                    s.winner = checkWin(s.board);
                    
                    if (s.winner === 0) {
                        s.turn = s.turn === 1 ? 2 : 1;
                        s.deadline = s.fastMode ? getTime() + 30 : 0;
                    } else {
                        s.playing = false;
                    }
                    broadcastState(dispatcher, s);
                }
            } catch (e) {
                logger.debug("Failed parsing move: %s", e);
            }
        }
    } // End of message loop

    // Check Timer forfeit (only in timed/fast mode)
    if (s.playing && s.fastMode && s.deadline > 0 && getTime() > s.deadline) {
        s.winner = s.turn === 1 ? 2 : 1;
        s.playing = false;
        broadcastState(dispatcher, s);
    }

    if (s.winner !== 0) {
        return null; // terminate
    }

    return { state: s };
};

export const matchTerminate: nkruntime.MatchTerminateFunction = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, graceSeconds: number) {
    const s = state as MatchState;

    if (s.winner === 1 || s.winner === 2) {
        for (const sessionId in s.players) {
            const player = s.players[sessionId];
            const isWinner = player.mark === s.winner;

            try {
                if (isWinner) {
                    // Increment wins
                    nk.leaderboardRecordWrite("global_wins", player.presence.userId, player.presence.username, 1);

                    // Read current streak, increment, and write back
                    let currentStreak = 0;
                    try {
                        const storageRead = nk.storageRead([{
                            collection: "player_stats",
                            key: "streak",
                            userId: player.presence.userId
                        }]);
                        if (storageRead.length > 0) {
                            const data = storageRead[0].value as {[key: string]: any};
                            currentStreak = data.current || 0;
                        }
                    } catch (_) {}
                    
                    currentStreak += 1;
                    nk.storageWrite([{
                        collection: "player_stats",
                        key: "streak",
                        userId: player.presence.userId,
                        value: { current: currentStreak } as {[key: string]: any},
                        permissionRead: 1,
                        permissionWrite: 0
                    }]);

                    // Update best streak leaderboard (SET operator = keeps max)
                    nk.leaderboardRecordWrite("global_streaks", player.presence.userId, player.presence.username, currentStreak);
                } else {
                    // Increment losses
                    nk.leaderboardRecordWrite("global_losses", player.presence.userId, player.presence.username, 1);

                    // Reset current streak to 0
                    nk.storageWrite([{
                        collection: "player_stats",
                        key: "streak",
                        userId: player.presence.userId,
                        value: { current: 0 } as {[key: string]: any},
                        permissionRead: 1,
                        permissionWrite: 0
                    }]);
                }
            } catch (error) {
                logger.error("Failed to write leaderboard/stats: %s", error);
            }
        }
    }

    return { state: s };
};

export const matchSignal: nkruntime.MatchSignalFunction = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: nkruntime.MatchState, data: string) {
    return { state, data: "" };
};
