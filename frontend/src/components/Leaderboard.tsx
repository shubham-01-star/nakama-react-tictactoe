import { useState, useEffect } from 'react';
import { client } from '../lib/nakama';
import type { Session } from '@heroiclabs/nakama-js';

interface PlayerStats {
    userId: string;
    username: string;
    wins: number;
    losses: number;
    streak: number;
}

export function Leaderboard({ session }: { session: Session }) {
    const [players, setPlayers] = useState<PlayerStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLeaderboard = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await client.rpc(session, "get_leaderboard", {});
            const data = typeof result.payload === 'string' 
                ? JSON.parse(result.payload) 
                : result.payload;
            setPlayers(data.players || []);
        } catch (e: any) {
            console.error("Failed to fetch leaderboard:", e);
            setError("Could not load leaderboard. Play a game first!");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLeaderboard();
    }, []);

    if (loading) {
        return (
            <div className="bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-lg text-center">
                <div className="animate-spin h-8 w-8 border-3 border-blue-400 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-slate-400">Loading leaderboard...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-lg text-center">
                <p className="text-slate-400">{error}</p>
                <button onClick={fetchLeaderboard} className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-semibold transition-colors">
                    Retry
                </button>
            </div>
        );
    }

    if (players.length === 0) {
        return (
            <div className="bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-lg text-center">
                <p className="text-4xl mb-4">🏆</p>
                <p className="text-slate-400">No players yet. Be the first to play!</p>
            </div>
        );
    }

    return (
        <div className="bg-slate-800 p-6 rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">🏆 Global Rankings</h2>
                <button onClick={fetchLeaderboard} className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                    Refresh
                </button>
            </div>

            <table className="w-full text-left">
                <thead>
                    <tr className="text-slate-400 text-sm uppercase tracking-wider border-b border-slate-700">
                        <th className="pb-3 pl-2">#</th>
                        <th className="pb-3">Player</th>
                        <th className="pb-3 text-center">W</th>
                        <th className="pb-3 text-center">L</th>
                        <th className="pb-3 text-center">🔥</th>
                    </tr>
                </thead>
                <tbody>
                    {players.map((player, index) => (
                        <tr key={player.userId} className={`border-b border-slate-700/50 transition-colors hover:bg-slate-700/30 ${
                            index === 0 ? 'text-yellow-400' : index === 1 ? 'text-slate-300' : index === 2 ? 'text-amber-600' : 'text-slate-400'
                        }`}>
                            <td className="py-3 pl-2 font-bold">{index + 1}</td>
                            <td className="py-3 font-semibold">{player.username || 'Anonymous'}</td>
                            <td className="py-3 text-center text-emerald-400 font-bold">{player.wins}</td>
                            <td className="py-3 text-center text-red-400">{player.losses}</td>
                            <td className="py-3 text-center text-orange-400 font-bold">{player.streak}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="mt-4 text-xs text-slate-500 text-center">
                W = Wins · L = Losses · 🔥 = Best Win Streak
            </div>
        </div>
    );
}
