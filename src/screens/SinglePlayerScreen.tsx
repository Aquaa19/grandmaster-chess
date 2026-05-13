import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, UserCircle, Crown, Loader2, Search, Trophy, Star, 
  Pause, Play, Undo2, RotateCcw, AlertCircle, Settings2
} from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { collection, setDoc, getDocs, doc, updateDoc, increment, arrayUnion, serverTimestamp } from 'firebase/firestore';
import type { Square } from 'chess.js';
import { db, appId } from '../config/firebase';
import { useChessGame } from '../hooks/useChessGame';
import { ChessBoard } from '../components/chess/ChessBoard';
import type { BoardThemeKey, PieceThemeKey } from '../components/chess/ChessBoard';

interface SinglePlayerScreenProps {
  user: FirebaseUser | null;
  boardTheme: BoardThemeKey;
  pieceTheme: PieceThemeKey;
}

const AI_LEVEL_NAMES = ['Novice', 'Amateur', 'Intermediate', 'Expert', 'Grandmaster'];

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// Map Campaign Tiers to Stockfish parameters
const getStockfishConfig = (level: number) => {
  const skillMap = { 1: 0, 2: 5, 3: 10, 4: 15, 5: 20 };
  const depthMap = { 1: 1, 2: 3, 3: 5, 4: 10, 5: 15 };
  return {
    skill: skillMap[level as keyof typeof skillMap] || 10,
    depth: depthMap[level as keyof typeof depthMap] || 5
  };
};

