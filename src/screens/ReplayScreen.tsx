// /home/aquaax19/Workspace/Projects/Chess/grandmaster-chess/src/screens/ReplayScreen.tsx

import React, { useState, useEffect } from 'react';
import { 
  SkipBack, ChevronLeft, ChevronRight, SkipForward, 
  ArrowLeft, Loader2, Bot, Users, Trophy 
} from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { db, appId } from '../config/firebase';
import { ChessBoard } from '../components/chess/ChessBoard';
import type { ScreenState } from '../App';

interface ReplayScreenProps {
  user: FirebaseUser | null;
  matchId: string;
  onNavigate: (s: ScreenState) => void;
}

export const ReplayScreen: React.FC<ReplayScreenProps> = ({ user, matchId, onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchData, setMatchData] = useState<any>(null);
  
  // Replay Engine State
  const [moves, setMoves] = useState<string[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [fen, setFen] = useState(new Chess().fen());
  const [inCheckSquare, setInCheckSquare] = useState<Square | null>(null);

  // 1. Fetch the match data from Firestore
  useEffect(() => {
    if (!user || !matchId) return;

    const fetchMatch = async () => {
      try {
        const matchRef = doc(db, 'artifacts', appId, 'users', user.uid, 'matches', matchId);
        const docSnap = await getDoc(matchRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setMatchData(data);
          setMoves(data.moves || []);
          // Start at the very end of the game by default
          setCurrentMoveIndex(data.moves?.length || 0);
        } else {
          setError("Match not found or access denied.");
        }
      } catch (err) {
        console.error("Error fetching replay:", err);
        setError("Failed to load match data.");
      } finally {
        setLoading(false);
      }
    };

    fetchMatch();
  }, [user, matchId]);

  // 2. Rebuild the board whenever the move index changes
  useEffect(() => {
    const tempGame = new Chess();
    
    // Apply moves up to the current index
    for (let i = 0; i < currentMoveIndex; i++) {
      try {
        tempGame.move(moves[i]);
      } catch (e) {
        console.error(`Invalid move in history: ${moves[i]} at index ${i}`);
        break; // Stop parsing if history is corrupted
      }
    }

    setFen(tempGame.fen());

    // Calculate Check/Checkmate square for highlighting
    let checkSquare: Square | null = null;
    if (tempGame.inCheck() || tempGame.isCheckmate()) {
      const board = tempGame.board();
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = board[r][c];
          if (piece && piece.type === 'k' && piece.color === tempGame.turn()) {
            checkSquare = piece.square as Square;
          }
        }
      }
    }
    setInCheckSquare(checkSquare);

  }, [currentMoveIndex, moves]);

  // --- Playback Controls ---
  const handleStart = () => setCurrentMoveIndex(0);
  const handlePrev = () => setCurrentMoveIndex(prev => Math.max(0, prev - 1));
  const handleNext = () => setCurrentMoveIndex(prev => Math.min(moves.length, prev + 1));
  const handleEnd = () => setCurrentMoveIndex(moves.length);
  
  // Prevent manual moves on the board during replay
  const handleBoardMove = () => {
    return false; // No-op: cannot play moves during a replay
  };

  // Prepare grouped moves for the UI Log
  const groupedMoves = [];
  for (let i = 0; i < moves.length; i += 2) {
    groupedMoves.push({
      white: moves[i],
      black: moves[i + 1] || '-',
      whiteIndex: i + 1,
      blackIndex: i + 2
    });
  }

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-md fade-slide-up">
        <Loader2 className="w-12 h-12 text-tertiary animate-spin" />
        <p className="font-label-caps text-on-surface-variant tracking-widest text-[10px] animate-pulse">RECONSTRUCTING TIMELINE...</p>
      </div>
    );
  }

  if (error || !matchData) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-center gap-md fade-slide-up">
        <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center border border-error/20 mb-sm">
           <span className="text-error font-display-lg text-3xl">!</span>
        </div>
        <h2 className="text-error font-title-md text-2xl">{error || "Something went wrong"}</h2>
        <button 
          onClick={() => onNavigate('history')}
          className="mt-md px-lg py-sm bg-surface-variant hover:bg-surface-container-high text-primary rounded transition-colors flex items-center gap-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to History
        </button>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col xl:flex-row gap-xl max-w-container-max mx-auto fade-slide-up">
      
      {/* Left Area: Board & Match Info */}
      <div className="flex-1 flex flex-col gap-lg max-w-[800px] mx-auto w-full">
        
        {/* Header Ribbon */}
        <div className="flex items-center gap-md mb-xs">
          <button 
            onClick={() => onNavigate('history')}
            className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-variant text-on-surface-variant hover:text-primary transition-colors border border-white/5 active:scale-95"
            title="Back to History"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="font-display-lg text-2xl text-primary flex items-center gap-sm">
              Match Replay
              <span className="font-label-caps text-[10px] tracking-widest text-tertiary/70 bg-tertiary/5 px-2 py-0.5 rounded border border-tertiary/10 translate-y-[-2px]">
                {matchData.status.toUpperCase()}
              </span>
            </h2>
            <p className="font-mono-stats text-[10px] text-on-surface-variant/50 uppercase tracking-widest">
              ID: {matchId}
            </p>
          </div>
        </div>

        {/* Top Player (Black typically) */}
        <div className="glass-panel rounded-xl p-md flex justify-between items-center opacity-80 border-b border-transparent">
          <div className="flex items-center gap-md">
            <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center border border-white/10">
              {matchData.type === 'ai_match' ? <Bot className="text-primary w-5 h-5" /> : <Users className="text-primary w-5 h-5" />}
            </div>
            <div>
              <div className="font-title-md text-primary">
                {matchData.type === 'ai_match' ? `Stockfish AI (Lv.${matchData.ai_level})` : 'Guest Player'}
              </div>
              <div className="font-label-caps text-[10px] text-on-surface-variant">Black Pieces</div>
            </div>
          </div>
          {matchData.winner === 'Black' || matchData.winner === 'Stockfish AI' ? (
            <Trophy className="w-5 h-5 text-tertiary" />
          ) : null}
        </div>

        {/* Replay Board */}
        <div className="relative w-full max-w-[800px] mx-auto">
          <ChessBoard 
            fen={fen} 
            onMove={handleBoardMove} 
            flipped={false} 
            inCheckSquare={inCheckSquare}
          />
        </div>

        {/* Bottom Player (White typically) */}
        <div className="glass-panel rounded-xl p-md flex justify-between items-center opacity-80 border-b border-transparent">
          <div className="flex items-center gap-md">
            <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center border border-white/10">
               <Users className="text-primary w-5 h-5" />
            </div>
            <div>
              <div className="font-title-md text-primary">Player 1 (You)</div>
              <div className="font-label-caps text-[10px] text-on-surface-variant">White Pieces</div>
            </div>
          </div>
          {matchData.winner === 'White' || matchData.winner === 'Player' ? (
            <Trophy className="w-5 h-5 text-tertiary" />
          ) : null}
        </div>
      </div>

      {/* Right Area: Controls & Log */}
      <aside className="w-full xl:w-[360px] flex flex-col gap-lg mt-14">
        
        {/* Playback Controls Box */}
        <div className="glass-panel rounded-xl p-lg flex flex-col items-center gap-md shadow-[0_8px_32px_rgba(0,0,0,0.5)] border-t border-white/10">
           <div className="font-mono-stats text-sm text-primary mb-xs">
              Move {currentMoveIndex} of {moves.length}
           </div>
           
           {/* Progress Bar */}
           <div className="w-full h-1.5 bg-surface-variant rounded-full overflow-hidden mb-sm">
             <div 
               className="h-full bg-tertiary transition-all duration-300 ease-out" 
               style={{ width: `${moves.length > 0 ? (currentMoveIndex / moves.length) * 100 : 0}%` }}
             />
           </div>

           {/* Buttons */}
           <div className="flex items-center justify-center gap-md w-full">
              <button 
                onClick={handleStart} 
                disabled={currentMoveIndex === 0}
                className="p-sm rounded text-on-surface-variant hover:text-primary hover:bg-surface-variant transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                title="Go to Start"
              >
                <SkipBack className="w-5 h-5" />
              </button>
              
              <button 
                onClick={handlePrev} 
                disabled={currentMoveIndex === 0}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-surface-container border border-white/10 text-primary hover:border-tertiary hover:text-tertiary transition-colors active:scale-90 disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:text-primary"
                title="Previous Move"
              >
                <ChevronLeft className="w-6 h-6 -ml-1" />
              </button>
              
              <button 
                onClick={handleNext} 
                disabled={currentMoveIndex === moves.length}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-tertiary text-on-tertiary hover:bg-tertiary-container transition-colors shadow-[0_0_15px_rgba(233,195,73,0.3)] active:scale-90 disabled:opacity-30 disabled:shadow-none"
                title="Next Move"
              >
                <ChevronRight className="w-6 h-6 ml-1" />
              </button>
              
              <button 
                onClick={handleEnd} 
                disabled={currentMoveIndex === moves.length}
                className="p-sm rounded text-on-surface-variant hover:text-primary hover:bg-surface-variant transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                title="Go to End"
              >
                <SkipForward className="w-5 h-5" />
              </button>
           </div>
        </div>

        {/* Move History Log */}
        <div className="flex-1 glass-panel rounded-xl flex flex-col overflow-hidden min-h-[400px]">
          <div className="p-md border-b border-white/10 bg-surface-container-high flex justify-between items-center">
            <h3 className="font-title-md text-primary">Match Notation</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {groupedMoves.length === 0 ? (
              <div className="p-xl text-center text-on-surface-variant font-body-sm italic">
                No moves recorded for this match.
              </div>
            ) : (
              <div className="flex flex-col">
                <div className="grid grid-cols-[40px_1fr_1fr] px-md py-sm text-on-surface-variant/50 font-label-caps text-[10px]">
                  <div className="text-center">#</div>
                  <div className="text-center">White</div>
                  <div className="text-center">Black</div>
                </div>

                {groupedMoves.map((m, index) => {
                  const isWhiteActive = currentMoveIndex === m.whiteIndex;
                  const isBlackActive = currentMoveIndex === m.blackIndex;
                  
                  return (
                    <div key={index} className={`grid grid-cols-[40px_1fr_1fr] text-center font-mono-stats text-body-sm ${index % 2 === 0 ? 'bg-surface-container' : 'bg-surface-container-high'} border-l-2 border-transparent`}>
                      <div className="p-sm text-on-surface-variant/50 border-r border-white/5">{index + 1}</div>
                      
                      <div 
                        onClick={() => setCurrentMoveIndex(m.whiteIndex)}
                        className={`p-sm cursor-pointer transition-colors ${
                          isWhiteActive 
                            ? 'text-on-tertiary bg-tertiary font-bold shadow-[inset_0_0_10px_rgba(0,0,0,0.2)]' 
                            : currentMoveIndex >= m.whiteIndex ? 'text-primary hover:text-tertiary hover:bg-surface-variant' : 'text-on-surface-variant/40 hover:text-primary'
                        }`}
                      >
                        {m.white}
                      </div>
                      
                      <div 
                        onClick={() => m.black !== '-' && setCurrentMoveIndex(m.blackIndex)}
                        className={`p-sm transition-colors ${m.black !== '-' ? 'cursor-pointer' : ''} ${
                          isBlackActive 
                            ? 'text-on-tertiary bg-tertiary font-bold shadow-[inset_0_0_10px_rgba(0,0,0,0.2)]' 
                            : currentMoveIndex >= m.blackIndex ? 'text-primary hover:text-tertiary hover:bg-surface-variant' : 'text-on-surface-variant/40 hover:text-primary'
                        }`}
                      >
                        {m.black}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </aside>
    </div>
  );
};
