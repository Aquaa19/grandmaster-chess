import React, { useState, useEffect } from 'react';
import { 
  Globe, UserCircle, Crown, Loader2, 
  Pause, Play, AlertCircle, LogOut, MessageSquare, ShieldCheck
} from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';

import { useOnlineChess } from '../hooks/useOnlineChess';
import { ChessBoard } from '../components/chess/ChessBoard';
import type { BoardThemeKey, PieceThemeKey } from '../components/chess/ChessBoard';
import type { ScreenState } from '../App';

interface OnlineMatchScreenProps {
  user: FirebaseUser | null;
  matchId: string;
  onNavigate: (s: ScreenState) => void;
  boardTheme: BoardThemeKey;
  pieceTheme: PieceThemeKey;
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const OnlineMatchScreen: React.FC<OnlineMatchScreenProps> = ({ 
  user, 
  matchId, 
  onNavigate,
  boardTheme,
  pieceTheme
}) => {
  const {
    fen,
    moveHistory,
    matchData,
    isMyTurn,
    playerColor,
    opponentId,
    opponentProfile,
    hasAccepted,
    whiteTime,
    blackTime,
    makeOnlineMove,
    togglePause,
    acceptMatch,
    rejectMatch,
    resignMatch,
    isGameOver,
    isCheckmate
  } = useOnlineChess(matchId, user?.uid || null);


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



  const handleResign = async () => {
    if (window.confirm("Concede the match? You will incur a 50 XP penalty.")) {
      await resignMatch();
    }
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
  const opponentName = opponentProfile?.name || (playerColor === 'w' ? 'Opponent (Black)' : 'Opponent (White)');
  const currentTurnLabel = (matchData.turn === 'w' ? 'White' : 'Black') + "'s Turn";

  return (
    <>
      {showBlockWarning && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] bg-error text-on-error px-xl py-md rounded-full shadow-2xl font-title-md flex items-center gap-md animate-in slide-in-from-top-4 fade-in">
           <AlertCircle className="w-6 h-6" /> 
           Resign or finish the match before leaving!
        </div>
      )}

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
            previewMoveSquare={null} 
            boardTheme={boardTheme}
            pieceTheme={pieceTheme}
            lastMove={moveHistory.length > 0 ? moveHistory[moveHistory.length - 1] : null}
          />

          {/* Status Overlays */}
          {matchData.status === 'pending' && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md rounded-lg p-4 animate-in zoom-in-95 duration-300 overflow-visible">
               <div className="glass-panel p-6 sm:p-8 rounded-2xl flex flex-col items-center text-center shadow-2xl border-t border-white/20 w-[90%] min-w-[320px] max-w-[448px] shrink-0">
                  <ShieldCheck className="w-12 h-12 text-tertiary mb-4 shrink-0" />
                  <h2 className="font-display-lg text-3xl text-primary mb-6 whitespace-nowrap shrink-0">Match Found</h2>
                  
                  {opponentProfile ? (
                    <div className="bg-surface-variant/50 p-4 rounded-xl mb-6 w-full text-left border border-white/5 shrink-0">
                      <div className="flex items-center gap-3 mb-2">
                         <UserCircle className="w-8 h-8 text-tertiary shrink-0" />
                         <div className="overflow-hidden">
                           <div className="font-title-md text-primary truncate whitespace-nowrap">{opponentProfile.name || 'Anonymous Player'}</div>
                           <div className="text-[10px] text-on-surface-variant font-mono tracking-widest whitespace-nowrap">UID: {opponentId?.slice(0,8)}...</div>
                         </div>
                      </div>
                      <div className="flex justify-between items-center text-sm border-t border-white/10 pt-2 mt-2">
                         <span className="text-on-surface-variant font-label-caps tracking-widest text-[10px] whitespace-nowrap">Time Control</span>
                         <span className="font-mono-stats text-tertiary whitespace-nowrap">
                           {matchData.whiteTime / 60}+{matchData.increment}s
                         </span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-t border-white/10 pt-2 mt-2">
                         <span className="text-on-surface-variant font-label-caps tracking-widest text-[10px] whitespace-nowrap">Experience</span>
                         <span className="font-mono-stats text-tertiary whitespace-nowrap">{opponentProfile.onlineStats?.xp || 0} XP</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-6 w-full mb-6 border border-white/5 rounded-xl border-dashed shrink-0">
                      <Loader2 className="w-8 h-8 text-tertiary animate-spin mb-2" />
                      <span className="text-xs text-on-surface-variant whitespace-nowrap">Decrypting profile...</span>
                    </div>
                  )}
                  
                  <div className="flex flex-col gap-2 w-full mb-6 shrink-0">
                    <div className="flex justify-between items-center text-xs font-mono bg-green-500/10 text-green-400 p-3 rounded">
                       <span className="whitespace-nowrap">Win Reward:</span> <span className="whitespace-nowrap font-bold">+50 XP</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-mono bg-error/10 text-error p-3 rounded">
                       <span className="whitespace-nowrap">Loss Penalty:</span> <span className="whitespace-nowrap font-bold">-50 XP</span>
                    </div>
                  </div>

                  {hasAccepted ? (
                    <div className="w-full py-3 bg-surface-variant text-primary rounded-lg font-title-md flex items-center justify-center gap-2 animate-pulse shrink-0">
                       <Loader2 className="w-5 h-5 animate-spin" /> <span className="whitespace-nowrap">Waiting for opponent...</span>
                    </div>
                  ) : (
                    <div className="flex gap-4 w-full shrink-0">
                      <button onClick={rejectMatch} className="flex-1 bg-surface-variant hover:bg-error/20 text-on-surface-variant hover:text-error font-title-md py-3 rounded-lg transition-colors border border-white/5 whitespace-nowrap">
                        Decline
                      </button>
                      <button onClick={acceptMatch} className="flex-1 bg-tertiary text-on-tertiary font-title-md py-3 rounded-lg transition-transform active:scale-95 shadow-lg shadow-tertiary/20 whitespace-nowrap">
                        Accept
                      </button>
                    </div>
                  )}
               </div>
            </div>
          )}

