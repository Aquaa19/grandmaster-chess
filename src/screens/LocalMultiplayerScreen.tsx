// /home/aquaax19/Workspace/Projects/Chess/grandmaster-chess/src/screens/LocalMultiplayerScreen.tsx

import React, { useState, useEffect } from 'react';
import { Users, FlipVertical, Undo2, RotateCcw, Crown, Search, Pause, Play, Loader2, AlertCircle } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';
import type { Square } from 'chess.js';
import { db, appId } from '../config/firebase';
import { useChessGame } from '../hooks/useChessGame';
import { ChessBoard } from '../components/chess/ChessBoard';

interface LocalMultiplayerScreenProps {
  user: FirebaseUser | null;
}

// Utility to format seconds into MM:SS
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
    loadGame // Added this to hook destructuring (Will implement in next step)
  } = useChessGame() as any; // Temporary 'any' until we update the hook types
  
  const [isFlipped, setIsFlipped] = useState(false);
  const [matchSaved, setMatchSaved] = useState(false);
  const [previewMoveSquare, setPreviewMoveSquare] = useState<Square | null>(null);
  
  // New States for Blocker & Resuming
  const [isResuming, setIsResuming] = useState(true);
  const [showBlockWarning, setShowBlockWarning] = useState(false);

  // Group moves into pairs (White, Black) and keep raw move data for previewing
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

        // Find the most recent ongoing local match
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

        // If an ongoing match is found, load its exact state into the engine
        if (latestOngoing && loadGame) {
          loadGame(latestOngoing.moves, latestOngoing.id, latestOngoing.whiteTime, latestOngoing.blackTime);
          // Auto-pause it so the user can orient themselves before timers resume
          if (!isPaused) togglePause();
        }
      } catch (e) {
        console.error("Error fetching ongoing match", e);
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
        e.stopPropagation(); // Stop the click from reaching the navigation buttons
        e.preventDefault();
        setShowBlockWarning(true);
        setTimeout(() => setShowBlockWarning(false), 3000);
      }
    };

    // Attach to capture phase so we intercept before the button's onClick fires
    document.addEventListener('click', handleNavClick, true);
    return () => document.removeEventListener('click', handleNavClick, true);
  }, [isPaused, isCheckmate, moveHistory.length]);

  // --- 3. LIVE SYNC EFFECT (Updated to save times) ---
  useEffect(() => {
    // Don't sync if we are currently loading the old match state
    if (!user || moveHistory.length === 0 || isResuming) return; 

    const liveSyncMatch = async () => {
      try {
        const matchRef = doc(db, 'artifacts', appId, 'users', user.uid, 'matches', matchId);
        
        await setDoc(matchRef, {
          id: matchId,
          type: 'local',
          status: isCheckmate ? 'completed' : 'ongoing',
          winner: isCheckmate ? (turn === 'w' ? 'Black' : 'White') : null,
          moves: moveHistory.map((m: any) => m.san),
          whiteTime: whiteTime, // Save exact clock times
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
  }, [moveHistory, isCheckmate, turn, user, matchId, whiteTime, blackTime, isResuming]);

  const handleResetGame = () => {
    resetGame();
    setMatchSaved(false); 
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

  // Show loading screen while reconstructing timeline
  if (isResuming) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-md fade-slide-up">
        <Loader2 className="w-12 h-12 text-tertiary animate-spin" />
        <p className="font-label-caps text-on-surface-variant tracking-widest text-[10px] animate-pulse">RECOVERING MATCH STATE...</p>
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

      {/* Left/Top Panel: Player 2, Board, Player 1 */}
      <div className="flex-1 flex flex-col gap-lg max-w-[800px] mx-auto w-full">
        
        {/* Top Player Profile (Black) */}
        <div className={`glass-panel rounded-xl p-md flex justify-between items-center opacity-80 transition-all duration-300 ${turn === 'b' ? 'border-b-2 border-b-tertiary opacity-100 shadow-[0_4px_20px_rgba(233,195,73,0.1)]' : ''}`}>
          <div className="flex items-center gap-md">
            <div className="w-12 h-12 rounded-full bg-surface-variant overflow-hidden border border-white/10 flex items-center justify-center">
              <Users className="text-on-surface-variant w-6 h-6" />
            </div>
            <div>
              <div className="font-title-md text-title-md text-primary">Guest Player</div>
              <div className={`font-label-caps text-label-caps transition-colors ${turn === 'b' ? 'text-tertiary' : 'text-on-surface-variant'}`}>
                Black Pieces {turn === 'b' && '• Your Turn'}
              </div>
            </div>
          </div>
          <div className={`font-mono-stats text-mono-stats px-md py-sm bg-surface-container rounded-lg border transition-all duration-300 ${turn === 'b' && !isCheckmate && !isPaused ? 'text-tertiary border-tertiary/50 animate-pulse shadow-[0_0_15px_rgba(233,195,73,0.2)]' : 'text-on-surface-variant border-white/5'}`}>
            {formatTime(blackTime ?? 600)}
          </div>
        </div>

        {/* The Chessboard Container */}
        <div className="relative w-full max-w-[800px] mx-auto">
          <ChessBoard 
            fen={fen} 
            onMove={makeMove} 
            flipped={isFlipped} 
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

          {isCheckmate && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md rounded-lg border border-tertiary/30 transition-all duration-500 animate-in fade-in zoom-in-95 p-4">
              <div className="glass-panel p-lg md:p-xl rounded-2xl flex flex-col items-center text-center shadow-[0_0_50px_rgba(233,195,73,0.15)] border-t border-white/20 w-full max-w-md max-h-[90%] overflow-y-auto custom-scrollbar">
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

        {/* Bottom Player Profile (White) */}
        <div className={`glass-panel rounded-xl p-md flex justify-between items-center transition-all duration-300 ${turn === 'w' ? 'border-b-2 border-b-tertiary opacity-100 shadow-[0_4px_20px_rgba(233,195,73,0.1)]' : 'opacity-80'}`}>
          <div className="flex items-center gap-md">
            <div className={`w-12 h-12 rounded-full bg-surface-variant overflow-hidden border ${turn === 'w' ? 'border-tertiary/50' : 'border-white/10'} flex items-center justify-center`}>
              <Users className="text-primary w-6 h-6" />
            </div>
            <div>
              <div className="font-title-md text-title-md text-primary">Player 1</div>
              <div className={`font-label-caps text-label-caps transition-colors ${turn === 'w' ? 'text-tertiary' : 'text-on-surface-variant'}`}>
                White Pieces {turn === 'w' && '• Your Turn'}
              </div>
            </div>
          </div>
          <div className={`font-mono-stats text-mono-stats px-md py-sm bg-surface-container rounded-lg border transition-all duration-300 ${turn === 'w' && !isCheckmate && !isPaused ? 'text-tertiary border-tertiary/50 animate-pulse shadow-[0_0_15px_rgba(233,195,73,0.2)]' : 'text-on-surface-variant border-white/5'}`}>
            {formatTime(whiteTime ?? 600)}
          </div>
        </div>
      </div>

      {/* Right Panel: Controls & Move History */}
      <div className="w-full xl:w-[320px] flex flex-col gap-lg">
        
        {/* Minimalist Controls */}
        <div className="glass-panel rounded-xl p-md flex justify-between items-center">
          <button onClick={togglePause} className="flex flex-col items-center gap-xs text-on-surface-variant hover:text-tertiary transition-colors active:scale-95 group" title={isPaused ? "Resume Game" : "Pause Game"}>
            {isPaused ? <Play className="w-6 h-6 text-tertiary" /> : <Pause className="w-6 h-6" />}
            <span className="font-label-caps text-[10px]">{isPaused ? 'Resume' : 'Pause'}</span>
          </button>
          
          <div className="w-px h-8 bg-white/10" />

          <button onClick={() => setIsFlipped(!isFlipped)} className="flex flex-col items-center gap-xs text-on-surface-variant hover:text-primary transition-colors active:scale-95 group" title="Flip Board">
            <FlipVertical className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500" />
            <span className="font-label-caps text-[10px]">Flip</span>
          </button>
          
          <div className="w-px h-8 bg-white/10" />
          
          <button onClick={undoMove} className="flex flex-col items-center gap-xs text-on-surface-variant hover:text-primary transition-colors active:scale-95" title="Undo Move">
            <Undo2 className="w-6 h-6" />
            <span className="font-label-caps text-[10px]">Undo</span>
          </button>
          
          <div className="w-px h-8 bg-white/10" />
          
          <button onClick={previewLastMove} className="flex flex-col items-center gap-xs text-on-surface-variant hover:text-tertiary transition-colors active:scale-95" title="Preview Last Move">
            <Search className="w-6 h-6" />
            <span className="font-label-caps text-[10px]">Preview</span>
          </button>
        </div>

        {/* Move History */}
        <div className="glass-panel rounded-xl flex-1 flex flex-col overflow-hidden min-h-[300px]">
          <div className="p-md border-b border-white/5 flex justify-between items-center bg-surface-container/50">
            <h2 className="font-title-md text-title-md text-primary">Match Log</h2>
            <span className="font-label-caps text-label-caps text-on-surface-variant bg-surface-variant px-sm py-xs rounded">LIVE</span>
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
              
              {!isCheckmate && (
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
             <div className="text-center font-mono-stats text-[10px] text-on-surface-variant/40 tracking-widest uppercase">
                Match ID: {matchId.split('-')[0]}
             </div>
             <button onClick={handleResetGame} className="w-full py-md text-error font-title-md text-title-md rounded hover:bg-error/10 transition-colors border border-error/20 active:scale-95">
               Abandon Match
             </button>
          </div>
        </div>

      </div>
    </>
  );
};