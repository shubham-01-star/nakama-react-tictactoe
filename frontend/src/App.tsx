import { useEffect, useState } from 'react';
import { client, USE_SSL } from './lib/nakama';
import { Session, type Socket, type MatchmakerMatched, type Match, type MatchData } from '@heroiclabs/nakama-js';
import { GameBoard } from './components/GameBoard';
import { Leaderboard } from './components/Leaderboard';

const OP_STATE = 2;

interface MatchState {
    board: number[];
    turn: number;
    deadline: number;
    winner: number;
    marks: { [sessionId: string]: number };
}

const generateDeviceId = () => {
    let id = localStorage.getItem('device_id');
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('device_id', id);
    }
    return id;
};

export default function App() {
    const [session, setSession] = useState<Session | null>(null);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [matchmakingError, setMatchmakingError] = useState<string | null>(null);

    // Matchmaking State
    const [ticket, setTicket] = useState<string | null>(null);
    const [match, setMatch] = useState<Match | null>(null);
    const [gameState, setGameState] = useState<MatchState | null>(null);
    const [mode, setMode] = useState<'classic' | 'timed'>('timed');
    const [tab, setTab] = useState<'play' | 'leaderboard'>('play');

    useEffect(() => {
        let activeSocket: Socket | null = null;
        const initNakama = async () => {
            try {
                const deviceId = generateDeviceId();
                // Authenticate and create account if doesn't exist
                const newSession = await client.authenticateDevice(deviceId, true);
                setSession(newSession);

                const newSocket = client.createSocket(USE_SSL, false);
                
                // Set up event listeners BEFORE connect
                newSocket.ondisconnect = () => {
                    setMatch(null);
                    setTicket(null);
                    setGameState(null);
                };

                newSocket.onmatchdata = (matchData: MatchData) => {
                    if (matchData.op_code !== OP_STATE) return;
                    try {
                        const strData = new TextDecoder().decode(matchData.data);
                        const parsed = JSON.parse(strData) as MatchState;
                        setGameState(parsed);
                    } catch (e) {
                        console.error("Failed to parse state", e);
                    }
                };

                newSocket.onmatchmakermatched = async (matched: MatchmakerMatched) => {
                    console.log("Matchmaker Matched:", matched);
                    try {
                        setGameState(null);
                        const joinedMatch = matched.match_id
                            ? await newSocket.joinMatch(matched.match_id)
                            : await newSocket.joinMatch(undefined, matched.token);
                        setMatch(joinedMatch);
                        setTicket(null);
                        setMatchmakingError(null);
                    } catch (e) {
                        console.error("Failed to join match:", e);
                        setTicket(null);
                        setMatchmakingError("Matched an opponent, but failed to join the game. Please try again.");
                    }
                };

                await newSocket.connect(newSession, true);
                setSocket(newSocket);
                activeSocket = newSocket;
            } catch (err: any) {
                console.error(err);
                setError(err.message || 'Failed to connect to Nakama Server!');
            } finally {
                setLoading(false);
            }
        };

        initNakama();

        return () => {
            if (activeSocket) activeSocket.disconnect(false);
        };
    }, []);

    const findMatch = async () => {
        if (!socket) return;
        try {
            setMatchmakingError(null);
            const matchmakerTicket = await socket.addMatchmaker(
                "+properties.mode:" + mode, // Only match with same mode players
                2, 2,
                { mode: mode },  // string_properties
                {}               // numeric_properties
            );
            setTicket(matchmakerTicket.ticket);
        } catch (e) {
            console.error("Matchmaker error:", e);
        }
    };

    const cancelMatch = async () => {
        if (!socket || !ticket) return;
        try {
            await socket.removeMatchmaker(ticket);
            setTicket(null);
            setMatchmakingError(null);
        } catch (e) {
            console.error("Cancel error:", e);
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center text-xl">Connecting to Game Server...</div>;
    if (error) return <div className="min-h-screen flex flex-col items-center justify-center text-red-500">
        <h2 className="text-2xl font-bold mb-2">Connection Error</h2>
        <p>{error}</p>
        <p className="mt-4 text-slate-400">Ensure Docker Compose and Nakama are running.</p>
    </div>;

    // Render In-Game UI
    if (match && socket) {
        return (
            <div className="min-h-screen p-8 flex flex-col items-center">
                <h1 className="text-4xl font-extrabold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                   Tic-Tac-Toe
                </h1>
                <GameBoard 
                    socket={socket} 
                    match={match} 
                    sessionId={match.self.session_id!} 
                    gameState={gameState}
                    onLeave={() => { setMatch(null); setTicket(null); setGameState(null); }} 
                />
            </div>
        );
    }

    // Render Lobby UI
    return (
        <div className="min-h-screen p-8 flex flex-col items-center">
            <h1 className="text-4xl font-bold mb-8 text-white">
                Multiplayer Tic-Tac-Toe
            </h1>

            {/* Tab Navigation */}
            <div className="flex mb-6 bg-slate-800 rounded-xl p-1 gap-1">
                <button
                    onClick={() => setTab('play')}
                    className={`px-6 py-2 rounded-lg font-semibold cursor-pointer transition-all hover:scale-105 active:scale-95 ${tab === 'play' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:text-white'}`}
                >
                    Play
                </button>
                <button
                    onClick={() => setTab('leaderboard')}
                    className={`px-6 py-2 rounded-lg font-semibold cursor-pointer transition-all hover:scale-105 active:scale-95 ${tab === 'leaderboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:text-white'}`}
                >
                    Leaderboard
                </button>
            </div>

            {tab === 'leaderboard' && session ? (
                <Leaderboard session={session} />
            ) : (
                <div className="bg-slate-800 p-6 rounded-2xl shadow-xl w-full max-w-md">
                    <p className="mb-2"><span className="text-slate-400">Player ID:</span> <span className="font-mono text-xs">{session?.user_id}</span></p>
                    <p className="mb-4"><span className="text-slate-400">Username:</span> <span className="font-bold">{session?.username}</span></p>

                    {/* Mode Selection */}
                    <div className="mb-6">
                        <p className="text-sm text-slate-400 mb-2 uppercase tracking-wider">Game Mode</p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setMode('classic')}
                                className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                                    mode === 'classic'
                                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                                        : 'bg-slate-700 text-slate-400 hover:text-white'
                                }`}
                            >
                                ♟ Classic
                            </button>
                            <button
                                onClick={() => setMode('timed')}
                                className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                                    mode === 'timed'
                                        ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30'
                                        : 'bg-slate-700 text-slate-400 hover:text-white'
                                }`}
                            >
                                ⏱ Timed (30s)
                            </button>
                        </div>
                    </div>

                    <div className="border-t border-slate-700 pt-6">
                        <h2 className="text-xl font-semibold mb-4 text-center">Lobby</h2>
                        {matchmakingError ? (
                            <p className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                                {matchmakingError}
                            </p>
                        ) : null}
                        
                        {!ticket ? (
                            <button 
                                onClick={findMatch}
                                className="w-full bg-blue-600 hover:bg-blue-500 cursor-pointer transition-all hover:scale-105 active:scale-95 py-3 rounded-lg font-bold text-white shadow-xl shadow-blue-600/30">
                                Find Match
                            </button>
                        ) : (
                            <div className="flex flex-col items-center space-y-4">
                                <div className="flex items-center space-x-2 text-emerald-400">
                                    <div className="animate-spin h-5 w-5 border-2 border-emerald-400 border-t-transparent rounded-full" />
                                    <span>Searching for {mode === 'timed' ? 'Timed' : 'Classic'} opponent...</span>
                                </div>
                                <button 
                                    onClick={cancelMatch}
                                    className="w-full bg-slate-700 hover:bg-slate-600 cursor-pointer transition-all hover:scale-105 active:scale-95 py-3 rounded-lg font-bold text-slate-300">
                                    Cancel Search
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