          {matchData.status === 'rejected' && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md rounded-lg p-4 animate-in zoom-in-95 duration-300 overflow-visible">
               <div className="glass-panel p-6 sm:p-8 rounded-2xl flex flex-col items-center text-center shadow-2xl border-t border-white/20 w-[90%] min-w-[320px] max-w-[448px] shrink-0">
                  <AlertCircle className="w-16 h-16 text-error mb-4 shrink-0" />
                  <h2 className="font-display-lg text-3xl text-primary mb-4 whitespace-nowrap shrink-0">Match Cancelled</h2>
                  <p className="font-body-lg text-on-surface-variant mb-8 w-full shrink-0">
                    A player has declined the match. No XP penalties were applied.
                  </p>
                  <button onClick={() => onNavigate('online_lobby')} className="w-full bg-surface-variant text-primary font-title-md py-3 rounded-lg active:scale-95 transition-all border border-white/5 hover:bg-surface-container-high whitespace-nowrap shrink-0">
                    Return to Lobby
                  </button>
               </div>
            </div>
          )}

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

          {matchData.status === 'resigned' && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md rounded-lg p-4 animate-in fade-in zoom-in-95 duration-300 overflow-visible">
              <div className="glass-panel p-6 sm:p-8 rounded-2xl flex flex-col items-center text-center shadow-2xl border-t border-white/20 w-[90%] min-w-[320px] max-w-[448px] shrink-0">
                <Crown className={`w-16 h-16 mb-4 shrink-0 drop-shadow-[0_0_15px_rgba(233,195,73,0.5)] ${matchData.winnerId === user?.uid ? 'text-tertiary' : 'text-on-surface-variant'}`} />
                <h2 className="font-display-lg text-3xl md:text-4xl text-primary mb-4 whitespace-nowrap shrink-0">
                  {matchData.winnerId === user?.uid ? 'Opponent Resigned' : 'Match Conceded'}
                </h2>
                <p className="font-body-lg text-on-surface-variant mb-6 w-full shrink-0">
                  {matchData.winnerId === user?.uid 
                    ? 'Victory by resignation. The arena acknowledges your dominance.' 
                    : 'You have surrendered the match.'}
                </p>
                <div className={`font-mono-stats text-3xl mb-8 font-bold shrink-0 ${matchData.winnerId === user?.uid ? 'text-green-400' : 'text-error'}`}>
                  {matchData.winnerId === user?.uid ? '+50 XP' : '-50 XP'}
                </div>
                <button onClick={() => onNavigate('home')} className="w-full bg-surface-variant hover:bg-surface-container-high text-primary font-title-md py-3 rounded-lg active:scale-95 transition-all border border-white/5 whitespace-nowrap shrink-0">
                  Return to Lobby
                </button>
              </div>
            </div>
          )}

          {isCheckmate && matchData.status !== 'resigned' && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md rounded-lg p-4 overflow-visible">
              <div className="glass-panel p-6 sm:p-8 rounded-2xl flex flex-col items-center text-center shadow-2xl border-t border-white/20 w-[90%] min-w-[320px] max-w-[448px] shrink-0">
                <Crown className="w-16 h-16 text-tertiary mb-4 shrink-0 drop-shadow-[0_0_15px_rgba(233,195,73,0.5)]" />
                <h2 className="font-display-lg text-4xl text-primary mb-4 whitespace-nowrap shrink-0">Checkmate</h2>
                <p className="font-body-lg text-on-surface-variant mb-6 w-full shrink-0">
                  Match Concluded. Result has been recorded in the global archives.
                </p>
                <div className={`font-mono-stats text-3xl mb-8 font-bold shrink-0 ${matchData.winnerId === user?.uid ? 'text-green-400' : 'text-error'}`}>
                  {matchData.winnerId === user?.uid ? '+50 XP' : '-50 XP'}
                </div>
                <button onClick={() => onNavigate('home')} className="w-full bg-tertiary text-on-tertiary font-title-md py-3 rounded-lg active:scale-95 transition-transform whitespace-nowrap shrink-0">
                  Return to Lobby
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
          <button onClick={togglePause} className="flex flex-col items-center gap-xs text-on-surface-variant hover:text-tertiary transition-colors active:scale-95" disabled={matchData.status === 'pending' || matchData.status === 'rejected'}>
            {matchData.status === 'paused' ? <Play className="w-6 h-6 text-tertiary" /> : <Pause className="w-6 h-6" />}
            <span className="font-label-caps text-[10px]">{matchData.status === 'paused' ? 'Resume' : 'Pause'}</span>
          </button>
          <div className="w-px h-8 bg-white/10" />
          <button className="flex flex-col items-center gap-xs text-on-surface-variant hover:text-primary transition-colors" disabled={matchData.status === 'pending' || matchData.status === 'rejected'}>
            <MessageSquare className="w-6 h-6" />
            <span className="font-label-caps text-[10px]">Chat</span>
          </button>
          <div className="w-px h-8 bg-white/10" />
          <button onClick={handleResign} className="flex flex-col items-center gap-xs text-on-surface-variant hover:text-error transition-colors" disabled={matchData.status === 'pending' || matchData.status === 'rejected'}>
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
            {!isGameOver && matchData.status === 'ongoing' && (
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