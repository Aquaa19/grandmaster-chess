// /home/aquaax19/Workspace/Projects/Chess/grandmaster-chess/src/hooks/useOnlineChess.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import type { Move, Square } from 'chess.js';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, appId } from '../config/firebase';

export interface OnlineMatchState {
  fen: string;
  pgn: string;
  whiteId: string;
  blackId: string;
  whiteTime: number;
  blackTime: number;
  turn: 'w' | 'b';
  status: 'waiting' | 'ongoing' | 'completed' | 'paused';
  winner: string | null;
  lastMoveAt: any;
}

export const useOnlineChess = (matchId: string | null, userId: string | null) => {
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [moveHistory, setMoveHistory] = useState<Move[]>([]);
  const [matchData, setMatchData] = useState<OnlineMatchState | null>(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [playerColor, setPlayerColor] = useState<'w' | 'b' | null>(null);
  
  const [whiteTime, setWhiteTime] = useState(600);
  const [blackTime, setBlackTime] = useState(600);
  
  // Use a ref to prevent local updates from triggering redundant snapshot logic
  const isLocalUpdate = useRef(false);

  // 1. Sync with Firestore
  useEffect(() => {
    if (!matchId || !userId) return;

    // Rule 1: Use strictly namespaced public path for collaborative data
    const matchRef = doc(db, 'artifacts', appId, 'public', 'data', 'online_matches', matchId);

    const unsubscribe = onSnapshot(matchRef, (snapshot) => {
      if (!snapshot.exists()) return;

      const data = snapshot.data() as OnlineMatchState;
      setMatchData(data);

      // Determine player color
      if (data.whiteId === userId) setPlayerColor('w');
      else if (data.blackId === userId) setPlayerColor('b');

      // Sync local chess engine if the move came from the opponent
      if (!isLocalUpdate.current) {
        const newGame = new Chess();
        if (data.pgn) {
          newGame.loadPgn(data.pgn);
        } else {
          newGame.load(data.fen);
        }
        setGame(newGame);
        setFen(newGame.fen());
        setMoveHistory(newGame.history({ verbose: true }) as Move[]);
      }

      setWhiteTime(data.whiteTime);
      setBlackTime(data.blackTime);
      setIsMyTurn(data.turn === (data.whiteId === userId ? 'w' : 'b'));
      
      // Reset local update flag after processing snapshot
      isLocalUpdate.current = false;
    }, (error) => {
      console.error("Online sync error:", error);
    });

    return () => unsubscribe();
  }, [matchId, userId]);

  // 2. Networked Timer Logic
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    if (matchData?.status === 'ongoing') {
      interval = setInterval(() => {
        if (matchData.turn === 'w') {
          setWhiteTime(prev => Math.max(0, prev - 1));
        } else {
          setBlackTime(prev => Math.max(0, prev - 1));
        }
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [matchData?.status, matchData?.turn]);

  // 3. Make Move (Remote Update)
  const makeOnlineMove = useCallback(async (source: string, target: string, promotion: string = 'q') => {
    if (!matchId || !matchData || !isMyTurn || matchData.status !== 'ongoing') return false;

    try {
      const gameCopy = new Chess();
      gameCopy.loadPgn(game.pgn());
      const move = gameCopy.move({ from: source, to: target, promotion });

      if (move) {
        isLocalUpdate.current = true; // Mark that we are initiating the update
        
        const matchRef = doc(db, 'artifacts', appId, 'public', 'data', 'online_matches', matchId);
        
        // Update Firestore - This triggers the opponent's onSnapshot
        await updateDoc(matchRef, {
          fen: gameCopy.fen(),
          pgn: gameCopy.pgn(),
          turn: gameCopy.turn(),
          whiteTime: whiteTime, // Sync local timer state to DB
          blackTime: blackTime,
          status: gameCopy.isGameOver() ? 'completed' : 'ongoing',
          winner: gameCopy.isCheckmate() ? (playerColor === 'w' ? 'White' : 'Black') : null,
          lastMoveAt: serverTimestamp()
        });

        // Update local state immediately for responsiveness
        setGame(gameCopy);
        setFen(gameCopy.fen());
        setMoveHistory(gameCopy.history({ verbose: true }) as Move[]);
        setIsMyTurn(false);
        
        return true;
      }
    } catch (e) {
      console.error("Invalid online move:", e);
      return false;
    }
    return false;
  }, [matchId, matchData, isMyTurn, game, whiteTime, blackTime, playerColor]);

  const togglePause = useCallback(async () => {
    if (!matchId) return;
    const matchRef = doc(db, 'artifacts', appId, 'public', 'data', 'online_matches', matchId);
    await updateDoc(matchRef, {
      status: matchData?.status === 'paused' ? 'ongoing' : 'paused'
    });
  }, [matchId, matchData?.status]);

  return {
    game,
    fen,
    moveHistory,
    matchData,
    isMyTurn,
    playerColor,
    whiteTime,
    blackTime,
    makeOnlineMove,
    togglePause,
    isGameOver: game.isGameOver(),
    isCheckmate: game.isCheckmate()
  };
};