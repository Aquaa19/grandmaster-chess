import React, { useState, useEffect, useRef } from 'react';
import { 
  SkipBack, ChevronLeft, ChevronRight, SkipForward, 
  ArrowLeft, Loader2, Bot, Users, AlertTriangle, XCircle,
  Download, Upload, FileText
} from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { db, appId } from '../config/firebase';
import { ChessBoard } from '../components/chess/ChessBoard';
import type { BoardThemeKey, PieceThemeKey } from '../components/chess/ChessBoard';
import { EvaluationBar } from '../components/chess/EvaluationBar';
import type { ScreenState } from '../App';

interface ReplayScreenProps {
  user: FirebaseUser | null;
  matchId: string;
  onNavigate: (s: ScreenState) => void;
  boardTheme: BoardThemeKey;
  pieceTheme: PieceThemeKey;
}

export const ReplayScreen: React.FC<ReplayScreenProps> = ({ user, matchId, onNavigate, boardTheme, pieceTheme }) => {
  const [loading, setLoading] = useState(true);
  const [matchData, setMatchData] = useState<any>(null);
  
  // Replay Engine State
  const [moves, setMoves] = useState<string[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [fen, setFen] = useState(new Chess().fen());
  const [inCheckSquare, setInCheckSquare] = useState<Square | null>(null);

  // Analysis State
  const [evaluation, setEvaluation] = useState(0);
  const [mate, setMate] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  // PGN Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // 1. Fetch match data
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
          setCurrentMoveIndex(data.moves?.length || 0);
        } else {
          console.error("Match not found.");
        }
      } catch (err) {
        console.error("Failed to load match data.");
      } finally {
        setLoading(false);
      }
    };

    fetchMatch();
  }, [user, matchId]);

  // 2. Initialize Stockfish Worker
  useEffect(() => {
    const engine = new Worker('/stockfish.js');
    workerRef.current = engine;

    engine.onmessage = (e: MessageEvent) => {
      const line = e.data;
      if (line.includes('score cp')) {
        const parts = line.split(' ');
        const cpIndex = parts.indexOf('cp');
        if (cpIndex !== -1) {
          setEvaluation(parseInt(parts[cpIndex + 1]));
          setMate(null);
        }
      } else if (line.includes('score mate')) {
        const parts = line.split(' ');
        const mateIndex = parts.indexOf('mate');
        if (mateIndex !== -1) {
          setMate(parseInt(parts[mateIndex + 1]));
        }
      }
      
      if (line.startsWith('bestmove')) {
        setIsAnalyzing(false);
      }
    };

    engine.postMessage('uci');
    return () => engine.terminate();
  }, []);

  // 3. Rebuild board & Trigger Analysis
  useEffect(() => {
    const tempGame = new Chess();
    for (let i = 0; i < currentMoveIndex; i++) {
      try { tempGame.move(moves[i]); } catch (e) { break; }
    }

    const currentFen = tempGame.fen();
    setFen(currentFen);
    
    // Check highlighting
    let checkSquare: Square | null = null;
    if (tempGame.inCheck() || tempGame.isCheckmate()) {
      const board = tempGame.board();
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = board[r][c];
          if (piece?.type === 'k' && piece.color === tempGame.turn()) {
            checkSquare = piece.square as Square;
          }
        }
      }
    }
    setInCheckSquare(checkSquare);

    // Analysis trigger
    if (workerRef.current) {
      setIsAnalyzing(true);
      workerRef.current.postMessage(`position fen ${currentFen}`);
      workerRef.current.postMessage('go depth 12');
    }
  }, [currentMoveIndex, moves]);

  // --- Playback Controls ---
  const handleStart = () => setCurrentMoveIndex(0);
  const handlePrev = () => setCurrentMoveIndex(prev => Math.max(0, prev - 1));
  const handleNext = () => setCurrentMoveIndex(prev => Math.min(moves.length, prev + 1));
  const handleEnd = () => setCurrentMoveIndex(moves.length);

  const handleExportPGN = () => {
    const tempGame = new Chess();
    moves.forEach(m => {
      try { tempGame.move(m); } catch (e) { console.error("Export skip move:", m); }
    });
    
    const headers = [
      `[Event "${matchData?.matchName || 'Match Analysis'}"]`,
      `[Site "Grandmaster Chess App"]`,
      `[Date "${new Date().toISOString().split('T')[0]}"]`,
      `[White "${matchData?.type === 'ai_match' ? (matchData.winner === 'White' ? 'Winner' : 'Player') : 'Player 1'}"]`,
      `[Black "${matchData?.type === 'ai_match' ? 'Stockfish AI' : 'Player 2'}"]`,
      `[Result "${matchData?.winner ? (matchData.winner === 'White' ? '1-0' : '0-1') : '1/2-1/2'}"]`
    ].join('\n');

    const pgn = headers + '\n\n' + tempGame.pgn();
    const blob = new Blob([pgn], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `match-${matchId.split('-')[0] || 'chess'}.pgn`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportPGN = () => {
    if (!importText.trim()) return;
    try {
      const tempGame = new Chess();
      try {
        tempGame.loadPgn(importText);
        const newMoves = tempGame.history();
        
        if (newMoves.length > 0) {
          setMoves(newMoves);
          setCurrentMoveIndex(newMoves.length);
          setShowImportModal(false);
          setImportText('');
          setImportError(null);
          setMatchData((prev: any) => ({ 
            ...prev, 
            matchName: "Imported Analysis", 
            status: "completed",
            type: "imported"
          }));
        } else {
          setImportError("PGN parsed but no moves were found.");
        }
      } catch (e) {
        setImportError("Invalid PGN format. Ensure standard notation is used.");
      }
    } catch (e) {
      setImportError("Critical error parsing PGN data.");
    }
  };

  const groupedMoves = [];
  for (let i = 0; i < moves.length; i += 2) {
    groupedMoves.push({
      white: moves[i],
      black: moves[i + 1] || '-',
      whiteIndex: i + 1,
      blackIndex: i + 2
    });
  }

  if (loading) return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-md py-20">
      <Loader2 className="w-12 h-12 text-tertiary animate-spin" />
      <p className="font-label-caps text-on-surface-variant tracking-widest text-[10px] uppercase">Booting Stockfish Analysis...</p>
    </div>
  );

  return (
    <div className="w-full flex flex-col xl:flex-row gap-xl max-w-container-max mx-auto fade-slide-up">
      
      {/* Evaluation Bar & Board Wrapper */}
      <div className="flex-1 flex flex-col gap-lg max-w-[850px] mx-auto w-full">
        
        {/* Header Ribbon */}
        <div className="flex items-center gap-md mb-xs">
          <button onClick={() => onNavigate('history')} className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-variant transition-colors border border-white/5 active:scale-95">
            <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
          </button>
          <div>
            <h2 className="font-display-lg text-2xl text-primary">Post-Game Analysis</h2>
            <div className="flex items-center gap-2">
               {isAnalyzing && <Loader2 className="w-3 h-3 text-tertiary animate-spin" />}
               <span className="font-label-caps text-[10px] tracking-widest text-on-surface-variant/50 uppercase">
                 Depth 12 Analysis • {matchData.status}
               </span>
            </div>
          </div>
        </div>

        <div className="flex gap-4 items-stretch h-fit">
          {/* Vertical Eval Bar */}
          <EvaluationBar evaluation={evaluation} mate={mate} />

          {/* Replay Board */}
          <div className="flex-1">
            <ChessBoard 
              fen={fen} 
              onMove={() => false} 
              flipped={false} 
              inCheckSquare={inCheckSquare}
              boardTheme={boardTheme}
              pieceTheme={pieceTheme}
            />
          </div>
        </div>

        {/* Players Footer */}
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-panel p-md rounded-xl flex items-center gap-md opacity-80">
            <div className="w-8 h-8 rounded-full bg-surface-variant flex items-center justify-center border border-white/10">
              <Users className="text-primary w-4 h-4" />
            </div>
            <div>
              <div className="font-title-md text-sm text-primary">Player 1</div>
              <div className="text-[10px] text-on-surface-variant font-label-caps tracking-widest">White</div>
            </div>
          </div>
          <div className="glass-panel p-md rounded-xl flex items-center gap-md opacity-80">
            <div className="w-8 h-8 rounded-full bg-surface-variant flex items-center justify-center border border-white/10">
               {matchData.type === 'ai_match' ? <Bot className="text-primary w-4 h-4" /> : <Users className="text-primary w-4 h-4" />}
            </div>
            <div>
              <div className="font-title-md text-sm text-primary">
                {matchData.type === 'ai_match' ? 'Stockfish' : 'Guest'}
              </div>
              <div className="text-[10px] text-on-surface-variant font-label-caps tracking-widest">Black</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Area: Analysis Log */}
      <aside className="w-full xl:w-[360px] flex flex-col gap-lg mt-14">
        
        {/* Playback HUD */}
        <div className="glass-panel rounded-xl p-lg flex flex-col items-center gap-md border-t border-white/10">
           <div className="flex items-center justify-center gap-md w-full">
              <button onClick={handleStart} className="p-sm text-on-surface-variant hover:text-primary transition-colors disabled:opacity-20" disabled={currentMoveIndex === 0}>
                <SkipBack className="w-5 h-5" />
              </button>
              <button onClick={handlePrev} className="w-12 h-12 flex items-center justify-center rounded-full bg-surface-container text-primary hover:text-tertiary transition-colors disabled:opacity-20" disabled={currentMoveIndex === 0}>
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button onClick={handleNext} className="w-12 h-12 flex items-center justify-center rounded-full bg-tertiary text-on-tertiary shadow-[0_0_15px_rgba(233,195,73,0.3)] disabled:opacity-20" disabled={currentMoveIndex === moves.length}>
                <ChevronRight className="w-6 h-6" />
              </button>
              <button onClick={handleEnd} className="p-sm text-on-surface-variant hover:text-primary transition-colors disabled:opacity-20" disabled={currentMoveIndex === moves.length}>
                <SkipForward className="w-5 h-5" />
              </button>
           </div>
        </div>

        {/* PGN Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button 
             onClick={handleExportPGN}
             className="flex items-center justify-center gap-2 bg-surface-container-high hover:bg-surface-variant text-primary py-3 rounded-xl border border-white/5 transition-all active:scale-95 text-xs font-title-md"
          >
            <Download className="w-4 h-4 text-tertiary" /> Export PGN
          </button>
          <button 
             onClick={() => setShowImportModal(true)}
             className="flex items-center justify-center gap-2 bg-surface-container-high hover:bg-surface-variant text-primary py-3 rounded-xl border border-white/5 transition-all active:scale-95 text-xs font-title-md"
          >
            <Upload className="w-4 h-4 text-tertiary" /> Import PGN
          </button>
        </div>

        {/* Notation Log with Quality Tags */}
        <div className="flex-1 glass-panel rounded-xl flex flex-col overflow-hidden min-h-[400px]">
          <div className="p-md border-b border-white/10 bg-surface-container-high font-title-md text-primary">
            Analysis Log
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-[40px_1fr_1fr] px-md py-sm text-on-surface-variant/50 font-label-caps text-[10px] tracking-widest border-b border-white/5">
              <div className="text-center">#</div>
              <div className="text-center">White</div>
              <div className="text-center">Black</div>
            </div>

            {groupedMoves.map((m, index) => (
              <div key={index} className={`grid grid-cols-[40px_1fr_1fr] text-center font-mono-stats text-body-sm ${index % 2 === 0 ? 'bg-surface-container' : 'bg-surface-container-high'}`}>
                <div className="p-sm text-on-surface-variant/50 border-r border-white/5 flex items-center justify-center">{index + 1}</div>
                
                <div 
                  onClick={() => setCurrentMoveIndex(m.whiteIndex)}
                  className={`p-sm cursor-pointer transition-all flex items-center justify-center gap-1 ${
                    currentMoveIndex === m.whiteIndex ? 'bg-tertiary text-on-tertiary font-bold shadow-inner' : 'text-primary hover:bg-surface-variant'
                  }`}
                >
                  {m.white}
                  {/* Future Logic: Add Annotation Icons here */}
                </div>
                
                <div 
                  onClick={() => m.black !== '-' && setCurrentMoveIndex(m.blackIndex)}
                  className={`p-sm transition-all flex items-center justify-center gap-1 ${m.black !== '-' ? 'cursor-pointer' : ''} ${
                    currentMoveIndex === m.blackIndex ? 'bg-tertiary text-on-tertiary font-bold shadow-inner' : 'text-primary hover:bg-surface-variant'
                  }`}
                >
                  {m.black}
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* PGN Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/90 backdrop-blur-md animate-in fade-in duration-300">
           <div className="glass-panel w-full max-w-lg rounded-2xl p-lg flex flex-col gap-md border border-white/10 shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-6 h-6 text-tertiary" />
                  <h3 className="text-xl font-display-lg text-primary">Import Match Data</h3>
                </div>
                <button onClick={() => setShowImportModal(false)} className="text-on-surface-variant hover:text-white transition-colors">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <p className="text-sm text-on-surface-variant">Paste your standard PGN string below to analyze the game with Stockfish.</p>
              
              <textarea 
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="1. e4 e5 2. Nf3 Nc6..."
                className="w-full h-48 bg-surface-container text-on-surface font-mono text-sm p-md rounded-lg border border-white/10 focus:outline-none focus:border-tertiary transition-colors resize-none"
              />

              {importError && (
                <div className="flex items-center gap-2 text-error text-xs font-title-md bg-error/10 p-sm rounded border border-error/20">
                  <AlertTriangle className="w-4 h-4" /> {importError}
                </div>
              )}

              <div className="flex gap-md pt-md">
                <button 
                  onClick={() => setShowImportModal(false)}
                  className="flex-1 py-3 font-title-md text-on-surface-variant hover:bg-surface-variant rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleImportPGN}
                  disabled={!importText.trim()}
                  className="flex-[2] py-3 bg-tertiary hover:bg-yellow-400 text-on-tertiary font-bold rounded-lg shadow-lg shadow-tertiary/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  Analyze PGN
                </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};