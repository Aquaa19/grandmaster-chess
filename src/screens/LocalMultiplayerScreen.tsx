import React, { useState, useEffect } from 'react';
import { Users, FlipVertical, Undo2, RotateCcw, Crown, Search, Pause, Play, Loader2, AlertCircle, Settings2 } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';
import type { Square } from 'chess.js';
import { db, appId } from '../config/firebase';
import { useChessGame } from '../hooks/useChessGame';
import { ChessBoard } from '../components/chess/ChessBoard';

interface LocalMultiplayerScreenProps {
  user: FirebaseUser | null;
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const LocalMultiplayerScreen: React.FC<LocalMultiplayerScreenProps> = ({ user }) => {
  const { 
    fen, 
    moveHistory, 
    makeMove, 
    undoMove, 
    resetGame, 
    turn, 
    inCheckSquare, 
    isCheckmate,
    whiteTime,
    blackTime,
    matchId, 
    isPaused,
    togglePause,
    loadGame
  } = useChessGame() as any; 
  
  const [isFlipped, setIsFlipped] = useState(false);
  const [matchSaved, setMatchSaved] = useState(false);
  const [previewMoveSquare, setPreviewMoveSquare] = useState<Square | null>(null);
  const [customMatchName, setCustomMatchName] = useState<string>('');
  
  const [matchPhase, setMatchPhase] = useState<'loading' | 'setup' | 'playing'>('loading');
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
        setMatchPhase('setup');
        return;
      }
      try {
        const matchesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'matches');
        const snapshot = await getDocs(matchesRef);
        
