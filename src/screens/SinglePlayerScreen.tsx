// /home/aquaax19/Workspace/Projects/Chess/grandmaster-chess/src/screens/SinglePlayerScreen.tsx

import React, { useState, useEffect } from 'react';
import { 
  Bot, UserCircle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Crown, Loader2, Search, Trophy, Star, Pause, Play, Undo2, RotateCcw, AlertCircle
} from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { collection, setDoc, getDocs, doc, updateDoc, increment, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { Chess } from 'chess.js';
import type { Square, Move } from 'chess.js';
import { db, appId } from '../config/firebase';
import { useChessGame } from '../hooks/useChessGame';
import { ChessBoard } from '../components/chess/ChessBoard';

interface SinglePlayerScreenProps {
  user: FirebaseUser | null;
}

const AI_LEVEL_NAMES = ['Novice', 'Amateur', 'Intermediate', 'Expert', 'Grandmaster'];

// Utility to format seconds into MM:SS
const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// --- Custom AI Engine Logic (Minimax with Alpha-Beta Pruning) ---
const evaluateBoard = (chess: Chess, usePosition: boolean) => {
  const board = chess.board();
  let value = 0;
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const p = board[i][j];
      if (p) {
        let pVal = 0;
        switch(p.type) {
          case 'p': pVal = 10; break;
          case 'n': pVal = 30; break;
          case 'b': pVal = 30; break;
          case 'r': pVal = 50; break;
          case 'q': pVal = 90; break;
          case 'k': pVal = 900; break;
        }
        // Grandmaster positional awareness (control the center)
        if (usePosition) {
          if (i >= 3 && i <= 4 && j >= 3 && j <= 4) pVal += 2;
        }
        value += (p.color === 'w' ? pVal : -pVal);
      }
    }
  }
  return value;
};

const getBestMove = (gameFen: string, level: number): Move | null => {
  const g = new Chess(gameFen);
  const moves = g.moves({ verbose: true }) as Move[];
  if (moves.length === 0) return null;

  // Level 1: Novice (Random Moves)
  if (level === 1) return moves[Math.floor(Math.random() * moves.length)];

  let bestMove: Move | null = null;
  let bestValue = 9999; // AI is Black, trying to minimize White's score
  
  // Set depth based on level (L2: Depth 1, L3: Depth 2, L4/L5: Depth 3)
  let depth = level === 2 ? 1 : level === 3 ? 2 : 3;

  const minimax = (gCopy: Chess, d: number, alpha: number, beta: number, isMax: boolean): number => {
    if (d === 0 || gCopy.isGameOver()) return evaluateBoard(gCopy, level === 5);
    const possMoves = gCopy.moves();
    
    if (isMax) {
      let maxVal = -9999;
      for (let m of possMoves) {
        gCopy.move(m);
        maxVal = Math.max(maxVal, minimax(gCopy, d - 1, alpha, beta, !isMax));
        gCopy.undo();
        alpha = Math.max(alpha, maxVal);
        if (beta <= alpha) break;
      }
      return maxVal;
    } else {
      let minVal = 9999;
      for (let m of possMoves) {
        gCopy.move(m);
        minVal = Math.min(minVal, minimax(gCopy, d - 1, alpha, beta, !isMax));
        gCopy.undo();
        beta = Math.min(beta, minVal);
        if (beta <= alpha) break;
      }
      return minVal;
    }
  };

  for (let m of moves) {
    g.move(m);
    const boardVal = minimax(g, depth - 1, -10000, 10000, true);
    g.undo();
    
    if (boardVal < bestValue) {
      bestValue = boardVal;
      bestMove = m;
    }
  }
  
  return bestMove || moves[Math.floor(Math.random() * moves.length)];
};

