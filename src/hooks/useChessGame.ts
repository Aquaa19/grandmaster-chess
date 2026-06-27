// /home/aquaax19/Workspace/Projects/Chess/grandmaster-chess/src/hooks/useChessGame.ts

import { useState, useEffect, useCallback } from 'react';
import { Chess } from 'chess.js';
import type { Move, Square } from 'chess.js';
import { playMoveSound, playCaptureSound, playCheckSound } from '../utils/audio';

export const useChessGame = (initialTimeSeconds: number = 600, incrementSeconds: number = 0) => {
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [moveHistory, setMoveHistory] = useState<Move[]>([]);
  
  // Generate a unique ID for the current match, explicitly typed as string
  const [matchId, setMatchId] = useState<string>(() => crypto.randomUUID());
  
  // Dynamic Timers & Pause State
  const [whiteTime, setWhiteTime] = useState(initialTimeSeconds);
  const [blackTime, setBlackTime] = useState(initialTimeSeconds);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Timer Countdown Effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    // Only run the timer if active, NOT paused, and the game isn't over
    if (isTimerActive && !isPaused && !game.isGameOver()) {
      interval = setInterval(() => {
        if (game.turn() === 'w') {
          setWhiteTime((prev) => {
            if (prev <= 1) setIsTimerActive(false); // Flag on timeout
            return Math.max(0, prev - 1);
          });
        } else {
          setBlackTime((prev) => {
            if (prev <= 1) setIsTimerActive(false); // Flag on timeout
            return Math.max(0, prev - 1);
          });
        }
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [isTimerActive, isPaused, game]);

  const makeMove = useCallback((source: string, target: string, promotion: string = 'q') => {
    // Block moves if the game is paused
    if (isPaused) return false;

    try {
      // Clone using PGN to preserve full move history instead of FEN
      const gameCopy = new Chess();
      gameCopy.loadPgn(game.pgn());
      const move = gameCopy.move({ from: source, to: target, promotion });
      
      if (move) {
        setGame(gameCopy);
        setFen(gameCopy.fen());
        setMoveHistory(gameCopy.history({ verbose: true }) as Move[]);
        
        // Play appropriate sound effect
        if (gameCopy.inCheck()) {
          playCheckSound();
        } else if (move.captured || move.flags.includes('c') || move.flags.includes('e')) {
          playCaptureSound();
        } else {
          playMoveSound();
        }

        // Start the timer on the very first move of the match
        if (!isTimerActive && !gameCopy.isGameOver()) {
          setIsTimerActive(true);
        }
        
        // Stop timer if checkmate or draw
        if (gameCopy.isGameOver()) {
          setIsTimerActive(false);
        } else {
          // Apply Fisher increment if game continues
          if (move.color === 'w') {
            setWhiteTime((prev) => prev + incrementSeconds);
          } else {
            setBlackTime((prev) => prev + incrementSeconds);
          }
        }
        
        return true;
      }
    } catch (e) {
      return false; // Invalid move
    }
    return false;
  }, [game, isTimerActive, isPaused]);

  const undoMove = useCallback(() => {
    // Clone using PGN to preserve history
    const gameCopy = new Chess();
    gameCopy.loadPgn(game.pgn());
    gameCopy.undo(); // Undo current player's move
    setGame(gameCopy);
    setFen(gameCopy.fen());
    setMoveHistory(gameCopy.history({ verbose: true }) as Move[]);
  }, [game]);

  const resetGame = useCallback(() => {
    const newGame = new Chess();
    setGame(newGame);
    setFen(newGame.fen());
    setMoveHistory([]);
    setWhiteTime(initialTimeSeconds);
    setBlackTime(initialTimeSeconds);
    setIsTimerActive(false);
    setIsPaused(false);
    setMatchId(crypto.randomUUID()); // Generate a new ID on reset
  }, [initialTimeSeconds]);

  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  // --- SMART RESUME: Load an existing game state ---
  const loadGame = useCallback((savedMoves: string[], savedMatchId: string, savedWhiteTime: number, savedBlackTime: number) => {
    const newGame = new Chess();
    
    // Reconstruct the board by playing through the saved SAN moves
    for (const move of savedMoves) {
      try {
        newGame.move(move);
      } catch (e) {
        console.error("Failed to parse saved move during resume:", move);
        break; // Stop parsing if corrupted
      }
    }
    
    setGame(newGame);
    setFen(newGame.fen());
    setMoveHistory(newGame.history({ verbose: true }) as Move[]);
    
    setMatchId(savedMatchId);
    setWhiteTime(savedWhiteTime ?? initialTimeSeconds);
    setBlackTime(savedBlackTime ?? initialTimeSeconds);
    
    // Load the game in a paused state so timers don't instantly start running
    setIsTimerActive(true);
    setIsPaused(true);
  }, [initialTimeSeconds]);

  // Determine if the current player's king is in check for highlighting
  let inCheckSquare: Square | null = null;
  if (game.inCheck() || game.isCheckmate()) {
    const board = game.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type === 'k' && piece.color === game.turn()) {
          inCheckSquare = piece.square as Square;
        }
      }
    }
  }

  // Format time utility for the UI (e.g., 605 -> "10:05")
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return { 
    game, 
    fen, 
    turn: game.turn(), 
    isGameOver: game.isGameOver(), 
    isCheckmate: game.isCheckmate(), 
    isTimeOut: whiteTime === 0 || blackTime === 0,
    inCheckSquare, 
    moveHistory, 
    makeMove, 
    undoMove, 
    resetGame, 
    whiteTime, 
    blackTime,
    formatTime,
    matchId,
    isPaused,
    togglePause,
    loadGame
  };
};