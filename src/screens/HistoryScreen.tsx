// /home/aquaax19/Workspace/Projects/Chess/grandmaster-chess/src/screens/HistoryScreen.tsx

import React, { useState, useEffect } from 'react';
import { Search, Swords, Bot, Calendar, Clock, Play, Loader2 } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { db, appId } from '../config/firebase';
import type { ScreenState } from '../App';

interface HistoryScreenProps {
  user: FirebaseUser | null;
  onNavigate: (s: ScreenState, matchId?: string) => void;
}

interface MatchData {
  id: string;
  type: 'ai_match' | 'local';
  ai_level?: number;
  status: string;
  winner: string | null;
  moves: string[];
  lastUpdated: any;
  docId: string;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ user, onNavigate }) => {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!user) return;
    
    const fetchMatches = async () => {
      try {
        // Rule 1: Always use the exact namespaced path for private user data
        const matchesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'matches');
        
        // Rule 2: Simple query, fetch all and process in memory
        const snapshot = await getDocs(matchesRef);
        const fetchedMatches: MatchData[] = [];
        
        snapshot.forEach(doc => {
          const data = doc.data();
          fetchedMatches.push({
            ...data,
            docId: doc.id,
            // Fallback for earlier matches without an id field
            id: data.id || doc.id 
          } as MatchData);
        });

        // Sort descending by timestamp in memory (newest first)
        fetchedMatches.sort((a, b) => {
           const timeA = a.lastUpdated?.toMillis?.() || 0;
           const timeB = b.lastUpdated?.toMillis?.() || 0;
           return timeB - timeA;
        });

        setMatches(fetchedMatches);
      } catch (error) {
        console.error("Error fetching matches:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMatches();
  }, [user]);

  // Filter matches based on the search query mapping to the Match ID
  const filteredMatches = matches.filter(match => 
    (match.id || match.docId).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full flex flex-col gap-lg max-w-4xl mx-auto fade-slide-up pt-md pb-xl">
      
      {/* Header & Search */}
      <div className="glass-panel rounded-xl p-md flex flex-col md:flex-row justify-between items-center gap-md relative overflow-hidden">
        <div className="absolute top-0 right-0 p-lg opacity-5 pointer-events-none">
          <Clock className="w-24 h-24 text-tertiary" />
        </div>
        <div className="relative z-10 w-full md:w-auto text-center md:text-left">
          <h2 className="font-display-lg text-3xl text-primary mb-xs">Match History</h2>
          <p className="font-body-sm text-on-surface-variant">Review past battles and analyze your moves.</p>
        </div>
        <div className="relative w-full md:w-64 z-10">
          <Search className="absolute left-sm top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input
            type="text"
            placeholder="Search Match ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-container-high text-on-surface font-mono-stats text-sm pl-10 pr-md py-sm rounded-lg border border-white/10 focus:border-tertiary outline-none transition-colors placeholder:text-on-surface-variant/50"
          />
        </div>
      </div>

      {/* Matches List */}
      <div className="flex flex-col gap-md">
        {loading ? (
          <div className="w-full py-xl flex flex-col items-center justify-center gap-md">
            <Loader2 className="w-8 h-8 text-tertiary animate-spin" />
            <span className="font-label-caps text-on-surface-variant tracking-widest text-[10px] animate-pulse">FETCHING ARCHIVES...</span>
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="glass-panel rounded-xl p-xl flex flex-col items-center justify-center text-center gap-md">
             <div className="w-16 h-16 rounded-full bg-surface-variant flex items-center justify-center border border-white/5">
                <Search className="w-8 h-8 text-on-surface-variant" />
             </div>
             <div>
                <h3 className="font-title-md text-primary mb-xs">No Matches Found</h3>
                <p className="font-body-sm text-on-surface-variant">Get out there and play some games, or try a different Match ID!</p>
             </div>
          </div>
        ) : (
          filteredMatches.map(match => (
            <div key={match.docId} className="glass-panel rounded-xl p-md flex flex-col md:flex-row items-center gap-md hover:border-tertiary/30 transition-colors group">
              
              {/* Icon */}
              <div className="w-12 h-12 rounded-full bg-surface-container flex shrink-0 items-center justify-center border border-white/5 group-hover:bg-tertiary/10 transition-colors">
                {match.type === 'ai_match' ? (
                  <Bot className="text-tertiary w-6 h-6" />
                ) : (
                  <Swords className="text-primary w-6 h-6" />
                )}
              </div>
              
              {/* Match Details */}
              <div className="flex-1 w-full text-center md:text-left">
                <div className="font-title-md text-primary flex flex-col md:flex-row items-center justify-center md:justify-start gap-sm mb-xs">
                  {match.type === 'ai_match' ? `vs Stockfish (Lv.${match.ai_level || 3})` : 'Local Multiplayer'}
                  <span className="font-mono-stats text-[10px] text-on-surface-variant/50 bg-surface-variant px-2 py-0.5 rounded tracking-widest uppercase">
                    ID: {match.id ? match.id.split('-')[0] : 'UNKNOWN'}
                  </span>
                </div>
                <div className="font-body-sm text-on-surface-variant flex flex-wrap items-center justify-center md:justify-start gap-md">
                  <span className="flex items-center gap-xs"><Clock className="w-3 h-3" /> {match.moves.length} Moves</span>
                  <span className="flex items-center gap-xs"><Calendar className="w-3 h-3" /> 
                    {match.lastUpdated?.toDate ? match.lastUpdated.toDate().toLocaleDateString() : 'Just now'}
                  </span>
                  <span className="font-label-caps text-[10px] tracking-widest text-tertiary/70 bg-tertiary/5 px-2 py-0.5 rounded border border-tertiary/10">
                    {match.status}
                  </span>
                </div>
              </div>

              {/* Winner & Action */}
              <div className="flex flex-col md:flex-row items-center gap-md w-full md:w-auto mt-md md:mt-0 pt-md md:pt-0 border-t md:border-t-0 border-white/5">
                <div className="text-center md:text-right hidden sm:block">
                  <div className="font-label-caps text-[10px] text-on-surface-variant tracking-widest uppercase">Winner</div>
                  <div className={`font-title-md ${match.winner === 'Player' || match.winner === 'White' || match.winner === 'Black' ? 'text-tertiary' : 'text-primary'}`}>
                    {match.winner || 'Draw'}
                  </div>
                </div>
                <button 
                  onClick={() => onNavigate('replay' as ScreenState, match.id || match.docId)}
                  className="w-full md:w-auto flex items-center justify-center gap-xs bg-tertiary/10 hover:bg-tertiary/20 text-tertiary px-lg py-sm rounded-lg transition-colors border border-tertiary/20 active:scale-95"
                >
                  <Play className="w-4 h-4 fill-tertiary" /> <span className="font-title-md text-sm">Replay</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
