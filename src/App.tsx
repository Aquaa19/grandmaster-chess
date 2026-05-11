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
import { AppLayout } from './components/layout/AppLayout';

export type ScreenState = 'login' | 'profile' | 'home' | 'local' | 'ai' | 'history' | 'replay';

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
          if (typeof window.__firebase_config !== 'undefined') {
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

  // Enhanced navigation handler to capture match IDs when routing
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
          <p className="font-label-caps text-on-surface-variant animate-pulse tracking-widest">INITIALIZING ARENA...</p>
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
      {currentScreen === 'home' && <HomeScreen onNavigate={handleNavigate as any} />}
      {currentScreen === 'local' && <LocalMultiplayerScreen user={user} />}
      {currentScreen === 'ai' && <SinglePlayerScreen user={user} />}
      {currentScreen === 'history' && <HistoryScreen user={user} onNavigate={handleNavigate} />}
      {currentScreen === 'replay' && <ReplayScreen user={user} matchId={selectedMatchId as string} onNavigate={handleNavigate} />}
    </AppLayout>
  );
}