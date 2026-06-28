import { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, appId } from './config/firebase';
import { Loader2 } from 'lucide-react';

import LoginScreen from './screens/LoginScreen';
import { CreateProfileScreen } from './screens/CreateProfileScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LocalMultiplayerScreen } from './screens/LocalMultiplayerScreen';
import { SinglePlayerScreen } from './screens/SinglePlayerScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { ReplayScreen } from './screens/ReplayScreen';
import { OnlineLobbyScreen } from './screens/OnlineLobbyScreen';
import { OnlineMatchScreen } from './screens/OnlineMatchScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { PuzzlesScreen } from './screens/PuzzlesScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { AppLayout } from './components/layout/AppLayout';
import type { BoardThemeKey, PieceThemeKey } from './components/chess/ChessBoard';
import { WelcomeTour } from './components/WelcomeTour';

// --- RESTORED GLOBAL DECLARATIONS ---
declare global {
  interface Window {
    __initial_auth_token?: string;
    __firebase_config?: string;
    __app_id?: string;
  }
}

export type ScreenState = 
  | 'login' 
  | 'create_profile' 
  | 'profile' 
  | 'home' 
  | 'local' 
  | 'ai' 
  | 'history' 
  | 'replay' 
  | 'online_lobby' 
  | 'online_match'
  | 'leaderboard'
  | 'puzzles'
  | 'settings';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenState>('login');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [playerName, setPlayerName] = useState('Guest Player');
  const [showTour, setShowTour] = useState(false);

  const [boardTheme, setBoardTheme] = useState<BoardThemeKey>('default');
  const [pieceTheme, setPieceTheme] = useState<PieceThemeKey>('cburnett');

  const currentScreenRef = useRef(currentScreen);
  useEffect(() => {
    currentScreenRef.current = currentScreen;
  }, [currentScreen]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (window.__initial_auth_token) {
          await signInWithCustomToken(auth, window.__initial_auth_token);
        } else {
          // Fixed the type access here
          if (typeof window.__firebase_config !== 'undefined' && window.__firebase_config) {
            await signInAnonymously(auth);
          }
        }
      } catch (e) {
        console.error("Auth error:", e);
      }
    };
    
    initAuth();
    
    let unsubscribeProfile: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      
      if (!u) {
        setInitializing(false);
        setCurrentScreen('login');
        setShowTour(false);
        if (unsubscribeProfile) unsubscribeProfile();
        return;
      }

      const profileRef = doc(db, 'artifacts', appId, 'users', u.uid, 'profile', 'data');
      
      unsubscribeProfile = onSnapshot(profileRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPlayerName(data.name || 'Guest Player');
          
          if (data.settings) {
            if (data.settings.boardTheme) setBoardTheme(data.settings.boardTheme);
            if (data.settings.pieceTheme) setPieceTheme(data.settings.pieceTheme);
          }

          // Trigger welcome tour onboarding if first time
          if (!localStorage.getItem(`tour_completed_${u.uid}`)) {
            setShowTour(true);
          }
          
          setInitializing((prevInit) => {
            if (prevInit || currentScreenRef.current === 'login') {
              setCurrentScreen('home');
            }
            return false;
          });
        } else {
          setCurrentScreen('create_profile'); 
          setInitializing(false);
        }
      }, (e) => {
        console.error("Error fetching profile:", e);
        setCurrentScreen('create_profile'); 
        setInitializing(false);
      });
    });
    
    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const handleNavigate = (screen: ScreenState, matchId?: string) => {
    if (matchId) setSelectedMatchId(matchId);
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

  const handleTourComplete = () => {
    if (user) {
      localStorage.setItem(`tour_completed_${user.uid}`, 'true');
    }
    setShowTour(false);
  };

  if (currentScreen === 'login') return <LoginScreen onAuth={() => {}} />;
  if (currentScreen === 'create_profile') return <CreateProfileScreen user={user} onContinue={() => setCurrentScreen('home')} />;

  return (
    <>
      <AppLayout 
        currentScreen={currentScreen} 
        onNavigate={handleNavigate as any}
        playerName={playerName}
      >
      {currentScreen === 'profile' && <ProfileScreen user={user} />}
      {currentScreen === 'leaderboard' && <LeaderboardScreen user={user} />}
      
      {currentScreen === 'puzzles' && (
        <PuzzlesScreen user={user} boardTheme={boardTheme} pieceTheme={pieceTheme} />
      )}

      {currentScreen === 'settings' && <SettingsScreen user={user} />}
      {currentScreen === 'home' && <HomeScreen user={user} onNavigate={handleNavigate as any} />}
      
      {currentScreen === 'local' && (
        <LocalMultiplayerScreen user={user} boardTheme={boardTheme} pieceTheme={pieceTheme} />
      )}
      
      {currentScreen === 'ai' && (
        <SinglePlayerScreen user={user} boardTheme={boardTheme} pieceTheme={pieceTheme} />
      )}
      
      {currentScreen === 'history' && <HistoryScreen user={user} onNavigate={handleNavigate} />}
      
      {currentScreen === 'replay' && (
        <ReplayScreen 
          user={user} 
          matchId={selectedMatchId as string} 
          onNavigate={handleNavigate}
          boardTheme={boardTheme}
          pieceTheme={pieceTheme}
        />
      )}

      {currentScreen === 'online_lobby' && <OnlineLobbyScreen user={user} onNavigate={handleNavigate as any} />}
      {currentScreen === 'online_match' && (
        <OnlineMatchScreen 
          user={user} 
          matchId={selectedMatchId as string} 
          onNavigate={handleNavigate as any}
          boardTheme={boardTheme}
          pieceTheme={pieceTheme}
        />
      )}
    </AppLayout>

    {showTour && <WelcomeTour onComplete={handleTourComplete} />}
  </>
);
}