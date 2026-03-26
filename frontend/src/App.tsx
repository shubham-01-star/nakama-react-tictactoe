import { useEffect, useState } from 'react';
import { client } from './nakama';
import { Session, type Socket, type MatchmakerMatched, type Match } from '@heroiclabs/nakama-js';
import { GameBoard } from './GameBoard';

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

    // Matchmaking State
    const [ticket, setTicket] = useState<string | null>(null);
    const [match, setMatch] = useState<Match | null>(null);

    useEffect(() => {
        let activeSocket: Socket | null = null;
        const initNakama = async () => {
            try {
                const deviceId = generateDeviceId();
                // Authenticate and create account if doesn't exist
                const newSession = await client.authenticateDevice(deviceId, true);
                setSession(newSession);

                const newSocket = client.createSocket(false, false);
                
                // Set up event listeners BEFORE connect
                newSocket.ondisconnect = () => {
                    setMatch(null);
                    setTicket(null);
                };

                newSocket.onmatchmakermatched = async (matched: MatchmakerMatched) => {
                    console.log("Matchmaker Matched:", matched);
                    try {
                        const joinedMatch = await newSocket.joinMatch(matched.match_id || matched.token);
                        setMatch(joinedMatch);
                        setTicket(null);
                    } catch (e) {
                        console.error("Failed to join match:", e);
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
            // Find a Tic-Tac-Toe match (min 2, max 2 players)
            const matchmakerTicket = await socket.addMatchmaker("*", 2, 2);
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
                    Lila's Tic-Tac-Toe
                </h1>
                <GameBoard 
                    socket={socket} 
                    match={match} 
                    sessionId={match.self.session_id!} 
                    onLeave={() => { setMatch(null); setTicket(null); }} 
                />
            </div>
        );
    }

    // Render Lobby UI
    return (
        <div className="min-h-screen p-8 flex flex-col items-center">
            <h1 className="text-4xl font-extrabold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                Lila's Tic-Tac-Toe
            </h1>
            <div className="bg-slate-800 p-6 rounded-2xl shadow-xl w-full max-w-md">
                <p className="mb-2"><span className="text-slate-400">Player ID:</span> <span className="font-mono text-xs">{session?.user_id}</span></p>
                <p className="mb-4"><span className="text-slate-400">Username:</span> <span className="font-bold">{session?.username}</span></p>

                <div className="mt-8 border-t border-slate-700 pt-6">
                    <h2 className="text-xl font-semibold mb-4 text-center">Lobby</h2>
                    
                    {!ticket ? (
                        <button 
                            onClick={findMatch}
                            className="w-full bg-blue-600 hover:bg-blue-500 transition-colors py-3 rounded-lg font-bold text-white shadow hover:shadow-blue-500/30">
                            Find Match
                        </button>
                    ) : (
                        <div className="flex flex-col items-center space-y-4">
                            <div className="flex items-center space-x-2 text-emerald-400">
                                <div className="animate-spin h-5 w-5 border-2 border-emerald-400 border-t-transparent rounded-full" />
                                <span>Searching for an opponent...</span>
                            </div>
                            <button 
                                onClick={cancelMatch}
                                className="w-full bg-slate-700 hover:bg-slate-600 transition-colors py-3 rounded-lg font-bold text-slate-300">
                                Cancel Search
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
