import React, { useState, useEffect } from 'react';
import { 
  Trophy, Medal, Target, Globe, Loader2, User,
  TowerControl, Bot, Castle, Gamepad2, BrainCircuit, Gem,
  ArrowUp, Activity, Award, TrendingUp
} from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { collectionGroup, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

interface LeaderboardScreenProps {
  user: FirebaseUser | null;
}

const avatars = [
  { id: 1, icon: TowerControl },
  { id: 2, icon: Bot },
  { id: 3, icon: Castle },
  { id: 4, icon: Gamepad2 },
  { id: 5, icon: BrainCircuit },
  { id: 6, icon: Gem },
];

const getAvatarIcon = (id: number) => {
  return avatars.find(a => a.id === id)?.icon || User;
};

export const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({ user }) => {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        // Querying across all user 'profile' sub-collections
        const profileQuery = query(
          collectionGroup(db, 'data'),
          orderBy('onlineStats.elo', 'desc'),
          limit(50)
        );

        const snapshot = await getDocs(profileQuery);
        const fetchedPlayers: any[] = [];
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          // We only want profile documents that actually have onlineStats
          if (data.onlineStats) {
            fetchedPlayers.push({
              uid: doc.ref.parent.parent?.id, // Get User ID from path
              ...data
            });
          }
        });

        setPlayers(fetchedPlayers);
      } catch (e) {
        console.error("Leaderboard fetch error:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  if (loading) {
    return (
      <div className="w-full flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-12 h-12 text-tertiary animate-spin" />
        <p className="font-label-caps text-on-surface-variant tracking-widest text-[10px] animate-pulse uppercase">Syncing Global Rankings...</p>
      </div>
    );
  }

  const topThree = players.slice(0, 3);
  const theRest = players.slice(3);

  return (
    <div className="w-full flex flex-col gap-8 max-w-5xl mx-auto pt-6 pb-12 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
             <Globe className="w-8 h-8 text-blue-400" />
             <h1 className="text-4xl font-serif text-primary">Global Leaderboard</h1>
          </div>
          <p className="text-on-surface-variant font-body-md">The top tactical minds currently dominating the arena.</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-full flex items-center gap-2">
           <TrendingUp className="w-4 h-4 text-blue-400" />
           <span className="text-[10px] text-blue-400 font-label-caps tracking-widest uppercase">Rankings update in real-time</span>
        </div>
      </div>

      {/* Podium Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end px-4 mt-8">
        {/* Rank 2 */}
        {topThree[1] && (
          <div className="glass-panel p-6 rounded-2xl flex flex-col items-center text-center border-t-4 border-t-slate-400 order-2 md:order-1 h-[280px] justify-center">
             <div className="relative mb-4">
                <div className="w-20 h-20 rounded-full bg-surface-container-high border-2 border-slate-400/50 flex items-center justify-center">
                   {React.createElement(getAvatarIcon(topThree[1].avatarId), { className: "w-10 h-10 text-slate-400" })}
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-slate-400 rounded-full flex items-center justify-center text-on-primary font-bold shadow-lg">2</div>
             </div>
             <h3 className="font-title-md text-primary truncate w-full px-2">{topThree[1].name}</h3>
             <div className="text-2xl font-mono-stats text-blue-400 mt-1">{topThree[1].onlineStats?.elo || 1200}</div>
             <div className="text-[10px] text-on-surface-variant font-label-caps mt-2">CONTENDER</div>
          </div>
        )}

        {/* Rank 1 */}
        {topThree[0] && (
          <div className="glass-panel p-8 rounded-2xl flex flex-col items-center text-center border-t-4 border-t-tertiary shadow-[0_0_40px_rgba(233,195,73,0.1)] order-1 md:order-2 h-[320px] justify-center scale-105 relative z-10">
             <Trophy className="absolute -top-10 w-12 h-12 text-tertiary drop-shadow-[0_0_15px_rgba(233,195,73,0.5)]" />
             <div className="relative mb-4">
                <div className="w-24 h-24 rounded-full bg-surface-container-high border-4 border-tertiary/50 flex items-center justify-center shadow-[0_0_20px_rgba(233,195,73,0.2)]">
                   {React.createElement(getAvatarIcon(topThree[0].avatarId), { className: "w-12 h-12 text-tertiary" })}
                </div>
                <div className="absolute -top-2 -right-2 w-10 h-10 bg-tertiary rounded-full flex items-center justify-center text-slate-900 font-bold shadow-lg text-lg">1</div>
             </div>
             <h3 className="font-display-lg text-2xl text-primary truncate w-full px-2">{topThree[0].name}</h3>
             <div className="text-4xl font-mono-stats text-tertiary mt-1">{topThree[0].onlineStats?.elo || 1200}</div>
             <div className="flex items-center gap-1 text-[10px] text-tertiary font-label-caps mt-2 tracking-[0.2em]">
                <Award className="w-3 h-3" /> ARENA GRANDMASTER
             </div>
          </div>
        )}

        {/* Rank 3 */}
        {topThree[2] && (
          <div className="glass-panel p-6 rounded-2xl flex flex-col items-center text-center border-t-4 border-t-orange-700 order-3 h-[240px] justify-center">
             <div className="relative mb-4">
                <div className="w-20 h-20 rounded-full bg-surface-container-high border-2 border-orange-700/50 flex items-center justify-center">
                   {React.createElement(getAvatarIcon(topThree[2].avatarId), { className: "w-10 h-10 text-orange-700" })}
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-orange-700 rounded-full flex items-center justify-center text-on-primary font-bold shadow-lg">3</div>
             </div>
             <h3 className="font-title-md text-primary truncate w-full px-2">{topThree[2].name}</h3>
             <div className="text-2xl font-mono-stats text-blue-400 mt-1">{topThree[2].onlineStats?.elo || 1200}</div>
             <div className="text-[10px] text-on-surface-variant font-label-caps mt-2">TACTICIAN</div>
          </div>
        )}
      </div>

      {/* Leaderboard Table */}
      <div className="glass-panel rounded-2xl overflow-hidden mx-4">
        <div className="grid grid-cols-[60px_1fr_100px_100px_120px] p-4 bg-surface-container-high border-b border-white/5 text-[10px] text-on-surface-variant font-label-caps tracking-widest">
           <div className="text-center">RANK</div>
           <div>PLAYER</div>
           <div className="text-center">ELO</div>
           <div className="text-center">WINS</div>
           <div className="text-center">WIN RATE</div>
        </div>
        
        <div className="flex flex-col">
          {theRest.length === 0 && !loading && topThree.length < 3 && (
            <div className="p-12 text-center text-on-surface-variant italic">
              Awaiting more challengers...
            </div>
          )}
          
          {theRest.map((player, index) => {
            const rank = index + 4;
            const wins = player.onlineStats?.wins || 0;
            const losses = player.onlineStats?.losses || 0;
            const total = wins + losses;
            const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
            const isMe = player.uid === user?.uid;
            const AvatarIcon = getAvatarIcon(player.avatarId);

            return (
              <div 
                key={player.uid} 
                className={`grid grid-cols-[60px_1fr_100px_100px_120px] items-center p-4 border-b border-white/5 hover:bg-surface-variant/30 transition-colors ${isMe ? 'bg-blue-500/5' : ''}`}
              >
                <div className="text-center font-mono-stats text-on-surface-variant">{rank}</div>
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className={`w-8 h-8 rounded-full bg-surface-container flex items-center justify-center border ${isMe ? 'border-blue-400' : 'border-white/10'}`}>
                    <AvatarIcon className={`w-4 h-4 ${isMe ? 'text-blue-400' : 'text-on-surface-variant'}`} />
                  </div>
                  <div className="font-title-md text-primary truncate">
                    {player.name}
                    {isMe && <span className="ml-2 text-[8px] bg-blue-400 text-slate-900 px-1 rounded font-bold uppercase">You</span>}
                  </div>
                </div>
                <div className="text-center font-mono-stats text-blue-400 font-bold">{player.onlineStats?.elo || 1200}</div>
                <div className="text-center font-mono-stats text-on-surface-variant">{wins}</div>
                <div className="text-center">
                   <div className="flex items-center justify-center gap-2">
                      <div className="w-12 h-1.5 bg-surface-container-high rounded-full overflow-hidden flex">
                         <div className="h-full bg-blue-400" style={{ width: `${winRate}%` }} />
                      </div>
                      <span className="font-mono-stats text-xs text-on-surface-variant w-8">{winRate}%</span>
                   </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
    </div>
  );
};