export const SinglePlayerScreen: React.FC<SinglePlayerScreenProps> = ({ user }) => {
  const { 
    game, 
    fen, 
    moveHistory, 
    makeMove, 
    undoMove,
    turn, 
    isGameOver, 
    isCheckmate, 
    inCheckSquare,
    resetGame,
    whiteTime,
    blackTime,
    matchId, // Extracted the live match ID
    isPaused,
    togglePause,
    loadGame // Smart Resume function
  } = useChessGame() as any;
  
  const [aiLevel, setAiLevel] = useState<number>(3); // Default to Intermediate
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [matchSaved, setMatchSaved] = useState(false);
  const [previewMoveSquare, setPreviewMoveSquare] = useState<Square | null>(null);
  
  // Progression UI State
  const [xpEarned, setXpEarned] = useState(0);
  const [medalsEarned, setMedalsEarned] = useState<string[]>([]);

  // New States for Blocker & Resuming
  const [isResuming, setIsResuming] = useState(true);
  const [showBlockWarning, setShowBlockWarning] = useState(false);

  const groupedMoves = [];
  for (let i = 0; i < moveHistory.length; i += 2) {
    groupedMoves.push({
      white: moveHistory[i].san,
      black: moveHistory[i + 1]?.san || '-',
      whiteMove: moveHistory[i],
      blackMove: moveHistory[i + 1]
    });
  }

  // --- 1. SMART RESUME EFFECT ---
  useEffect(() => {
    const fetchOngoingMatch = async () => {
      if (!user) {
        setIsResuming(false);
        return;
      }
      try {
        const matchesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'matches');
        const snapshot = await getDocs(matchesRef);
        
        let latestOngoing: any = null;
        let maxTime = 0;

        // Find the most recent ongoing AI match
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.type === 'ai_match' && data.status === 'ongoing') {
            const time = data.lastUpdated?.toMillis?.() || 0;
            if (time > maxTime) {
              maxTime = time;
              latestOngoing = data;
            }
          }
        });

        // If an ongoing match is found, load its exact state into the engine
        if (latestOngoing && loadGame) {
          loadGame(latestOngoing.moves, latestOngoing.id, latestOngoing.whiteTime, latestOngoing.blackTime);
          if (latestOngoing.ai_level) {
            setAiLevel(latestOngoing.ai_level); // Restore exact difficulty tier
          }
          // Auto-pause it so the user can orient themselves before timers/AI resume
          if (!isPaused) togglePause();
        }
      } catch (e) {
        console.error("Error fetching ongoing AI match", e);
      } finally {
        setIsResuming(false);
      }
    };

    fetchOngoingMatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // --- 2. NAVIGATION BLOCKER EFFECT ---
  useEffect(() => {
    const handleNavClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // If clicking on the sidebar/bottom nav AND game is active AND not paused
      if (target.closest('nav') && !isPaused && !isCheckmate && moveHistory.length > 0) {
        e.stopPropagation(); 
        e.preventDefault();
        setShowBlockWarning(true);
        setTimeout(() => setShowBlockWarning(false), 3000);
      }
    };

    document.addEventListener('click', handleNavClick, true);
    return () => document.removeEventListener('click', handleNavClick, true);
  }, [isPaused, isCheckmate, moveHistory.length]);

  // --- 3. Trigger AI Move ---
  useEffect(() => {
    // Block AI from thinking or making moves if paused or resuming
    if (turn === 'b' && !isGameOver && !isPaused && !isResuming) {
      setIsAiThinking(true);
      
      const timer = setTimeout(() => {
        const bestMove = getBestMove(game.fen(), aiLevel);
        if (bestMove) {
          makeMove(bestMove.from, bestMove.to, bestMove.promotion);
        }
        setIsAiThinking(false);
      }, 150); 

      return () => clearTimeout(timer);
    }
  }, [turn, isGameOver, game, makeMove, aiLevel, isPaused, isResuming]);

  // --- 4. LIVE SYNC EFFECT ---
  useEffect(() => {
    if (!user || moveHistory.length === 0 || isResuming) return;

    const liveSyncMatch = async () => {
      try {
        const matchRef = doc(db, 'artifacts', appId, 'users', user.uid, 'matches', matchId);
        const playerWon = turn === 'b'; 

        await setDoc(matchRef, {
          id: matchId,
          type: 'ai_match',
          ai_level: aiLevel,
          status: isCheckmate ? 'completed' : 'ongoing',
          winner: isCheckmate ? (playerWon ? 'Player' : 'Stockfish AI') : null,
          moves: moveHistory.map((m: any) => m.san),
          whiteTime: whiteTime,
          blackTime: blackTime,
          lastUpdated: serverTimestamp()
        }, { merge: true });
        
      } catch (e) { 
        console.error("Failed to live-sync AI match", e); 
      }
    };

    liveSyncMatch();
  }, [moveHistory, isCheckmate, turn, user, matchId, aiLevel, whiteTime, blackTime, isResuming]);

  // --- 5. Campaign Progression (XP & Medals) Only on Checkmate ---
  useEffect(() => {
    if (isCheckmate && !matchSaved && user) {
      const saveProgression = async () => {
        try {
          const playerWon = turn === 'b'; 

          // Process XP and Medals
          if (playerWon) {
            const earned = aiLevel * 150; 
            setXpEarned(earned);

            const newMedals = [];
            if (aiLevel === 1) newMedals.push('First Blood');
            if (aiLevel === 5) newMedals.push('Grandmaster Slayer');

            if (newMedals.length > 0) setMedalsEarned(newMedals);

            const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
            await updateDoc(profileRef, {
              xp: increment(earned),
              wins: increment(1),
              ...(newMedals.length > 0 && { medals: arrayUnion(...newMedals) })
            });
          } else {
            setXpEarned(25); 
            const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
            await updateDoc(profileRef, { xp: increment(25) });
          }

          setMatchSaved(true);
        } catch (e) { 
          console.error("Failed to save progression", e); 
        }
      };
      saveProgression();
    }
  }, [isCheckmate, matchSaved, user, turn, aiLevel]);

  const handleResetGame = () => {
    resetGame();
    setMatchSaved(false); 
    setXpEarned(0);
    setMedalsEarned([]);
  };

  const handlePreviewMove = (targetSquare: string) => {
    setPreviewMoveSquare(targetSquare as Square);
    setTimeout(() => setPreviewMoveSquare(null), 1500);
  };

  const handlePreviewLastMove = () => {
    if (moveHistory.length === 0) return;
    const lastMove = moveHistory[moveHistory.length - 1];
    handlePreviewMove(lastMove.to);
  };

  // Show loading screen while reconstructing timeline
  if (isResuming) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-md fade-slide-up">
        <Loader2 className="w-12 h-12 text-tertiary animate-spin" />
        <p className="font-label-caps text-on-surface-variant tracking-widest text-[10px] animate-pulse">RECOVERING CAMPAIGN DATA...</p>
      </div>
    );
  }

  return (
    <>
      {/* Navigation Blocker Toast Alert */}
      {showBlockWarning && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] bg-error text-on-error px-xl py-md rounded-full shadow-[0_10px_40px_rgba(255,180,171,0.3)] font-title-md flex items-center gap-md animate-in slide-in-from-top-4 fade-in">
           <AlertCircle className="w-6 h-6" /> 
           Please Pause or Complete the match before leaving!
        </div>
      )}

      {/* Board Container */}
      <div className="flex-1 flex flex-col items-center justify-center min-w-0">
        
        {/* Opponent Info (AI) */}
        <div className="w-full max-w-[600px] flex justify-between items-center mb-md px-sm">
          <div className="flex items-center gap-md">
            <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center relative overflow-hidden border border-white/10">
              <Bot className={`text-primary w-5 h-5 transition-transform duration-500 ${isAiThinking ? 'scale-110 text-tertiary' : ''}`} />
              {isAiThinking && <div className="absolute inset-0 bg-tertiary/10 animate-pulse" />}
            </div>
            <div>
              <div className="flex items-center gap-sm">
                <h2 className="font-title-md text-title-md text-primary">Stockfish AI</h2>
                <span className="bg-surface-variant text-on-surface-variant font-label-caps text-label-caps px-2 py-1 rounded tracking-widest text-[10px]">
                  Lv. {aiLevel}
                </span>
                {isAiThinking && (
                  <div className="flex items-center gap-2 text-tertiary font-label-caps text-[10px] tracking-widest animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    THINKING
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className={`font-mono-stats text-mono-stats px-md py-sm glass-panel rounded border transition-all duration-300 ${turn === 'b' && !isGameOver && !isPaused ? 'text-tertiary border-tertiary/50 animate-pulse shadow-[0_0_15px_rgba(233,195,73,0.2)]' : 'text-on-surface-variant border-transparent'}`}>
            {formatTime(blackTime ?? 600)}
          </div>
        </div>

        {/* The Board with Relative Wrapper for Overlays */}
        <div className="relative w-full max-w-[600px] mx-auto">
          <ChessBoard 
            fen={fen} 
            onMove={makeMove} 
            flipped={false} 
            inCheckSquare={inCheckSquare} 
            previewMoveSquare={previewMoveSquare}
          />

          {/* Pause Overlay */}
          {isPaused && !isCheckmate && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg border border-white/10">
              <div className="flex flex-col items-center gap-sm">
                 <Pause className="w-16 h-16 text-tertiary animate-pulse" />
                 <span className="font-label-caps text-tertiary tracking-widest uppercase">Paused</span>
                 <p className="font-body-sm text-on-surface-variant mt-2 text-center">Safe to navigate away.<br/>Your progress is saved.</p>
              </div>
            </div>
          )}
          
          {/* Checkmate / Campaign Overlay Modal */}
          {isCheckmate && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md rounded-lg border border-tertiary/30 transition-all duration-500 animate-in fade-in zoom-in-95 p-4">
              <div className="glass-panel p-lg md:p-xl rounded-2xl flex flex-col items-center text-center shadow-[0_0_50px_rgba(233,195,73,0.15)] border-t border-white/20 w-full max-w-md max-h-[90%] overflow-y-auto custom-scrollbar">
                
                {turn === 'b' ? (
                  <>
                    <Trophy className="w-16 h-16 text-tertiary mb-sm drop-shadow-[0_0_15px_rgba(233,195,73,0.5)] shrink-0" />
                    <h2 className="font-display-lg text-display-lg text-primary mb-xs">Victory!</h2>
                    <p className="font-body-lg text-on-surface-variant mb-md">You defeated the {AI_LEVEL_NAMES[aiLevel - 1]} AI.</p>
                  </>
                ) : (
                  <>
                    <Crown className="w-16 h-16 text-error mb-sm drop-shadow-[0_0_15px_rgba(255,180,171,0.5)] shrink-0" />
                    <h2 className="font-display-lg text-display-lg text-error mb-xs">Defeat</h2>
                    <p className="font-body-lg text-on-surface-variant mb-md">The AI proved too strong this time.</p>
                  </>
                )}
                
                {/* Progression Stats Display */}
                {matchSaved ? (
                  <div className="w-full bg-surface-container rounded-lg p-md mb-lg border border-white/5 flex flex-col gap-sm shrink-0">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-on-surface-variant">XP Earned</span>
                      <span className="font-mono-stats text-tertiary">+{xpEarned} XP</span>
                    </div>
                    {medalsEarned.map(medal => (
                      <div key={medal} className="flex justify-between items-center text-sm border-t border-white/5 pt-sm mt-xs">
                        <span className="text-on-surface-variant flex items-center gap-xs"><Star className="w-4 h-4 text-tertiary" /> Medal Unlocked</span>
                        <span className="font-title-md text-primary">{medal}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="w-full py-md mb-lg flex justify-center"><Loader2 className="w-6 h-6 text-tertiary animate-spin" /></div>
                )}

                <button onClick={handleResetGame} className="w-full bg-tertiary hover:bg-tertiary-container text-on-tertiary font-title-md text-title-md py-md px-xl rounded-DEFAULT transition-all duration-200 active:scale-95 shadow-[0_0_20px_rgba(233,195,73,0.3)] shrink-0">
                  Play Again
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Player Info */}
        <div className="w-full max-w-[600px] flex justify-between items-center mt-md px-sm">
          <div className="flex items-center gap-md">
            <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center border border-white/10">
              <UserCircle className="text-primary w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-sm">
                <h2 className="font-title-md text-title-md text-primary">Player</h2>
              </div>
            </div>
          </div>
          <div className={`font-mono-stats text-mono-stats px-md py-sm glass-panel rounded border transition-all duration-300 ${turn === 'w' && !isGameOver && !isPaused ? 'text-tertiary border-tertiary/50 animate-pulse shadow-[0_0_15px_rgba(233,195,73,0.2)]' : 'text-on-surface-variant border-transparent'}`}>
            {formatTime(whiteTime ?? 600)}
          </div>
        </div>
      </div>

      {/* Sidebar / Tools Area */}
      <aside className="w-full xl:w-[400px] flex flex-col gap-lg">
        
        {/* Minimalist Controls */}
        <div className="glass-panel rounded-xl p-md flex justify-between items-center">
          <button onClick={togglePause} className="flex flex-col items-center gap-xs text-on-surface-variant hover:text-tertiary transition-colors active:scale-95 group" title={isPaused ? "Resume Game" : "Pause Game"}>
            {isPaused ? <Play className="w-6 h-6 text-tertiary" /> : <Pause className="w-6 h-6" />}
            <span className="font-label-caps text-[10px]">{isPaused ? 'Resume' : 'Pause'}</span>
          </button>
          
          <div className="w-px h-8 bg-white/10" />
          
          <button onClick={undoMove} className="flex flex-col items-center gap-xs text-on-surface-variant hover:text-primary transition-colors active:scale-95" title="Undo Move">
            <Undo2 className="w-6 h-6" />
            <span className="font-label-caps text-[10px]">Undo</span>
          </button>
          
          <div className="w-px h-8 bg-white/10" />
          
          <button onClick={handleResetGame} className="flex flex-col items-center gap-xs text-on-surface-variant hover:text-error transition-colors active:scale-95" title="Restart Match">
            <RotateCcw className="w-6 h-6" />
            <span className="font-label-caps text-[10px]">Restart</span>
          </button>
        </div>

        {/* AI Settings Card */}
        <div className="glass-panel rounded-lg p-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-lg opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
            <Bot className="w-24 h-24 text-tertiary" />
          </div>
          <div className="flex justify-between items-center mb-md relative z-10">
            <h3 className="font-title-md text-title-md text-primary">Campaign Tier</h3>
            <span className="font-mono-stats text-tertiary bg-surface-variant px-2 py-1 rounded text-sm border border-tertiary/10">
              Tier {aiLevel}
            </span>
          </div>
          <input 
            type="range" 
            min="1" 
            max="5" 
            value={aiLevel}
            disabled={moveHistory.length > 0} // Lock difficulty after first move
            onChange={(e) => setAiLevel(Number(e.target.value))}
            className="w-full h-2 bg-surface-variant rounded-lg appearance-none cursor-pointer accent-tertiary focus:outline-none focus:ring-2 focus:ring-tertiary/50 relative z-10 disabled:opacity-50 disabled:cursor-not-allowed" 
          />
          <div className="text-center mt-md font-title-md text-tertiary relative z-10 bg-tertiary/10 py-1 rounded border border-tertiary/20">
            {AI_LEVEL_NAMES[aiLevel - 1]}
          </div>
        </div>

        {/* Move History */}
        <div className="flex-1 glass-panel rounded-lg overflow-hidden flex flex-col min-h-[300px]">
          <div className="p-md border-b border-white/10 bg-surface-container-high flex justify-between items-center">
            <h3 className="font-title-md text-title-md text-primary flex items-center gap-sm">
              Match Log
              <button 
                onClick={handlePreviewLastMove} 
                className="text-on-surface-variant hover:text-tertiary transition-colors ml-sm p-1" 
                title="Preview Last Move"
              >
                <Search className="w-4 h-4" />
              </button>
            </h3>
            <span className="bg-surface-variant text-on-surface-variant font-label-caps text-label-caps px-2 py-1 rounded tracking-widest text-[10px]">LIVE</span>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {groupedMoves.map((move, index) => (
              <div key={index} className={`grid grid-cols-[40px_1fr_1fr] text-center font-mono-stats text-body-sm ${index % 2 === 0 ? 'bg-surface-container' : 'bg-surface-container-high'} border-l-2 ${index === groupedMoves.length - 1 ? 'border-tertiary' : 'border-transparent'}`}>
                <div className="p-sm text-on-surface-variant border-r border-white/5">{index + 1}</div>
                <div 
                  onClick={() => move.whiteMove && handlePreviewMove(move.whiteMove.to)}
                  className="p-sm text-primary hover:text-tertiary cursor-pointer transition-colors"
                  title="Preview Move"
                >
                  {move.white}
                </div>
                <div 
                  onClick={() => move.blackMove && handlePreviewMove(move.blackMove.to)}
                  className="p-sm text-on-surface-variant hover:text-tertiary cursor-pointer transition-colors"
                  title="Preview Move"
                >
                  {move.black}
                </div>
              </div>
            ))}
            
            {/* Current Turn Indicator in Log */}
            {!isCheckmate && (
              <div className="grid grid-cols-[40px_1fr_1fr] text-center font-mono-stats text-body-sm border-l-2 border-transparent">
                <div className="p-sm text-on-surface-variant border-r border-white/5">{groupedMoves.length + 1}</div>
                <div className={`p-sm transition-colors ${turn === 'w' && !isPaused ? 'text-tertiary animate-pulse' : 'text-primary'}`}>
                  {turn === 'w' ? '_' : ''}
                </div>
                <div className={`p-sm transition-colors ${turn === 'b' && !isPaused ? 'text-tertiary animate-pulse' : 'text-on-surface-variant/30'}`}>
                  {turn === 'b' ? '_' : (turn === 'w' ? '-' : '')}
                </div>
              </div>
            )}
          </div>

          <div className="p-md border-t border-white/5 bg-surface-container/50 flex flex-col gap-sm">
             <div className="text-center font-mono-stats text-[10px] text-on-surface-variant/40 tracking-widest uppercase">
                Match ID: {matchId.split('-')[0]}
             </div>
             <button onClick={handleResetGame} className="w-full py-md text-error font-title-md text-title-md rounded hover:bg-error/10 transition-colors border border-error/20 active:scale-95">
               Abandon Match
             </button>
          </div>
        </div>

      </aside>
    </>
  );
};