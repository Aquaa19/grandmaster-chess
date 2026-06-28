import React from 'react';
import { Home, Bot, Users, History, Settings, UserCircle, User, Trophy, Puzzle } from 'lucide-react';
import type { ScreenState } from '../../App';

interface AppLayoutProps {
  children: React.ReactNode;
  currentScreen: ScreenState;
  onNavigate: (screen: ScreenState) => void;
  onNewGame?: () => void;
  playerName?: string;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ 
  children, 
  currentScreen, 
  onNavigate, 
  onNewGame, 
  playerName = "Guest Player" 
}) => {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'puzzles', label: 'Puzzles', icon: Puzzle },
    { id: 'ai', label: 'AI Match', icon: Bot },
    { id: 'local', label: 'Local Play', icon: Users },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'history', label: 'History', icon: History },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  return (
    <div className="bg-background text-on-background font-body-lg min-h-screen flex flex-col md:flex-row antialiased fade-slide-up">
      {/* Desktop Sidebar */}
      <nav className="hidden md:flex h-screen w-64 fixed left-0 top-0 bg-surface-container border-r border-white/5 flex-col gap-md p-lg z-40">
        <div className="mb-xl">
          <h1 className="font-display-lg text-3xl text-primary tracking-tight">Grandmaster</h1>
          <div 
            className="flex items-center gap-sm mt-md cursor-pointer hover:bg-surface-variant p-2 -ml-2 rounded-lg transition-colors group"
            onClick={() => onNavigate('profile')}
          >
            <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center border border-white/10 group-hover:border-tertiary/50 transition-colors">
               <UserCircle className="text-primary w-6 h-6 group-hover:text-tertiary transition-colors" />
            </div>
            <div>
              <div className="font-title-md text-primary">{playerName}</div>
              <div className="font-label-caps text-on-surface-variant group-hover:text-tertiary/70 transition-colors">View Stats</div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col gap-sm flex-1">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button 
              key={id}
              id={`nav-item-${id}`}
              onClick={() => onNavigate(id as ScreenState)}
              className={`flex items-center gap-md px-md py-sm rounded-lg transition-all duration-200 ${
                currentScreen === id 
                  ? 'bg-primary text-on-primary' 
                  : 'text-on-surface-variant hover:bg-surface-variant hover:text-primary'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-title-md">{label}</span>
            </button>
          ))}
        </div>
        
        {onNewGame && (
          <button onClick={onNewGame} className="mt-auto bg-tertiary text-on-tertiary font-title-md py-md px-lg rounded-lg hover:bg-tertiary-container transition-colors w-full active:scale-95 shadow-[0_0_15px_rgba(233,195,73,0.15)]">
            New Game
          </button>
        )}
      </nav>

      {/* Mobile Header */}
      <header className="md:hidden flex justify-between items-center h-16 px-lg w-full z-50 bg-surface border-b border-white/10 sticky top-0">
        <h1 className="font-display-lg text-2xl text-primary tracking-tight">Grandmaster</h1>
        <div className="flex gap-md">
          <Settings className="w-6 h-6 text-on-surface-variant hover:text-primary transition-colors cursor-pointer" />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 p-md md:p-xl flex flex-col xl:flex-row gap-xl max-w-[1440px] mx-auto w-full min-h-[calc(100vh-64px)] md:min-h-screen pb-24 md:pb-xl">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 w-full z-50 rounded-t-xl backdrop-blur-xl bg-surface-container-high/90 border-t border-white/10 shadow-xl flex justify-around items-center h-20 px-md">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button 
            key={id}
            id={`nav-item-${id}`}
            onClick={() => onNavigate(id as ScreenState)}
            className={`flex flex-col items-center justify-center transition-transform active:scale-90 ${
              currentScreen === id ? 'text-tertiary' : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <Icon className="w-6 h-6" />
            <span className="font-label-caps text-[10px] mt-xs">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};