export const SinglePlayerScreen: React.FC<SinglePlayerScreenProps> = ({ user, boardTheme, pieceTheme }) => {
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
    matchId, 
    isPaused,
    togglePause,
    loadGame 
  } = useChessGame() as any;
  
  const [aiLevel, setAiLevel] = useState<number>(3); 
  const [customMatchName, setCustomMatchName] = useState<string>(''); 
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [matchSaved, setMatchSaved] = useState(false);
  const [previewMoveSquare, setPreviewMoveSquare] = useState<Square | null>(null);
  
  const [xpEarned, setXpEarned] = useState(0);
  const [medalsEarned, setMedalsEarned] = useState<string[]>([]);

  const [matchPhase, setMatchPhase] = useState<'loading' | 'setup' | 'playing'>('loading');
  const [showBlockWarning, setShowBlockWarning] = useState(false);

  const workerRef = useRef<Worker | null>(null);

  const groupedMoves = [];
  for (let i = 0; i < moveHistory.length; i += 2) {
    groupedMoves.push({
      white: moveHistory[i].san,
      black: moveHistory[i + 1]?.san || '-',
      whiteMove: moveHistory[i],
      blackMove: moveHistory[i + 1]
    });
  }

  // --- 0. INITIALIZE STOCKFISH WORKER DIRECTLY ---
  useEffect(() => {
    // Because stockfish.js is in /public, we load it from the root URL
    workerRef.current = new Worker('/stockfish.js');
    
    workerRef.current.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === 'string' ? e.data : '';
      
      if (line && line.startsWith('bestmove')) {
        const move = line.split(' ')[1]; 
        if (move && move !== '(none)') {
          const from = move.slice(0, 2);
          const to = move.slice(2, 4);
          const promotion = move.length === 5 ? move[4] : 'q';
          makeMove(from, to, promotion);
        }
        setIsAiThinking(false);
      }
    };

    workerRef.current.postMessage('uci');
    workerRef.current.postMessage('isready');

    return () => {
      workerRef.current?.terminate();
    };
  }, [makeMove]);

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
          if (data.type === 'ai_match' && data.status === 'ongoing') {
            const time = data.lastUpdated?.toMillis?.() || 0;
            if (time > maxTime) {
              maxTime = time;
              latestOngoing = data;
            }
          }
        });

        if (latestOngoing && loadGame) {
          loadGame(latestOngoing.moves, latestOngoing.id, latestOngoing.whiteTime, latestOngoing.blackTime);
          if (latestOngoing.ai_level) {
            setAiLevel(latestOngoing.ai_level); 
          }
          if (latestOngoing.matchName) {
            setCustomMatchName(latestOngoing.matchName); 
          }
          if (!isPaused) togglePause();
          setMatchPhase('playing');
        } else {
          setMatchPhase('setup');
        }
      } catch (e) {
        console.error("Error fetching ongoing AI match", e);
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

  // --- 3. TRIGGER RAW UCI STOCKFISH MOVE ---
  useEffect(() => {
    if (turn === 'b' && !isGameOver && !isPaused && matchPhase === 'playing') {
      setIsAiThinking(true);
      
      const timer = setTimeout(() => {
        if (workerRef.current) {
          const config = getStockfishConfig(aiLevel);
          workerRef.current.postMessage(`setoption name Skill Level value ${config.skill}`);
          workerRef.current.postMessage(`position fen ${game.fen()}`);
          workerRef.current.postMessage(`go depth ${config.depth}`);
        }
      }, 100); 

      return () => clearTimeout(timer);
    }
  }, [turn, isGameOver, game, aiLevel, isPaused, matchPhase]);

  // --- 4. LIVE SYNC EFFECT ---
  useEffect(() => {
    if (!user || moveHistory.length === 0 || matchPhase !== 'playing') return;

    const liveSyncMatch = async () => {
      try {
        const matchRef = doc(db, 'artifacts', appId, 'users', user.uid, 'matches', matchId);
        const playerWon = turn === 'b'; 

        await setDoc(matchRef, {
          id: matchId,
          type: 'ai_match',
          matchName: customMatchName || 'AI Campaign', 
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
  }, [moveHistory, isCheckmate, turn, user, matchId, aiLevel, whiteTime, blackTime, matchPhase, customMatchName]);

  // --- 5. Campaign Progression ---
  useEffect(() => {
    if (isCheckmate && !matchSaved && user && matchPhase === 'playing') {
      const saveProgression = async () => {
        try {
          const playerWon = turn === 'b'; 

          if (playerWon) {
            const earned = aiLevel * 150; 
            setXpEarned(earned);

            const newMedals = [];
            if (aiLevel === 1) newMedals.push('First Blood');
            if (aiLevel === 5) newMedals.push('Grandmaster Slayer');

            if (newMedals.length > 0) setMedalsEarned(newMedals);

            const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
            await updateDoc(profileRef, {
              'aiStats.xp': increment(earned),
              'aiStats.wins': increment(1),
              ...(newMedals.length > 0 && { medals: arrayUnion(...newMedals) })
            });
          } else {
            setXpEarned(25); 
            const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
            await updateDoc(profileRef, { 
              'aiStats.xp': increment(25),
              'aiStats.losses': increment(1)
            });
          }

          setMatchSaved(true);
        } catch (e) { 
          console.error("Failed to save progression", e); 
        }
      };
      saveProgression();
    }
  }, [isCheckmate, matchSaved, user, turn, aiLevel, matchPhase]);

  const handleResetGame = () => {
    resetGame();
    setMatchSaved(false); 
    setXpEarned(0);
    setMedalsEarned([]);
    setCustomMatchName('');
    setMatchPhase('setup'); 
  };

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

  const handlePreviewLastMove = () => {
    if (moveHistory.length === 0) return;
    const lastMove = moveHistory[moveHistory.length - 1];
    handlePreviewMove(lastMove.to);
  };

  if (matchPhase === 'loading') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-md fade-slide-up">
        <Loader2 className="w-12 h-12 text-tertiary animate-spin" />
        <p className="font-label-caps text-on-surface-variant tracking-widest text-[10px] animate-pulse">RECOVERING CAMPAIGN DATA...</p>
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

      <div className="flex-1 flex flex-col items-center justify-center min-w-0">
        
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

        <div className="relative w-full max-w-[600px] mx-auto">
          <ChessBoard 
            fen={fen} 
            onMove={makeMove} 
            flipped={false} 
            inCheckSquare={inCheckSquare} 
            previewMoveSquare={previewMoveSquare}
            boardTheme={boardTheme}
            pieceTheme={pieceTheme}
          />

          {matchPhase === 'setup' && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md rounded-lg p-4 animate-in zoom-in-95 duration-300 overflow-visible">
               <div className="glass-panel p-6 sm:p-8 rounded-2xl flex flex-col items-center text-center shadow-2xl border-t border-white/20 w-[90%] min-w-[320px] max-w-[448px] shrink-0">
                  <Settings2 className="w-12 h-12 text-tertiary mb-4 shrink-0" />
                  <h2 className="font-display-lg text-3xl text-primary mb-2 whitespace-nowrap shrink-0">Campaign Setup</h2>
                  <p className="text-sm text-on-surface-variant mb-6 shrink-0 w-full">Configure your AI opponent and match details.</p>
                  
                  <div className="w-full space-y-5 mb-6 text-left shrink-0">
                    <div>
                      <label className="text-xs text-on-surface-variant uppercase tracking-widest font-label-caps block mb-2">Match Name (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g., King's Indian Practice"
                        value={customMatchName}
                        onChange={(e) => setCustomMatchName(e.target.value)}
                        className="w-full bg-surface-container text-on-surface font-body-sm border border-white/20 rounded-lg py-3 px-4 focus:outline-none focus:border-tertiary transition-colors"
                      />
                    </div>
                    <div>
                       <div className="flex justify-between items-center mb-2">
                         <label className="text-xs text-on-surface-variant uppercase tracking-widest font-label-caps">Difficulty Tier</label>
                         <span className="text-tertiary font-mono-stats text-sm">Tier {aiLevel}</span>
                       </div>
                       <input
                         type="range" min="1" max="5" value={aiLevel}
                         onChange={(e) => setAiLevel(Number(e.target.value))}
                         className="w-full h-2 bg-surface-variant rounded-lg appearance-none cursor-pointer accent-tertiary"
                       />
                       <div className="text-center mt-2 text-primary text-sm font-title-md">{AI_LEVEL_NAMES[aiLevel - 1]}</div>
                    </div>
                    <div className="bg-surface-variant/30 border border-white/5 rounded-lg p-4 flex justify-between items-center">
                      <span className="text-xs text-on-surface-variant uppercase tracking-widest font-label-caps">Win Reward</span>
                      <span className="text-green-400 font-bold font-mono-stats text-lg">+{aiLevel * 150} XP</span>
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

      <aside className="w-full xl:w-[400px] flex flex-col gap-lg">
        
        <div className="glass-panel rounded-xl p-md flex justify-between items-center">
          <button onClick={togglePause} disabled={matchPhase === 'setup'} className="flex flex-col items-center gap-xs text-on-surface-variant hover:text-tertiary transition-colors active:scale-95 group disabled:opacity-50" title={isPaused ? "Resume Game" : "Pause Game"}>
            {isPaused ? <Play className="w-6 h-6 text-tertiary" /> : <Pause className="w-6 h-6" />}
            <span className="font-label-caps text-[10px]">{isPaused ? 'Resume' : 'Pause'}</span>
          </button>
          
          <div className="w-px h-8 bg-white/10" />
          
          <button onClick={undoMove} disabled={matchPhase === 'setup'} className="flex flex-col items-center gap-xs text-on-surface-variant hover:text-primary transition-colors active:scale-95 disabled:opacity-50" title="Undo Move">
            <Undo2 className="w-6 h-6" />
            <span className="font-label-caps text-[10px]">Undo</span>
          </button>
          
          <div className="w-px h-8 bg-white/10" />
          
          <button onClick={handleResetGame} disabled={matchPhase === 'setup'} className="flex flex-col items-center gap-xs text-on-surface-variant hover:text-error transition-colors active:scale-95 disabled:opacity-50" title="Restart Match">
            <RotateCcw className="w-6 h-6" />
            <span className="font-label-caps text-[10px]">Restart</span>
          </button>
        </div>

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
            disabled={moveHistory.length > 0} 
            onChange={(e) => setAiLevel(Number(e.target.value))}
            className="w-full h-2 bg-surface-variant rounded-lg appearance-none cursor-pointer accent-tertiary focus:outline-none focus:ring-2 focus:ring-tertiary/50 relative z-10 disabled:opacity-50 disabled:cursor-not-allowed" 
          />
          <div className="text-center mt-md font-title-md text-tertiary relative z-10 bg-tertiary/10 py-1 rounded border border-tertiary/20">
            {AI_LEVEL_NAMES[aiLevel - 1]}
          </div>
        </div>

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
            {matchPhase === 'playing' ? (
               <span className="bg-surface-variant text-on-surface-variant font-label-caps text-label-caps px-2 py-1 rounded tracking-widest text-[10px]">LIVE</span>
            ) : (
               <span className="bg-surface-variant/50 text-on-surface-variant/50 font-label-caps text-label-caps px-2 py-1 rounded tracking-widest text-[10px]">SETUP</span>
            )}
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
            
            {!isCheckmate && matchPhase === 'playing' && (
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

      </aside>
    </>
  );
};