// /home/aquaax19/Workspace/Projects/Chess/grandmaster-chess/src/App.tsx

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, appId } from './config/firebase';
import { Loader2 } from 'lucide-react';

import LoginScreen from './screens/LoginScreen';
import ProfileScreen from './screens/ProfileScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LocalMultiplayerScreen } from './screens/LocalMultiplayerScreen';
import { SinglePlayerScreen } from './screens/SinglePlayerScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { ReplayScreen } from './screens/ReplayScreen';
import { OnlineLobbyScreen } from './screens/OnlineLobbyScreen';
import { OnlineMatchScreen } from './screens/OnlineMatchScreen';
import { AppLayout } from './components/layout/AppLayout';

// Updated ScreenState to include Online Multiplayer routes
export type ScreenState = 
  | 'login' 
  | 'profile' 
  | 'home' 
  | 'local' 
  | 'ai' 
  | 'history' 
  | 'replay' 
  | 'online_lobby' 
  | 'online_match';

declare global {
  interface Window {
    __initial_auth_token?: string;
    __firebase_config?: string;
    __app_id?: string;
  }
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenState>('login');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [playerName, setPlayerName] = useState('Guest Player');

  useEffect(() => {
    const initAuth = async () => {
      try {
        if ((window as any).__initial_auth_token) {
          await signInWithCustomToken(auth, (window as any).__initial_auth_token);
        } else {
          if (typeof window.__firebase_config !== 'undefined' && window.__firebase_config) {
            await signInAnonymously(auth);
          }
        }
      } catch (e) {
        console.error("Auth error:", e);
      }
    };
    
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      if (!u) {
        setInitializing(false);
        setCurrentScreen('login');
        return;
      }

      try {
        // Rule 1: Namespaced path for profile data
        const profileRef = doc(db, 'artifacts', appId, 'users', u.uid, 'profile', 'data');
        const docSnap = await getDoc(profileRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setPlayerName(data.name || 'Guest Player');
          setCurrentScreen('home'); 
        } else {
          setCurrentScreen('profile'); 
        }
      } catch (e) {
        console.error("Error fetching profile:", e);
        setCurrentScreen('profile'); 
      } finally {
        setInitializing(false);
      }
    });
    
    return () => unsubscribe();
  }, []);

  /**
   * Navigation handler that supports passing match IDs for 
   * Replay and Online Match screens.
   */
  const handleNavigate = (screen: ScreenState, matchId?: string) => {
    if (matchId) {
      setSelectedMatchId(matchId);
    }
    setCurrentScreen(screen);
  };

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-md">
          <Loader2 className="w-12 h-12 text-tertiary animate-spin" />
          <p className="font-label-caps text-on-surface-variant animate-pulse tracking-widest uppercase">Initializing Arena...</p>
        </div>
      </div>
    );
  }

  if (currentScreen === 'login') {
    return <LoginScreen onAuth={() => {}} />;
  }
  
  if (currentScreen === 'profile') {
    return <ProfileScreen user={user} onContinue={() => {
      setTimeout(() => setCurrentScreen('home'), 100);
    }} />;
  }

  return (
    <AppLayout 
      currentScreen={currentScreen} 
      onNavigate={handleNavigate as any}
      playerName={playerName}
    >
      {currentScreen === 'home' && (
        <HomeScreen onNavigate={handleNavigate as any} />
      )}
      
      {currentScreen === 'local' && (
        <LocalMultiplayerScreen user={user} />
      )}
      
      {currentScreen === 'ai' && (
        <SinglePlayerScreen user={user} />
      )}
      
      {currentScreen === 'history' && (
        <HistoryScreen user={user} onNavigate={handleNavigate} />
      )}
      
      {currentScreen === 'replay' && (
        <ReplayScreen 
          user={user} 
          matchId={selectedMatchId as string} 
          onNavigate={handleNavigate} 
        />
      )}

      {currentScreen === 'online_lobby' && (
        <OnlineLobbyScreen 
          user={user} 
          onNavigate={handleNavigate as any} 
        />
      )}

      {currentScreen === 'online_match' && (
        <OnlineMatchScreen 
          user={user} 
          matchId={selectedMatchId as string} 
          onNavigate={handleNavigate as any} 
        />
      )}
    </AppLayout>
  );
}