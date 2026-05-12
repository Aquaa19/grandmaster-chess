import React, { useState, useEffect } from 'react';
import { 
  Globe, UserPlus, Swords, ArrowLeft, Loader2, 
  Copy, Check, ShieldCheck, Zap, Users, AlertCircle 
} from 'lucide-react';
import { 
  collection, doc, setDoc, getDoc, getDocs, 
  onSnapshot, deleteDoc, serverTimestamp 
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';

import { db, appId } from '../config/firebase';

type ScreenState = 'login' | 'profile' | 'home' | 'local' | 'ai' | 'history' | 'replay' | 'online_lobby' | 'online_match';

interface OnlineLobbyScreenProps {
  user: FirebaseUser | null;
  onNavigate: (s: ScreenState, matchId?: string) => void;
}

export const OnlineLobbyScreen: React.FC<OnlineLobbyScreenProps> = ({ user, onNavigate }) => {
  const [view, setView] = useState<'selection' | 'matchmaking' | 'private'>('selection');
  const [matchmakingStatus, setMatchmakingStatus] = useState<'idle' | 'searching' | 'found'>('idle');
  const [joinId, setJoinId] = useState('');
  const [createdMatchId, setCreatedMatchId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (matchmakingStatus !== 'searching' || !user) return;

    const matchmakingRef = doc(db, 'artifacts', appId, 'public', 'data', 'online_matchmaking', user.uid);
    
    const startSearch = async () => {
      try {
        await setDoc(matchmakingRef, {
          userId: user.uid,
          userName: user.displayName || 'Anonymous Player',
          status: 'searching',
          timestamp: serverTimestamp()
        });

        const queueRef = collection(db, 'artifacts', appId, 'public', 'data', 'online_matchmaking');
        const snapshot = await getDocs(queueRef);
        
        let foundOpponent: any = null;
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (docSnap.id !== user.uid && data.status === 'searching') {
            foundOpponent = { id: docSnap.id, ...data };
          }
        });

        if (foundOpponent) {
          const newMatchId = crypto.randomUUID();
          const matchRef = doc(db, 'artifacts', appId, 'public', 'data', 'online_matches', newMatchId);
          
          await setDoc(matchRef, {
            id: newMatchId,
            whiteId: foundOpponent.userId,
            blackId: user.uid,
            turn: 'w',
            status: 'pending',
            whiteAccepted: false,
            blackAccepted: false,
            whiteTime: 600,
            blackTime: 600,
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            pgn: '',
            lastUpdated: serverTimestamp()
          });

          const opponentMatchmakingRef = doc(db, 'artifacts', appId, 'public', 'data', 'online_matchmaking', foundOpponent.userId);
          await setDoc(opponentMatchmakingRef, { matchId: newMatchId, status: 'matched' }, { merge: true });
          
          await deleteDoc(matchmakingRef);
          onNavigate('online_match', newMatchId);
        }
      } catch (err) {
        console.error("Matchmaking error:", err);
        setError("Failed to connect to matchmaking server.");
        setMatchmakingStatus('idle');
      }
    };

    startSearch();

    const unsubscribe = onSnapshot(matchmakingRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.status === 'matched' && data.matchId) {
          deleteDoc(matchmakingRef);
          onNavigate('online_match', data.matchId);
        }
      }
    });

    return () => {
      unsubscribe();
      deleteDoc(matchmakingRef).catch(() => {});
    };
  }, [matchmakingStatus, user, onNavigate]);

  const handleCreatePrivate = async () => {
    if (!user) return;
    const newMatchId = crypto.randomUUID().split('-')[0].toUpperCase();
    
    try {
      const matchRef = doc(db, 'artifacts', appId, 'public', 'data', 'online_matches', newMatchId);
      await setDoc(matchRef, {
        id: newMatchId,
        whiteId: user.uid,
        blackId: null,
        turn: 'w',
        status: 'waiting',
        whiteAccepted: false,
        blackAccepted: false,
        whiteTime: 600,
        blackTime: 600,
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn: '',
        lastUpdated: serverTimestamp()
      });
      
      setCreatedMatchId(newMatchId);
      setView('private');

      onSnapshot(matchRef, (snapshot) => {
        if (snapshot.exists() && snapshot.data().status === 'pending') {
          onNavigate('online_match', newMatchId);
        }
      });
    } catch (err) {
      setError("Could not create private room.");
    }
  };

  const handleJoinPrivate = async () => {
    if (!user || !joinId) return;
    const cleanId = joinId.trim().toUpperCase();
    
    try {
      const matchRef = doc(db, 'artifacts', appId, 'public', 'data', 'online_matches', cleanId);
      const docSnap = await getDoc(matchRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status !== 'waiting') {
          setError("This match is no longer available.");
          return;
        }

        await setDoc(matchRef, {
          blackId: user.uid,
          status: 'pending',
          lastUpdated: serverTimestamp()
        }, { merge: true });

        onNavigate('online_match', cleanId);
      } else {
        setError("Invalid Match ID.");
      }
    } catch (err) {
      setError("Error joining match.");
    }
  };

  const copyToClipboard = () => {
    if (createdMatchId) {
      const el = document.createElement('textarea');
      el.value = createdMatchId;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="w-full flex flex-col gap-8 max-w-4xl mx-auto pt-6 pb-12 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => view === 'selection' ? onNavigate('home') : setView('selection')}
          className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border border-white/5 active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-3xl font-serif text-slate-200">Ranked Arena</h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-sans">Competitive Multiplayer</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg flex items-center gap-2 text-red-400 font-medium animate-in slide-in-from-top-2">
           <AlertCircle className="w-5 h-5" /> {error}
        </div>
      )}

      {view === 'selection' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button 
            onClick={() => setMatchmakingStatus('searching')}
            className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-2xl p-8 flex flex-col items-center text-center gap-4 hover:border-yellow-500/50 transition-all group relative overflow-hidden"
          >
            <div className="w-20 h-20 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 group-hover:scale-110 transition-transform">
              <Globe className="w-10 h-10 text-yellow-500" />
            </div>
            <div>
              <h3 className="text-2xl font-serif text-slate-200 mb-1">Global Match</h3>
              <p className="text-sm text-slate-400">Queue up for a ranked battle against a random opponent.</p>
            </div>
            <div className="mt-auto pt-4 flex items-center gap-2 text-yellow-500 font-sans tracking-widest uppercase text-xs">
              Find Opponent <Zap className="w-4 h-4 fill-yellow-500" />
            </div>
          </button>

          <button 
            onClick={() => setView('private')}
            className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-2xl p-8 flex flex-col items-center text-center gap-4 hover:border-slate-400/50 transition-all group"
          >
            <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
              <UserPlus className="text-slate-200 w-10 h-10" />
            </div>
            <div>
              <h3 className="text-2xl font-serif text-slate-200 mb-1">Play with Friend</h3>
              <p className="text-sm text-slate-400">Create a private room or join an existing match using a unique room ID.</p>
            </div>
            <div className="mt-auto pt-4 flex items-center gap-2 text-slate-200 font-sans tracking-widest uppercase text-xs">
              Lobby Options <Users className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {matchmakingStatus === 'searching' && (
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-2xl p-8 md:p-12 flex flex-col items-center justify-center text-center gap-8 min-h-[400px] w-full min-w-[320px] md:min-w-[500px] max-w-[512px] mx-auto">
          <div className="relative shrink-0">
            <div className="w-32 h-32 rounded-full border-4 border-yellow-500/10 border-t-yellow-500 animate-spin" />
            <Globe className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 text-yellow-500 animate-pulse" />
          </div>
          <div className="w-full shrink-0">
            <h3 className="text-3xl md:text-4xl font-serif text-slate-200 mb-2 whitespace-nowrap">Searching for Rival...</h3>
            <p className="text-lg text-slate-400 w-full italic">"Every chess master was once a beginner."</p>
          </div>
          <button 
            onClick={() => setMatchmakingStatus('idle')}
            className="px-8 py-2 bg-slate-800 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors border border-white/5 font-medium shrink-0"
          >
            Cancel Queue
          </button>
          <div className="mt-4 flex items-center justify-center gap-2 text-slate-500 font-mono text-xs tracking-tighter uppercase shrink-0 w-full whitespace-nowrap">
            <ShieldCheck className="w-4 h-4" /> Secure Ranked Protocol Active
          </div>
        </div>
      )}

      {view === 'private' && (
        <div className="flex flex-col gap-6 animate-in slide-in-from-right-4 duration-500">
          {!createdMatchId ? (
            <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-2xl p-8 flex flex-col items-center gap-6">
              <div className="text-center">
                <h3 className="text-2xl font-serif text-slate-200 mb-1">Create Private Room</h3>
                <p className="text-sm text-slate-400">Initialize a new secure match instance.</p>
              </div>
              <button 
                onClick={handleCreatePrivate}
                className="w-full max-w-xs bg-yellow-500 text-slate-900 font-bold py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/20 hover:scale-105 active:scale-95 transition-all"
              >
                <Swords className="w-5 h-5" /> Generate Match Key
              </button>
            </div>
          ) : (
            <div className="bg-slate-900/60 backdrop-blur-md border border-yellow-500/30 rounded-2xl p-8 flex flex-col items-center gap-6">
              <div className="text-center">
                <h3 className="text-2xl font-serif text-slate-200 mb-1">Lobby Ready</h3>
                <p className="text-sm text-slate-400">Share this key with your opponent.</p>
              </div>
              <div className="flex w-full max-w-[384px] gap-2">
                <div className="flex-1 bg-slate-950 border border-white/10 rounded-lg py-3 px-6 text-center font-mono text-2xl tracking-widest text-yellow-500">
                  {createdMatchId}
                </div>
                <button 
                  onClick={copyToClipboard}
                  className={`w-14 flex items-center justify-center rounded-lg border transition-all ${copied ? 'bg-green-500/20 border-green-500 text-green-500' : 'bg-slate-800 border-white/10 text-slate-400 hover:text-white'}`}
                >
                  {copied ? <Check className="w-6 h-6" /> : <Copy className="w-6 h-6" />}
                </button>
              </div>
              <div className="flex items-center gap-2 text-slate-500 animate-pulse font-sans tracking-widest text-[10px]">
                <Loader2 className="w-3 h-3 animate-spin" /> Awaiting Second Player...
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 my-4 opacity-20">
             <div className="flex-1 h-px bg-white" />
             <span className="text-xs font-sans">OR</span>
             <div className="flex-1 h-px bg-white" />
          </div>

          <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-2xl p-8 flex flex-col items-center gap-6">
            <div className="text-center">
              <h3 className="text-2xl font-serif text-slate-200 mb-1">Join Existing Room</h3>
              <p className="text-sm text-slate-400">Enter a valid Match Key.</p>
            </div>
            <div className="w-full max-w-[384px] flex gap-2">
              <input 
                type="text" 
                placeholder="EX: A1B2C3D4"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value.toUpperCase())}
                className="flex-1 bg-slate-950 border border-white/20 rounded-lg px-6 py-3 font-mono text-xl tracking-widest text-slate-200 focus:outline-none focus:border-yellow-500 transition-colors"
              />
              <button 
                onClick={handleJoinPrivate}
                disabled={!joinId || joinId.length < 4}
                className="bg-slate-200 text-slate-900 font-bold px-8 rounded-lg hover:bg-white disabled:opacity-30 transition-all active:scale-95"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};