// /home/aquaax19/Workspace/Projects/Chess/grandmaster-chess/src/screens/OnlineMatchScreen.tsx

import React, { useState, useEffect } from 'react';
import { 
  Globe, UserCircle, Crown, Loader2, Search, 
  Pause, Play, AlertCircle, LogOut, MessageSquare 
} from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import type { Square } from 'chess.js';
import { useOnlineChess } from '../hooks/useOnlineChess';
import { ChessBoard } from '../components/chess/ChessBoard';
import type { ScreenState } from '../App';

interface OnlineMatchScreenProps {
  user: FirebaseUser | null;
  matchId: string;
  onNavigate: (s: ScreenState) => void;
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const OnlineMatchScreen: React.FC<OnlineMatchScreenProps> = ({ 
  user, 
  matchId, 
  onNavigate 
}) => {
  const {
    fen,
    moveHistory,
    matchData,
    isMyTurn,
    playerColor,
    whiteTime,
    blackTime,
    makeOnlineMove,
    togglePause,
    isGameOver,
    isCheckmate
  } = useOnlineChess(matchId, user?.uid || null);

  const [previewMoveSquare, setPreviewMoveSquare] = useState<Square | null>(null);
  const [showBlockWarning, setShowBlockWarning] = useState(false);

  // Group moves for the Match Log
  const groupedMoves = [];
  for (let i = 0; i < moveHistory.length; i += 2) {
    groupedMoves.push({
      white: moveHistory[i].san,
      black: moveHistory[i + 1]?.san || '-',
      whiteMove: moveHistory[i],
      blackMove: moveHistory[i + 1]
    });
  }

  // Prevent accidental navigation
  useEffect(() => {
    const handleNavClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('nav') && matchData?.status === 'ongoing' && !isGameOver) {
        e.stopPropagation();
        e.preventDefault();
        setShowBlockWarning(true);
        setTimeout(() => setShowBlockWarning(false), 3000);
      }
    };
    document.addEventListener('click', handleNavClick, true);
    return () => document.removeEventListener('click', handleNavClick, true);
  }, [matchData?.status, isGameOver]);

  const handlePreviewMove = (targetSquare: string) => {
    setPreviewMoveSquare(targetSquare as Square);
    setTimeout(() => setPreviewMoveSquare(null), 1500);
  };

  if (!matchData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-md">
        <Loader2 className="w-12 h-12 text-tertiary animate-spin" />
        <p className="font-label-caps text-on-surface-variant tracking-widest text-[10px]">CONNECTING TO SERVER...</p>
      </div>
    );
  }

  const isFlipped = playerColor === 'b';
  const opponentName = playerColor === 'w' ? 'Opponent (Black)' : 'Opponent (White)';
  const currentTurnLabel = (matchData.turn === 'w' ? 'White' : 'Black') + "'s Turn";

  return (
    <>
      {showBlockWarning && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] bg-error text-on-error px-xl py-md rounded-full shadow-2xl font-title-md flex items-center gap-md animate-in slide-in-from-top-4 fade-in">
           <AlertCircle className="w-6 h-6" /> 
           Resign or finish the match before leaving!
        </div>
      )}

      {/* Main Game Area */}
      <div className="flex-1 flex flex-col items-center justify-center min-w-0 gap-md">
        
        {/* Opponent UI */}
        <div className="w-full max-w-[600px] flex justify-between items-center px-sm">
          <div className="flex items-center gap-md">
            <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center border border-white/10 relative">
              <UserCircle className="text-on-surface-variant w-6 h-6" />
              {matchData.status === 'ongoing' && matchData.turn !== playerColor && (
                <div className="absolute inset-0 border-2 border-tertiary rounded-full animate-ping" />
              )}
            </div>
            <div>
              <h2 className="font-title-md text-primary">{opponentName}</h2>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-[10px] text-on-surface-variant font-label-caps tracking-widest uppercase">Online</span>
              </div>
            </div>
          </div>
          <div className={`font-mono-stats text-mono-stats px-md py-sm glass-panel rounded border transition-all ${matchData.turn !== playerColor ? 'text-tertiary border-tertiary/50 shadow-[0_0_15px_rgba(233,195,73,0.2)]' : 'text-on-surface-variant border-transparent'}`}>
            {formatTime(playerColor === 'w' ? blackTime : whiteTime)}
          </div>
        </div>

        {/* Board Container */}
        <div className="relative w-full max-w-[600px] mx-auto">
          <ChessBoard 
            fen={fen} 
            onMove={makeOnlineMove} 
            flipped={isFlipped}
            previewMoveSquare={previewMoveSquare}
          />

          {/* Status Overlays */}
          {matchData.status === 'waiting' && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-background/80 backdrop-blur-md rounded-lg border border-white/10 text-center p-xl">
               <Globe className="w-16 h-16 text-primary mb-md animate-pulse" />
               <h3 className="font-display-lg text-3xl text-primary mb-sm">Waiting for Opponent</h3>
               <p className="text-on-surface-variant text-sm max-w-xs">Send your Match ID or Invite Link to a friend to begin the ranked duel.</p>
            </div>
          )}

          {matchData.status === 'paused' && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg">
              <div className="flex flex-col items-center gap-sm">
                 <Pause className="w-16 h-16 text-tertiary animate-pulse" />
                 <span className="font-label-caps text-tertiary tracking-widest uppercase">Match Paused</span>
              </div>
            </div>
          )}

          {isCheckmate && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md rounded-lg p-4">
              <div className="glass-panel p-xl rounded-2xl flex flex-col items-center text-center shadow-2xl border-t border-white/20 max-w-sm">
                <Crown className="w-16 h-16 text-tertiary mb-sm drop-shadow-[0_0_15px_rgba(233,195,73,0.5)]" />
                <h2 className="font-display-lg text-4xl text-primary mb-sm">Checkmate</h2>
                <p className="font-body-lg text-on-surface-variant mb-xl">
                  Match Concluded. Result has been recorded in the global archives.
                </p>
                <button onClick={() => onNavigate('history')} className="w-full bg-tertiary text-on-tertiary font-title-md py-md rounded-lg active:scale-95 transition-transform">
                  View Results
                </button>
              </div>
            </div>
          )}
        </div>

        {/* My Profile UI */}
        <div className="w-full max-w-[600px] flex justify-between items-center px-sm">
          <div className="flex items-center gap-md">
            <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center border border-white/10">
              <UserCircle className="text-primary w-6 h-6" />
            </div>
            <div>
              <h2 className="font-title-md text-primary">You</h2>
              <div className="font-label-caps text-[10px] text-tertiary tracking-widest">{playerColor === 'w' ? 'WHITE' : 'BLACK'}</div>
            </div>
          </div>
          <div className={`font-mono-stats text-mono-stats px-md py-sm glass-panel rounded border transition-all ${isMyTurn ? 'text-tertiary border-tertiary/50 animate-pulse shadow-[0_0_15px_rgba(233,195,73,0.2)]' : 'text-on-surface-variant border-transparent'}`}>
            {formatTime(playerColor === 'w' ? whiteTime : blackTime)}
          </div>
        </div>
      </div>

      {/* Tools Sidebar */}
      <aside className="w-full xl:w-[320px] flex flex-col gap-lg mt-14">
        
        {/* Controls */}
        <div className="glass-panel rounded-xl p-md flex justify-between items-center">
          <button onClick={togglePause} className="flex flex-col items-center gap-xs text-on-surface-variant hover:text-tertiary transition-colors active:scale-95">
            {matchData.status === 'paused' ? <Play className="w-6 h-6 text-tertiary" /> : <Pause className="w-6 h-6" />}
            <span className="font-label-caps text-[10px]">{matchData.status === 'paused' ? 'Resume' : 'Pause'}</span>
          </button>
          <div className="w-px h-8 bg-white/10" />
          <button className="flex flex-col items-center gap-xs text-on-surface-variant hover:text-primary transition-colors">
            <MessageSquare className="w-6 h-6" />
            <span className="font-label-caps text-[10px]">Chat</span>
          </button>
          <div className="w-px h-8 bg-white/10" />
          <button onClick={() => onNavigate('home')} className="flex flex-col items-center gap-xs text-on-surface-variant hover:text-error transition-colors">
            <LogOut className="w-6 h-6" />
            <span className="font-label-caps text-[10px]">Resign</span>
          </button>
        </div>

        {/* Match Log */}
        <div className="flex-1 glass-panel rounded-xl flex flex-col overflow-hidden min-h-[400px]">
          <div className="p-md border-b border-white/5 flex justify-between items-center bg-surface-container-high/50">
            <h3 className="font-title-md text-primary">Live Match Log</h3>
            <span className="text-[10px] text-tertiary animate-pulse font-label-caps tracking-widest">LIVE</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-sm custom-scrollbar font-mono-stats text-xs">
            <div className="grid grid-cols-[30px_1fr_1fr] px-md py-sm text-on-surface-variant/40 font-label-caps text-[10px]">
              <div>#</div><div>White</div><div>Black</div>
            </div>
            {groupedMoves.map((m, index) => (
              <div key={index} className="grid grid-cols-[30px_1fr_1fr] px-md py-sm rounded hover:bg-surface-variant/30 transition-colors">
                <div className="text-on-surface-variant/50">{index + 1}.</div>
                <div className="text-primary">{m.white}</div>
                <div className="text-primary">{m.black}</div>
              </div>
            ))}
            {!isGameOver && (
               <div className="flex justify-center p-md text-[10px] text-tertiary/50 tracking-widest animate-pulse font-label-caps">
                 {currentTurnLabel}
               </div>
            )}
          </div>
          
          <div className="p-md border-t border-white/5 text-center">
             <div className="text-[10px] text-on-surface-variant/30 tracking-tighter uppercase font-mono-stats">
               Public Match Key: {matchId}
             </div>
          </div>
        </div>
      </aside>
    </>
  );
};