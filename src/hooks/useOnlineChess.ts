import { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import type { Move, Square } from 'chess.js';
import { doc, onSnapshot, updateDoc, setDoc, serverTimestamp, increment, getDoc } from 'firebase/firestore';
import { db, appId } from '../config/firebase';

export interface OnlineMatchState {
  fen: string;
  pgn: string;
  whiteId: string;
  blackId: string;
  whiteAccepted?: boolean;
  blackAccepted?: boolean;
  whiteTime: number;
  blackTime: number;
  turn: 'w' | 'b';
  status: 'waiting' | 'pending' | 'ongoing' | 'completed' | 'paused' | 'resigned' | 'rejected';
  winner: string | null;
  winnerId: string | null;
  lastMoveAt: any;
}

export const useOnlineChess = (matchId: string | null, userId: string | null) => {
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [moveHistory, setMoveHistory] = useState<Move[]>([]);
  const [matchData, setMatchData] = useState<OnlineMatchState | null>(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [playerColor, setPlayerColor] = useState<'w' | 'b' | null>(null);
  const [opponentProfile, setOpponentProfile] = useState<any>(null);
  
  const [whiteTime, setWhiteTime] = useState(600);
  const [blackTime, setBlackTime] = useState(600);
  
  const isLocalUpdate = useRef(false);
  const xpProcessed = useRef(false);

  const opponentId = matchData ? (playerColor === 'w' ? matchData.blackId : matchData.whiteId) : null;
  const hasAccepted = matchData ? (playerColor === 'w' ? matchData.whiteAccepted : matchData.blackAccepted) : false;

  // Fetch Opponent Profile Details
  useEffect(() => {
    if (!opponentId) return;
    const profileRef = doc(db, 'artifacts', appId, 'users', opponentId, 'profile', 'data');
    getDoc(profileRef).then(snap => {
      if (snap.exists()) setOpponentProfile(snap.data());
    });
  }, [opponentId]);

  // Sync with Firestore
  useEffect(() => {
    if (!matchId || !userId) return;

    const matchRef = doc(db, 'artifacts', appId, 'public', 'data', 'online_matches', matchId);

    const unsubscribe = onSnapshot(matchRef, (snapshot) => {
      if (!snapshot.exists()) return;

      const data = snapshot.data() as OnlineMatchState;
      setMatchData(data);

      if (data.whiteId === userId) setPlayerColor('w');
      else if (data.blackId === userId) setPlayerColor('b');

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
      
      isLocalUpdate.current = false;
    }, (error) => {
      console.error("Online sync error:", error);
    });

    return () => unsubscribe();
  }, [matchId, userId]);

  // Networked Timer Logic
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

  // Process XP and Stats on Match End
  useEffect(() => {
    if (!matchData || !userId || xpProcessed.current) return;
    
    if (matchData.status === 'completed' || matchData.status === 'resigned') {
      xpProcessed.current = true;
      const profileRef = doc(db, 'artifacts', appId, 'users', userId, 'profile', 'data');

      let xpChange = 0;
      let winChange = 0;
      let lossChange = 0;

      if (matchData.winnerId === userId) {
        xpChange = 50; 
        winChange = 1;
      } else if (matchData.winnerId && matchData.winnerId !== userId) {
        xpChange = -50; 
        lossChange = 1;
      }

      if (xpChange !== 0 || winChange !== 0 || lossChange !== 0) {
        setDoc(profileRef, {
          onlineStats: {
            xp: increment(xpChange),
            wins: increment(winChange),
            losses: increment(lossChange),
          }
        }, { merge: true }).catch(e => console.error("Failed to update stats", e));
      }
    }
  }, [matchData?.status, matchData?.winnerId, userId]);

  // Make Move
  const makeOnlineMove = useCallback(async (source: string, target: string, promotion: string = 'q') => {
    if (!matchId || !matchData || !isMyTurn || matchData.status !== 'ongoing') return false;

    try {
      const gameCopy = new Chess();
      gameCopy.loadPgn(game.pgn());
      const move = gameCopy.move({ from: source, to: target, promotion });

      if (move) {
        isLocalUpdate.current = true; 
        
        const matchRef = doc(db, 'artifacts', appId, 'public', 'data', 'online_matches', matchId);
        const isMate = gameCopy.isCheckmate();
        
        await updateDoc(matchRef, {
          fen: gameCopy.fen(),
          pgn: gameCopy.pgn(),
          turn: gameCopy.turn(),
          whiteTime: whiteTime, 
          blackTime: blackTime,
          status: isMate ? 'completed' : 'ongoing',
          winner: isMate ? (playerColor === 'w' ? 'White' : 'Black') : null,
          winnerId: isMate ? userId : null,
          lastMoveAt: serverTimestamp()
        });

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
  }, [matchId, matchData, isMyTurn, game, whiteTime, blackTime, playerColor, userId]);

  // Acceptance Logic
  const acceptMatch = useCallback(async () => {
    if (!matchId || !matchData || !playerColor) return;
    const matchRef = doc(db, 'artifacts', appId, 'public', 'data', 'online_matches', matchId);
    
    const field = playerColor === 'w' ? 'whiteAccepted' : 'blackAccepted';
    const otherField = playerColor === 'w' ? matchData.blackAccepted : matchData.whiteAccepted;
    
    const updates: any = { [field]: true };
    if (otherField) {
      updates.status = 'ongoing';
    }
    
    await updateDoc(matchRef, updates);
  }, [matchId, matchData, playerColor]);

  const rejectMatch = useCallback(async () => {
    if (!matchId) return;
    const matchRef = doc(db, 'artifacts', appId, 'public', 'data', 'online_matches', matchId);
    await updateDoc(matchRef, { status: 'rejected' });
  }, [matchId]);

  // Resign Logic
  const resignMatch = useCallback(async () => {
    if (!matchId || !userId || !matchData || matchData.status !== 'ongoing') return;
    
    const matchRef = doc(db, 'artifacts', appId, 'public', 'data', 'online_matches', matchId);
    const opponentWinId = matchData.whiteId === userId ? matchData.blackId : matchData.whiteId;
    const opponentColor = matchData.whiteId === userId ? 'Black' : 'White';

    await updateDoc(matchRef, {
      status: 'resigned',
      winner: opponentColor,
      winnerId: opponentWinId,
      lastMoveAt: serverTimestamp()
    });
  }, [matchId, userId, matchData]);

  // Pause Logic (with Timer sync)
  const togglePause = useCallback(async () => {
    if (!matchId || !matchData) return;
    const matchRef = doc(db, 'artifacts', appId, 'public', 'data', 'online_matches', matchId);
    await updateDoc(matchRef, {
      status: matchData.status === 'paused' ? 'ongoing' : 'paused',
      whiteTime,
      blackTime
    });
  }, [matchId, matchData?.status, whiteTime, blackTime]);

  return {
    game,
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
    isGameOver: game.isGameOver() || matchData?.status === 'resigned' || matchData?.status === 'rejected',
    isCheckmate: game.isCheckmate()
  };
};