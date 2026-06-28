// /home/aquaax19/Workspace/Projects/Chess/grandmaster-chess/src/screens/PuzzlesScreen.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Puzzle, CheckCircle2, XCircle, ChevronRight, 
  RotateCcw, Trophy, Target, Zap, Loader2,
  AlertCircle, Settings2
} from 'lucide-react';
import { Chess } from 'chess.js';
import { ChessBoard } from '../components/chess/ChessBoard';
import type { BoardThemeKey, PieceThemeKey } from '../components/chess/ChessBoard';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import { db, appId } from '../config/firebase';
import { playVictorySound, playDefeatSound } from '../utils/audio';

// Types for our puzzle structure
interface PuzzleData {
  id: string;
  rating: number;
  themes: string[];
  fen: string;
  moves: string[]; // Array of UCI moves (e.g., ["e2e4", "e7e5"])
  description: string;
}

// Fallback database if the API fails or user clicks Next after the daily puzzle
const FALLBACK_PUZZLES: PuzzleData[] = [
  {
    id: 'puz-001',
    rating: 1200,
    themes: ['Mate in 1', 'Back Rank'],
    fen: '6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1',
    moves: ['e1e8'], 
    description: 'White to move and mate.'
  },
  {
    id: 'puz-002',
    rating: 1500,
    themes: ['Mate in 2', 'Queen Sacrifice', 'Deflection'],
    fen: 'r1bq2r1/b4pk1/p1pp1p2/1p2pP2/1P2P1PB/3P4/1PPQ2P1/R3K2R w KQ - 1 20',
    moves: ['d2h6', 'g7h6', 'h4f6'],
    description: 'White to move. Find the crushing sequence.'
  },
  {
    id: 'puz-003',
    rating: 1800,
    themes: ['Smothered Mate', 'Knight Sacrifice'],
    fen: 'r4r1k/1pq1N1pp/p2p4/4n3/4Q3/1B6/PPP3PP/R1B3K1 w - - 1 20',
    moves: ['e4h7', 'h8h7', 'e7d5'],
    description: 'White to move and deliver a beautiful mate.'
  }
];

interface PuzzlesScreenProps {
  user: FirebaseUser | null;
  boardTheme: BoardThemeKey;
  pieceTheme: PieceThemeKey;
}

const getDifficultyTierName = (rating: number) => {
  if (rating >= 2100) return 'Grandmaster';
  if (rating >= 1800) return 'Expert';
  if (rating >= 1500) return 'Intermediate';
  if (rating >= 1200) return 'Amateur';
  return 'Novice';
};

const getPuzzleXPReward = (rating: number) => {
  if (rating >= 2100) return 750;
  if (rating >= 1800) return 500;
  if (rating >= 1500) return 350;
  if (rating >= 1200) return 200;
  return 100;
};