        let latestOngoing: any = null;
        let maxTime = 0;

        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.type === 'local' && data.status === 'ongoing') {
            const time = data.lastUpdated?.toMillis?.() || 0;
            if (time > maxTime) {
              maxTime = time;
              latestOngoing = data;
            }
          }
        });

        if (latestOngoing && loadGame) {
          loadGame(latestOngoing.moves, latestOngoing.id, latestOngoing.whiteTime, latestOngoing.blackTime);
          if (latestOngoing.matchName) {
            setCustomMatchName(latestOngoing.matchName);
          }
          if (!isPaused) togglePause();
          setMatchPhase('playing');
        } else {
          setMatchPhase('setup');
        }
      } catch (e) {
        console.error("Error fetching ongoing match", e);
        setMatchPhase('setup');
      }
    };

    fetchOngoingMatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // --- 2. NAVIGATION BLOCKER EFFECT ---
  useEffect(() => {
    const handleNavClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('nav') && !isPaused && !isCheckmate && moveHistory.length > 0 && matchPhase === 'playing') {
        e.stopPropagation(); 
        e.preventDefault();
        setShowBlockWarning(true);
        setTimeout(() => setShowBlockWarning(false), 3000);
      }
    };

    document.addEventListener('click', handleNavClick, true);
    return () => document.removeEventListener('click', handleNavClick, true);
  }, [isPaused, isCheckmate, moveHistory.length, matchPhase]);

  // --- 3. LIVE SYNC EFFECT ---
  useEffect(() => {
    if (!user || moveHistory.length === 0 || matchPhase !== 'playing') return; 

    const liveSyncMatch = async () => {
      try {
        const matchRef = doc(db, 'artifacts', appId, 'users', user.uid, 'matches', matchId);
        
        await setDoc(matchRef, {
          id: matchId,
          type: 'local',
          matchName: customMatchName || 'Local Match',
          status: isCheckmate ? 'completed' : 'ongoing',
          winner: isCheckmate ? (turn === 'w' ? 'Black' : 'White') : null,
          moves: moveHistory.map((m: any) => m.san),
          whiteTime: whiteTime, 
          blackTime: blackTime,
          lastUpdated: serverTimestamp()
        }, { merge: true });

        if (isCheckmate) {
          setMatchSaved(true);
        }
      } catch (e) { 
        console.error("Failed to live-sync match", e); 
      }
    };

    liveSyncMatch();
  }, [moveHistory, isCheckmate, turn, user, matchId, whiteTime, blackTime, matchPhase, customMatchName]);

  // Triggered after checkmate
  const handleResetGame = () => {
    resetGame();
    setMatchSaved(false); 
    setCustomMatchName('');
    setMatchPhase('setup');
  };

  // Triggered when explicitly abandoning an ongoing match
  const handleAbandonMatch = async () => {
    if (user && matchId) {
      try {
        const matchRef = doc(db, 'artifacts', appId, 'users', user.uid, 'matches', matchId);
        await setDoc(matchRef, { 
          status: 'abandoned', 
          lastUpdated: serverTimestamp() 
        }, { merge: true });
      } catch (e) {
        console.error("Failed to abandon match", e);
      }
    }
    handleResetGame();
  };

  const handlePreviewMove = (targetSquare: string) => {
    setPreviewMoveSquare(targetSquare as Square);
    setTimeout(() => setPreviewMoveSquare(null), 1500); 
  };

  const previewLastMove = () => {
    if (moveHistory.length === 0) return;
    const lastMove = moveHistory[moveHistory.length - 1];
    handlePreviewMove(lastMove.to);
  };

  if (matchPhase === 'loading') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-md fade-slide-up">
        <Loader2 className="w-12 h-12 text-tertiary animate-spin" />
        <p className="font-label-caps text-on-surface-variant tracking-widest text-[10px] animate-pulse">RECOVERING MATCH STATE...</p>
      </div>
    );
  }

  return (
    <>
      {showBlockWarning && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] bg-error text-on-error px-xl py-md rounded-full shadow-[0_10px_40px_rgba(255,180,171,0.3)] font-title-md flex items-center gap-md animate-in slide-in-from-top-4 fade-in">
           <AlertCircle className="w-6 h-6" /> 
           Please Pause or Complete the match before leaving!
        </div>
      )}

      <div className="flex-1 flex flex-col gap-lg max-w-[800px] mx-auto w-full">
        
        <div className={`glass-panel rounded-xl p-md flex justify-between items-center opacity-80 transition-all duration-300 ${turn === 'b' && matchPhase === 'playing' ? 'border-b-2 border-b-tertiary opacity-100 shadow-[0_4px_20px_rgba(233,195,73,0.1)]' : ''}`}>
          <div className="flex items-center gap-md">
            <div className="w-12 h-12 rounded-full bg-surface-variant overflow-hidden border border-white/10 flex items-center justify-center">
              <Users className="text-on-surface-variant w-6 h-6" />
            </div>
            <div>
              <div className="font-title-md text-title-md text-primary">Guest Player</div>
              <div className={`font-label-caps text-label-caps transition-colors ${turn === 'b' && matchPhase === 'playing' ? 'text-tertiary' : 'text-on-surface-variant'}`}>
                Black Pieces {turn === 'b' && matchPhase === 'playing' && '• Your Turn'}
              </div>
            </div>
          </div>
          <div className={`font-mono-stats text-mono-stats px-md py-sm bg-surface-container rounded-lg border transition-all duration-300 ${turn === 'b' && !isCheckmate && !isPaused && matchPhase === 'playing' ? 'text-tertiary border-tertiary/50 animate-pulse shadow-[0_0_15px_rgba(233,195,73,0.2)]' : 'text-on-surface-variant border-white/5'}`}>
            {formatTime(blackTime ?? 600)}
          </div>
        </div>

        <div className="relative w-full max-w-[800px] mx-auto">
          <ChessBoard 
            fen={fen} 
            onMove={makeMove} 
            flipped={isFlipped} 
            inCheckSquare={inCheckSquare}
            previewMoveSquare={previewMoveSquare}
          />

          {/* Setup Match Modal */}
          {matchPhase === 'setup' && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md rounded-lg p-4 animate-in zoom-in-95 duration-300 overflow-visible">
               <div className="glass-panel p-6 sm:p-8 rounded-2xl flex flex-col items-center text-center shadow-2xl border-t border-white/20 w-[90%] min-w-[320px] max-w-[448px] shrink-0">
                  <Settings2 className="w-12 h-12 text-tertiary mb-4 shrink-0" />
                  <h2 className="font-display-lg text-3xl text-primary mb-2 whitespace-nowrap shrink-0">Local Match Setup</h2>
                  <p className="text-sm text-on-surface-variant mb-6 shrink-0 w-full">Configure your over-the-board match details.</p>
                  
                  <div className="w-full space-y-5 mb-6 text-left shrink-0">
                    <div>
                      <label className="text-xs text-on-surface-variant uppercase tracking-widest font-label-caps block mb-2">Match Name (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g., Coffeehouse Blitz"
                        value={customMatchName}
                        onChange={(e) => setCustomMatchName(e.target.value)}
                        className="w-full bg-surface-container text-on-surface font-body-sm border border-white/20 rounded-lg py-3 px-4 focus:outline-none focus:border-tertiary transition-colors"
                      />
                    </div>
                  </div>

                  <button onClick={() => setMatchPhase('playing')} className="w-full bg-tertiary hover:bg-yellow-400 text-on-tertiary font-title-md py-3 rounded-lg active:scale-95 transition-all shadow-lg shadow-tertiary/20 shrink-0">
                    Start Match
                  </button>
               </div>
            </div>
          )}
          
          {isPaused && !isCheckmate && matchPhase === 'playing' && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg border border-white/10">
              <div className="flex flex-col items-center gap-sm">
                 <Pause className="w-16 h-16 text-tertiary animate-pulse" />
                 <span className="font-label-caps text-tertiary tracking-widest uppercase">Paused</span>
                 <p className="font-body-sm text-on-surface-variant mt-2 text-center">Safe to navigate away.<br/>Your progress is saved.</p>
              </div>
            </div>
          )}

          {isCheckmate && matchPhase === 'playing' && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md rounded-lg border border-tertiary/30 transition-all duration-500 animate-in fade-in zoom-in-95 p-4">
              <div className="glass-panel p-lg md:p-xl rounded-2xl flex flex-col items-center text-center shadow-[0_0_50px_rgba(233,195,73,0.15)] border-t border-white/20 w-full max-w-[448px] max-h-[90%] overflow-y-auto custom-scrollbar">
                <Crown className="w-16 h-16 text-tertiary mb-sm drop-shadow-[0_0_15px_rgba(233,195,73,0.5)] shrink-0" />
                <h2 className="font-display-lg text-display-lg text-primary mb-xs">Checkmate</h2>
                <p className="font-body-lg text-on-surface-variant mb-lg">
                  <strong className="text-primary">{turn === 'w' ? 'Black' : 'White'}</strong> has won the match.
                </p>
                {matchSaved && (
                  <p className="text-tertiary font-label-caps text-[10px] tracking-widest mb-sm animate-pulse shrink-0">
                    MATCH SYNCED
                  </p>
                )}
                <button onClick={handleResetGame} className="bg-tertiary hover:bg-tertiary-container text-on-tertiary font-title-md text-title-md py-sm px-xl rounded-DEFAULT transition-all duration-200 active:scale-95 shadow-[0_0_20px_rgba(233,195,73,0.3)] shrink-0">
                  Rematch
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={`glass-panel rounded-xl p-md flex justify-between items-center transition-all duration-300 ${turn === 'w' && matchPhase === 'playing' ? 'border-b-2 border-b-tertiary opacity-100 shadow-[0_4px_20px_rgba(233,195,73,0.1)]' : 'opacity-80'}`}>
          <div className="flex items-center gap-md">
            <div className={`w-12 h-12 rounded-full bg-surface-variant overflow-hidden border ${turn === 'w' && matchPhase === 'playing' ? 'border-tertiary/50' : 'border-white/10'} flex items-center justify-center`}>
              <Users className="text-primary w-6 h-6" />
            </div>
            <div>
              <div className="font-title-md text-title-md text-primary">Player 1</div>
              <div className={`font-label-caps text-label-caps transition-colors ${turn === 'w' && matchPhase === 'playing' ? 'text-tertiary' : 'text-on-surface-variant'}`}>
                White Pieces {turn === 'w' && matchPhase === 'playing' && '• Your Turn'}
              </div>
            </div>
          </div>
          <div className={`font-mono-stats text-mono-stats px-md py-sm bg-surface-container rounded-lg border transition-all duration-300 ${turn === 'w' && !isCheckmate && !isPaused && matchPhase === 'playing' ? 'text-tertiary border-tertiary/50 animate-pulse shadow-[0_0_15px_rgba(233,195,73,0.2)]' : 'text-on-surface-variant border-white/5'}`}>
            {formatTime(whiteTime ?? 600)}
          </div>
        </div>
      </div>

      <div className="w-full xl:w-[320px] flex flex-col gap-lg">
        
        <div className="glass-panel rounded-xl p-md flex justify-between items-center">
          <button onClick={togglePause} disabled={matchPhase === 'setup'} className="flex flex-col items-center gap-xs text-on-surface-variant hover:text-tertiary transition-colors active:scale-95 group disabled:opacity-50" title={isPaused ? "Resume Game" : "Pause Game"}>
            {isPaused ? <Play className="w-6 h-6 text-tertiary" /> : <Pause className="w-6 h-6" />}
            <span className="font-label-caps text-[10px]">{isPaused ? 'Resume' : 'Pause'}</span>
          </button>
          
          <div className="w-px h-8 bg-white/10" />

          <button onClick={() => setIsFlipped(!isFlipped)} disabled={matchPhase === 'setup'} className="flex flex-col items-center gap-xs text-on-surface-variant hover:text-primary transition-colors active:scale-95 group disabled:opacity-50" title="Flip Board">
            <FlipVertical className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500" />
            <span className="font-label-caps text-[10px]">Flip</span>
          </button>
          
          <div className="w-px h-8 bg-white/10" />
          
          <button onClick={undoMove} disabled={matchPhase === 'setup'} className="flex flex-col items-center gap-xs text-on-surface-variant hover:text-primary transition-colors active:scale-95 disabled:opacity-50" title="Undo Move">
            <Undo2 className="w-6 h-6" />
            <span className="font-label-caps text-[10px]">Undo</span>
          </button>
          
          <div className="w-px h-8 bg-white/10" />
          
          <button onClick={previewLastMove} disabled={matchPhase === 'setup'} className="flex flex-col items-center gap-xs text-on-surface-variant hover:text-tertiary transition-colors active:scale-95 disabled:opacity-50" title="Preview Last Move">
            <Search className="w-6 h-6" />
            <span className="font-label-caps text-[10px]">Preview</span>
          </button>
        </div>

        <div className="glass-panel rounded-xl flex-1 flex flex-col overflow-hidden min-h-[300px]">
          <div className="p-md border-b border-white/5 flex justify-between items-center bg-surface-container/50">
            <h2 className="font-title-md text-title-md text-primary">Match Log</h2>
            {matchPhase === 'playing' ? (
               <span className="bg-surface-variant text-on-surface-variant font-label-caps text-label-caps px-sm py-xs rounded">LIVE</span>
            ) : (
               <span className="bg-surface-variant/50 text-on-surface-variant/50 font-label-caps text-label-caps px-sm py-xs rounded">SETUP</span>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-sm font-mono-stats text-body-sm custom-scrollbar">
            <div className="grid grid-cols-[30px_1fr_1fr] px-md py-sm text-on-surface-variant/50 font-label-caps text-[10px] mb-sm">
              <div>#</div>
              <div>White</div>
              <div>Black</div>
            </div>
            
            <div className="flex flex-col">
              {groupedMoves.map((move, index) => (
                <div key={index} className={`grid grid-cols-[30px_1fr_1fr] px-md py-sm rounded transition-colors group ${index % 2 !== 0 ? 'bg-surface-container/30' : ''} hover:bg-surface-variant/50`}>
                  <div className="text-on-surface-variant/50">{index + 1}.</div>
                  <div 
                    onClick={() => move.whiteMove && handlePreviewMove(move.whiteMove.to)}
                    className="text-primary hover:text-tertiary cursor-pointer transition-colors"
                    title="Click to preview square"
                  >
                    {move.white}
                  </div>
                  <div 
                    onClick={() => move.blackMove && handlePreviewMove(move.blackMove.to)}
                    className="text-primary hover:text-tertiary cursor-pointer transition-colors"
                    title="Click to preview square"
                  >
                    {move.black}
                  </div>
                </div>
              ))}
              
              {!isCheckmate && matchPhase === 'playing' && (
                <div className="grid grid-cols-[30px_1fr_1fr] px-md py-sm hover:bg-surface-variant/50 rounded transition-colors relative mt-1">
                  <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-tertiary" />
                  <div className="text-on-surface-variant/50">{groupedMoves.length + 1}.</div>
                  <div className={`transition-colors ${turn === 'w' && !isPaused ? 'text-tertiary animate-pulse' : 'text-primary'}`}>
                    {turn === 'w' ? '_' : ''}
                  </div>
                  <div className={`transition-colors ${turn === 'b' && !isPaused ? 'text-tertiary animate-pulse' : 'text-on-surface-variant/30'}`}>
                    {turn === 'b' ? '_' : (turn === 'w' ? '-' : '')}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="p-md border-t border-white/5 bg-surface-container/50 flex flex-col gap-sm">
             {customMatchName && (
               <div className="text-center font-mono-stats text-[10px] text-tertiary tracking-widest uppercase mb-1 truncate">
                 {customMatchName}
               </div>
             )}
             <div className="text-center font-mono-stats text-[10px] text-on-surface-variant/40 tracking-widest uppercase">
                Match ID: {matchId.split('-')[0]}
             </div>
             <button onClick={handleAbandonMatch} disabled={matchPhase === 'setup'} className="w-full py-md text-error font-title-md text-title-md rounded hover:bg-error/10 transition-colors border border-error/20 active:scale-95 disabled:opacity-50">
               Abandon Match
             </button>
          </div>
        </div>

      </div>
    </>
  );
};