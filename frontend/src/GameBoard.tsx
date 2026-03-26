import { useEffect, useState } from 'react';
import type { Match, Socket, MatchData } from '@heroiclabs/nakama-js';

const OP_MOVE = 1;
const OP_STATE = 2;

interface MatchState {
    board: number[];
    turn: number;
    deadline: number;
    winner: number;
    marks: { [sessionId: string]: number }; // Maps Session ID to 1 (X) or 2 (O)
}

export function GameBoard({ socket, match, sessionId, onLeave }: { socket: Socket, match: Match, sessionId: string, onLeave: () => void }) {
    const [gameState, setGameState] = useState<MatchState | null>(null);
    const [timeLeft, setTimeLeft] = useState<number>(30);

    useEffect(() => {
        socket.onmatchdata = (matchData: MatchData) => {
            if (matchData.op_code === OP_STATE) {
                try {
                    const strData = new TextDecoder().decode(matchData.data);
                    const parsed = JSON.parse(strData) as MatchState;
                    setGameState(parsed);
                } catch (e) {
                    console.error("Failed to parse state", e);
                }
            }
        };

        return () => {
            socket.onmatchdata = () => {};
        };
    }, [socket]);

    useEffect(() => {
        if (!gameState) return;
        const interval = setInterval(() => {
            const now = Math.floor(Date.now() / 1000);
            const remaining = Math.max(0, gameState.deadline - now);
            setTimeLeft(remaining);
        }, 1000);
        return () => clearInterval(interval);
    }, [gameState]);

    const makeMove = (index: number) => {
        if (!gameState) return;
        if (gameState.winner !== 0) return;
        if (gameState.marks[sessionId] !== gameState.turn) return;
        if (gameState.board[index] !== 0) return;
        
        const payload = JSON.stringify({ position: index });
        socket.sendMatchState(match.match_id, OP_MOVE, payload);
    };

    const leaveMatch = async () => {
        try {
            await socket.leaveMatch(match.match_id);
            onLeave();
        } catch (e) {
            console.error(e);
        }
    };

    if (!gameState) return <div className="text-white bg-slate-800 px-6 py-4 rounded-xl shadow mt-8">Waiting for game to initialize...</div>;

    const myMark = gameState.marks[sessionId] || 0;
    const isMyTurn = myMark === gameState.turn && gameState.winner === 0;
    const getSymbol = (m: number) => m === 1 ? 'X' : (m === 2 ? 'O' : '');

    return (
        <div className="flex flex-col items-center">
            <h2 className="text-2xl font-bold mb-6">
                {gameState.winner === 0 ? (
                    isMyTurn ? <span className="text-emerald-400">Your Turn ({timeLeft}s)</span> : <span className="text-slate-400">Opponent's Turn ({timeLeft}s)</span>
                ) : (
                    gameState.winner === 3 ? <span className="text-yellow-400">It's a Draw!</span> :
                    gameState.winner === myMark ? <span className="text-blue-400">You Won! 🎉</span> :
                    <span className="text-red-400">You Lost! 💔</span>
                )}
            </h2>

            <div className="grid grid-cols-3 gap-2 bg-slate-700 p-3 rounded-2xl shadow-xl">
                {gameState.board.map((cell, idx) => (
                    <button
                        key={idx}
                        onClick={() => makeMove(idx)}
                        disabled={cell !== 0 || !isMyTurn || gameState.winner !== 0}
                        className={`w-24 h-24 sm:w-32 sm:h-32 flex items-center justify-center text-5xl sm:text-7xl font-extrabold rounded-xl transition-all duration-200 shadow-inner
                            ${cell === 0 ? 'bg-slate-800 hover:bg-slate-600' : 'bg-slate-900'}
                            ${cell === 1 ? 'text-blue-400' : 'text-emerald-400'}
                            ${(cell === 0 && isMyTurn && gameState.winner === 0) ? 'hover:scale-105 active:scale-95' : ''}
                        `}
                    >
                        {getSymbol(cell)}
                    </button>
                ))}
            </div>

            <div className="mt-8 flex justify-between w-full max-w-sm px-4">
                <div className="text-center">
                    <p className="text-sm tracking-widest uppercase text-slate-400 mb-1">You</p>
                    <p className={`font-bold text-3xl ${myMark === 1 ? 'text-blue-400' : 'text-emerald-400'}`}>{getSymbol(myMark)}</p>
                </div>
                <div className="text-center">
                    <p className="text-sm tracking-widest uppercase text-slate-400 mb-1">Opponent</p>
                    <p className={`font-bold text-3xl ${myMark === 1 ? 'text-emerald-400' : 'text-blue-400'}`}>{getSymbol(myMark === 1 ? 2 : 1)}</p>
                </div>
            </div>

            {gameState.winner !== 0 && (
                <button onClick={leaveMatch} className="mt-10 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-lg shadow-lg shadow-indigo-600/30 text-white transition-all hover:scale-105 active:scale-95">
                    Return to Lobby
                </button>
            )}
        </div>
    );
}