export const PuzzlesScreen: React.FC<PuzzlesScreenProps> = ({ user, boardTheme, pieceTheme }) => {
  const [puzzles, setPuzzles] = useState<PuzzleData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(''); // Initialized empty
  
  // 'playing' | 'success' | 'failed'
  const [status, setStatus] = useState<'playing' | 'success' | 'failed'>('playing');
  const [moveIndex, setMoveIndex] = useState(0);
  const [streak, setStreak] = useState(0);
  const [solvedPuzzleIds, setSolvedPuzzleIds] = useState<string[]>([]);
  const [puzzlePhase, setPuzzlePhase] = useState<'setup' | 'playing'>('setup');
  const [showBlockWarning, setShowBlockWarning] = useState(false);

  // --- NAVIGATION BLOCKER EFFECT ---
  useEffect(() => {
    const handleNavClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('nav') && status === 'playing' && puzzlePhase === 'playing') {
        e.stopPropagation(); 
        e.preventDefault();
        setShowBlockWarning(true);
        setTimeout(() => setShowBlockWarning(false), 3000);
      }
    };

    document.addEventListener('click', handleNavClick, true);
    return () => document.removeEventListener('click', handleNavClick, true);
  }, [status, puzzlePhase]);

  // Fetch puzzle progress from Firestore
  useEffect(() => {
    if (!user) return;
    const fetchProgress = async () => {
      try {
        const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
        const docSnap = await getDoc(profileRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.solvedPuzzles) {
            setSolvedPuzzleIds(data.solvedPuzzles);
          }
        }
      } catch (e) {
        console.error("Error fetching puzzle progress:", e);
      }
    };
    fetchProgress();
  }, [user]);

  // Compute unsolved puzzles
  const unsolvedPuzzles = puzzles.filter(p => !solvedPuzzleIds.includes(p.id));

  // --- Real API Fetch (Lichess Daily Puzzle) ---
  useEffect(() => {
    const fetchDailyPuzzle = async () => {
      try {
        setLoading(true);
        // Fetch real daily puzzle from Lichess Open API
        const res = await fetch('https://lichess.org/api/puzzle/daily');
        if (!res.ok) throw new Error('Failed to fetch from API');
        
        const data = await res.json();
        
        // Use chess.js to replay the game to the initial ply
        const tempGame = new Chess();
        tempGame.loadPgn(data.game.pgn);
        const history = tempGame.history();
        
        const puzzleGame = new Chess();
        for (let i = 0; i < data.puzzle.initialPly; i++) {
          puzzleGame.move(history[i]);
        }

        // --- THE FIX ---
        // 1. Play the opponent's blunder automatically to set the true puzzle state
        const opponentBlunder = data.puzzle.solution[0];
        puzzleGame.move(opponentBlunder);

        // 2. The player's solution sequence starts from the SECOND move
        const playerSolutionMoves = data.puzzle.solution.slice(1);

        const livePuzzle: PuzzleData = {
          id: `lichess-${data.puzzle.id}`,
          rating: data.puzzle.rating,
          themes: data.puzzle.themes.slice(0, 3).map((t: string) => t.replace(/([A-Z])/g, ' $1').trim()), 
          fen: puzzleGame.fen(), // FEN is now correctly set AFTER the blunder
          moves: playerSolutionMoves,
          description: 'Lichess Daily Puzzle. Find the best continuation.'
        };

        // Combine the live API puzzle with our fallback pack with randomized ratings
        const randomizedFallback = FALLBACK_PUZZLES.map(p => ({
          ...p,
          rating: 1000 + Math.floor(Math.random() * 1400) // Random ElO 1000-2400
        }));
        setPuzzles([livePuzzle, ...randomizedFallback]);
      } catch (err) {
        console.error("API Fetch Error:", err);
        // Silently fallback to our hardcoded database with randomized ratings
        const randomizedFallback = FALLBACK_PUZZLES.map(p => ({
          ...p,
          rating: 1000 + Math.floor(Math.random() * 1400)
        }));
        setPuzzles(randomizedFallback);
      } finally {
        setLoading(false);
      }
    };

    fetchDailyPuzzle();
  }, []);

  const currentPuzzle = unsolvedPuzzles[currentIndex];

  // Initialize or reset puzzle
  const loadPuzzle = useCallback(() => {
    if (!currentPuzzle) return;
    const newGame = new Chess(currentPuzzle.fen);
    setGame(newGame);
    setFen(newGame.fen());
    setStatus('playing');
    setMoveIndex(0);
  }, [currentPuzzle]);

  useEffect(() => {
    loadPuzzle();
  }, [loadPuzzle]);

  const handleMove = (source: string, target: string, promotion: string = 'q') => {
    if (status !== 'playing' || !currentPuzzle) return false;

    const uciMove = `${source}${target}${promotion === 'q' ? '' : promotion}`;
    const expectedMove = currentPuzzle.moves[moveIndex];

    try {
      const gameCopy = new Chess(game.fen());
      const move = gameCopy.move({ from: source, to: target, promotion });

      if (move) {
        // Did the user make the correct tactical move?
        if (uciMove === expectedMove || move.lan === expectedMove) {
          setGame(gameCopy);
          setFen(gameCopy.fen());
          
          const nextIndex = moveIndex + 1;
          
          if (nextIndex >= currentPuzzle.moves.length) {
            // Puzzle solved!
            setStatus('success');
            playVictorySound();
            setMoveIndex(nextIndex);
            setStreak(prev => prev + 1);

            // Persist to Firestore
            if (user && currentPuzzle.id) {
              const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
              const xpReward = getPuzzleXPReward(currentPuzzle.rating);
              updateDoc(profileRef, {
                solvedPuzzles: arrayUnion(currentPuzzle.id),
                'aiStats.xp': increment(xpReward)
              }).catch(e => console.error("Error saving puzzle progress:", e));
              
              // Optimistically update local state so it's filtered next time
              // Wait a bit before filtering to let the success animation finish
              setTimeout(() => {
                setSolvedPuzzleIds(prev => [...prev, currentPuzzle.id]);
                // If we were at the end of the list, wrap around
                if (currentIndex >= unsolvedPuzzles.length - 1) {
                  setCurrentIndex(0);
                }
              }, 1500);
            }
          } else {
            // Opponent's turn: Auto-play the forced response
            setMoveIndex(nextIndex);
            setTimeout(() => {
              const opponentMove = currentPuzzle.moves[nextIndex];
              const oppGameCopy = new Chess(gameCopy.fen());
              // Process string move directly
              oppGameCopy.move(opponentMove); 
              setGame(oppGameCopy);
              setFen(oppGameCopy.fen());
              setMoveIndex(nextIndex + 1);
            }, 400);
          }
          return true;
        } else {
          // Wrong move
          setStatus('failed');
          playDefeatSound();
          setStreak(0); // Break the streak
          return false;
        }
      }
    } catch (e) {
      console.error("Invalid move attempted:", e);
      return false;
    }
    return false;
  };

  const handleNextPuzzle = () => {
    setFen(''); 
    setStatus('playing');
    setPuzzlePhase('setup');
    if (currentIndex < unsolvedPuzzles.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  // SUPER STRICT GUARD: Wait until both API loads AND the FEN string is ready
  if (loading || !fen) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center min-h-[60vh] gap-4 fade-slide-up">
        <Loader2 className="w-12 h-12 text-tertiary animate-spin" />
        <p className="font-label-caps text-on-surface-variant tracking-widest text-[10px] uppercase animate-pulse">
          {loading ? 'Fetching Live Puzzle from Server...' : 'Loading Position...'}
        </p>
      </div>
    );
  }

  if (!currentPuzzle) {
    if (!loading && unsolvedPuzzles.length === 0 && puzzles.length > 0) {
      return (
        <div className="w-full flex flex-col items-center justify-center min-h-[60vh] gap-6 fade-slide-up">
          <div className="relative">
            <Trophy className="w-24 h-24 text-tertiary drop-shadow-[0_0_20px_rgba(233,195,73,0.4)]" />
            <CheckCircle2 className="absolute -bottom-2 -right-2 w-10 h-10 text-green-400 bg-background rounded-full p-1" />
          </div>
          <div className="text-center">
            <h2 className="text-4xl font-display-lg text-primary mb-2">Champion!</h2>
            <p className="text-on-surface-variant font-body-lg max-w-md">
              You've solved all available puzzles in the arena. 
              New tactical challenges appear every 24 hours.
            </p>
          </div>
          <button 
            onClick={() => setSolvedPuzzleIds([])} 
            className="mt-4 bg-surface-variant hover:bg-surface-container-high text-primary font-title-md py-3 px-8 rounded-lg transition-all border border-white/10 flex items-center gap-2"
          >
            <RotateCcw className="w-5 h-5" /> Reset & Replay All
          </button>
        </div>
      );
    }
    return null;
  }

  const initialTurn = new Chess(currentPuzzle.fen).turn();
  const playerColor = initialTurn === 'w' ? 'White' : 'Black';

  return (
    <>
      {showBlockWarning && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] bg-error text-on-error px-xl py-md rounded-full shadow-[0_10px_40px_rgba(255,180,171,0.3)] font-title-md flex items-center gap-md animate-in slide-in-from-top-4 fade-in">
           <AlertCircle className="w-6 h-6" /> 
           Solve or Fail the puzzle before leaving!
        </div>
      )}

      <div className="w-full flex flex-col xl:flex-row gap-xl max-w-container-max mx-auto fade-slide-up pt-6 pb-12">
        
        {/* Board Area */}
        <div className="flex-1 flex flex-col items-center justify-center max-w-[600px] mx-auto w-full">
          <div className="w-full flex justify-between items-end mb-4 px-2">
            <div>
              <h2 className="text-3xl font-display-lg text-primary flex items-center gap-2">
                <Puzzle className="w-8 h-8 text-tertiary" /> 
                Tactics Trainer
              </h2>
              <p className="text-on-surface-variant font-label-caps tracking-widest text-[10px] uppercase mt-1">
                Find the best move for {playerColor}
              </p>
            </div>
            <div className="text-right">
               <div className="text-tertiary font-mono-stats text-xl flex items-center justify-end gap-2">
                  {currentIndex === 0 && <span className="bg-tertiary/20 text-tertiary text-[10px] px-2 py-1 rounded tracking-widest uppercase border border-tertiary/30">Live Daily</span>}
                  {currentPuzzle.rating} Elo
               </div>
               <div className="text-on-surface-variant font-title-md text-sm mt-1">Puzzle #{currentIndex + 1}</div>
            </div>
          </div>
  
          <div className="relative w-full rounded-lg overflow-hidden shadow-2xl border border-white/10 ring-4 ring-surface-container-high">
            <ChessBoard 
              fen={fen} 
              onMove={handleMove} 
              flipped={initialTurn === 'b'} 
              boardTheme={boardTheme}
              pieceTheme={pieceTheme}
              lastMove={game.history({ verbose: true }).length > 0 ? (game.history({ verbose: true }).slice(-1)[0] as any) : null}
            />

            {/* Setup Overlay */}
            {puzzlePhase === 'setup' && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md rounded-lg p-4 animate-in zoom-in-95 duration-300 overflow-visible">
                 <div className="glass-panel p-6 sm:p-8 rounded-2xl flex flex-col items-center text-center shadow-2xl border-t border-white/20 w-[90%] min-w-[320px] max-w-[448px] shrink-0">
                    <Settings2 className="w-12 h-12 text-tertiary mb-4 shrink-0" />
                    <h2 className="font-display-lg text-3xl text-primary mb-2 whitespace-nowrap shrink-0">Tactical Assignment</h2>
                    <p className="text-sm text-on-surface-variant mb-6 shrink-0 w-full">Accept the Daily Puzzle assignment to sharpen your tactics.</p>
                    
                    <div className="w-full space-y-4 mb-6 text-left shrink-0">
                      <div className="flex justify-between items-center bg-surface-container p-4 rounded-lg border border-white/5">
                        <span className="text-xs text-on-surface-variant uppercase tracking-widest font-label-caps">Puzzle Rating</span>
                        <span className="text-tertiary font-mono-stats text-sm font-bold">{currentPuzzle.rating} Elo</span>
                      </div>
                      <div className="flex justify-between items-center bg-surface-container p-4 rounded-lg border border-white/5">
                        <span className="text-xs text-on-surface-variant uppercase tracking-widest font-label-caps">Difficulty Tier</span>
                        <span className="text-primary font-title-md text-sm font-bold">{getDifficultyTierName(currentPuzzle.rating)}</span>
                      </div>
                      <div className="bg-surface-variant/30 border border-white/5 rounded-lg p-4 flex justify-between items-center">
                        <span className="text-xs text-on-surface-variant uppercase tracking-widest font-label-caps">Solve Reward</span>
                        <span className="text-green-400 font-bold font-mono-stats text-md">+{getPuzzleXPReward(currentPuzzle.rating)} XP</span>
                      </div>
                    </div>
  
                    <button onClick={() => setPuzzlePhase('playing')} className="w-full bg-tertiary hover:bg-yellow-400 text-on-tertiary font-title-md py-3 rounded-lg active:scale-95 transition-all shadow-lg shadow-tertiary/20 shrink-0">
                      Accept Daily Puzzle
                    </button>
                 </div>
              </div>
            )}
  
            {/* Success Overlay */}
            {status === 'success' && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-green-900/40 backdrop-blur-sm animate-in fade-in zoom-in-95">
                <div className="glass-panel p-8 rounded-2xl flex flex-col items-center text-center border-t-4 border-t-green-400 shadow-[0_0_50px_rgba(74,222,128,0.2)]">
                   <CheckCircle2 className="w-16 h-16 text-green-400 mb-4 drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]" />
                   <h3 className="text-3xl font-display-lg text-white mb-2">Solved!</h3>
                   <p className="text-green-200 mb-6 font-body-md">+{getPuzzleXPReward(currentPuzzle.rating)} XP</p>
                   <button onClick={handleNextPuzzle} className="bg-green-500 hover:bg-green-400 text-slate-900 font-bold py-3 px-8 rounded-lg flex items-center gap-2 transition-colors">
                      Next Puzzle <ChevronRight className="w-5 h-5" />
                   </button>
                </div>
              </div>
            )}
  
            {/* Failure Overlay */}
            {status === 'failed' && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-red-900/40 backdrop-blur-sm animate-in fade-in zoom-in-95">
                <div className="glass-panel p-8 rounded-2xl flex flex-col items-center text-center border-t-4 border-t-red-500 shadow-[0_0_50px_rgba(239,68,68,0.2)]">
                   <XCircle className="w-16 h-16 text-red-500 mb-4 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
                   <h3 className="text-3xl font-display-lg text-white mb-2">Incorrect</h3>
                   <p className="text-red-200 mb-6 font-body-md">That is not the best move.</p>
                   <button onClick={loadPuzzle} className="bg-surface-variant hover:bg-surface-container-high text-white font-title-md py-3 px-8 rounded-lg flex items-center gap-2 transition-colors border border-white/10">
                      <RotateCcw className="w-5 h-5" /> Retry Puzzle
                   </button>
                </div>
              </div>
            )}
          </div>
        </div>

      {/* Info Sidebar */}
      <aside className="w-full xl:w-[350px] flex flex-col gap-6 mt-14">
        <div className="glass-panel p-6 rounded-2xl border-t border-white/10 shadow-lg">
           <h3 className="text-primary font-title-md text-lg flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-tertiary" /> Puzzle Objective
           </h3>
           <p className="text-on-surface-variant font-body-md mb-6 leading-relaxed">
             {currentPuzzle.description}
           </p>

           <div className="space-y-3">
              <div className="text-xs font-label-caps tracking-widest text-on-surface-variant uppercase mb-2">Tactical Themes</div>
              <div className="flex flex-wrap gap-2">
                {currentPuzzle.themes.length > 0 ? currentPuzzle.themes.map((theme, i) => (
                  <span key={i} className="bg-tertiary/10 text-tertiary border border-tertiary/20 px-3 py-1 rounded-full text-xs font-title-md flex items-center gap-1 capitalize">
                    <Zap className="w-3 h-3" /> {theme}
                  </span>
                )) : (
                  <span className="text-on-surface-variant text-sm italic">Mixed Tactics</span>
                )}
              </div>
           </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl border-t border-white/10 shadow-lg flex-1">
          <h3 className="text-primary font-title-md text-lg flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-tertiary" /> Training Progress
           </h3>
           <div className="space-y-4">
             <div className="flex justify-between items-center bg-surface-container p-4 rounded-lg border border-white/5">
                <span className="text-on-surface-variant text-sm font-label-caps tracking-widest uppercase">Puzzles Solved</span>
                <span className="text-primary font-mono-stats text-xl font-bold">{currentIndex}</span>
             </div>
             <div className="flex justify-between items-center bg-surface-container p-4 rounded-lg border border-white/5 relative overflow-hidden">
                <div className={`absolute top-0 left-0 h-full bg-green-500/10 transition-all duration-500 ${streak > 0 ? 'w-full' : 'w-0'}`} />
                <span className="text-on-surface-variant text-sm font-label-caps tracking-widest uppercase relative z-10">Current Streak</span>
                <span className={`font-mono-stats text-xl font-bold relative z-10 transition-colors ${streak > 0 ? 'text-green-400' : 'text-on-surface-variant'}`}>
                  🔥 {streak}
                </span>
             </div>
           </div>
        </div>
      </aside>
      
      </div>
    </>
  );
};