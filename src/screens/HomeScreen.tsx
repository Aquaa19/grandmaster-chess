// /home/aquaax19/Workspace/Projects/Chess/grandmaster-chess/src/screens/HomeScreen.tsx

import React from 'react';
import { Bot, Users, ArrowRight, Trophy } from 'lucide-react';
import type { ScreenState } from '../App';

interface HomeScreenProps {
  onNavigate: (screen: ScreenState) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
  return (
    <div className="w-full flex flex-col gap-xl max-w-4xl mx-auto fade-slide-up pt-md">
      
      <div className="text-center mb-md">
        <h2 className="font-display-lg text-5xl text-primary mb-sm">Choose Your Arena</h2>
        <p className="font-body-lg text-on-surface-variant">Engage in tactical warfare against AI or challenge a friend locally.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
        
        {/* Single Player Card */}
        <button 
          onClick={() => onNavigate('ai')}
          className="glass-panel rounded-2xl p-xl flex flex-col items-start text-left group hover:border-tertiary/50 transition-all duration-300 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-lg opacity-10 group-hover:opacity-20 transition-opacity">
            <Bot className="w-32 h-32 text-tertiary" />
          </div>
          <div className="w-16 h-16 rounded-xl bg-tertiary/20 flex items-center justify-center mb-lg border border-tertiary/30">
            <Bot className="w-8 h-8 text-tertiary" />
          </div>
          <h3 className="font-display-lg text-3xl text-primary mb-sm">Single Player</h3>
          <p className="font-body-lg text-on-surface-variant mb-xl flex-1">
            Battle through 5 tiers of AI difficulty. Earn XP, rank up, and unlock exclusive Grandmaster achievements.
          </p>
          <div className="flex items-center gap-sm text-tertiary font-title-md mt-auto group-hover:translate-x-2 transition-transform">
            Start Campaign <ArrowRight className="w-5 h-5" />
          </div>
        </button>

        {/* Local Multiplayer Card */}
        <button 
          onClick={() => onNavigate('local')}
          className="glass-panel rounded-2xl p-xl flex flex-col items-start text-left group hover:border-primary/50 transition-all duration-300 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-lg opacity-5 group-hover:opacity-10 transition-opacity">
            <Users className="w-32 h-32 text-primary" />
          </div>
          <div className="w-16 h-16 rounded-xl bg-surface-variant flex items-center justify-center mb-lg border border-white/10">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <h3 className="font-display-lg text-3xl text-primary mb-sm">Local Play</h3>
          <p className="font-body-lg text-on-surface-variant mb-xl flex-1">
            Classic 1v1 over-the-board action. Play against a friend on the same device with a unified clock.
          </p>
          <div className="flex items-center gap-sm text-primary font-title-md mt-auto group-hover:translate-x-2 transition-transform">
            Start Match <ArrowRight className="w-5 h-5" />
          </div>
        </button>

      </div>
      
      {/* Quick Stats Summary Placeholder */}
      <div className="mt-lg glass-panel rounded-xl p-md flex items-center justify-around border-t-2 border-t-tertiary/50">
        <div className="text-center">
          <div className="font-label-caps text-on-surface-variant text-sm tracking-widest">Total XP</div>
          <div className="font-mono-stats text-tertiary text-2xl">0</div>
        </div>
        <div className="w-px h-12 bg-white/10" />
        <div className="text-center">
          <div className="font-label-caps text-on-surface-variant text-sm tracking-widest">Matches Won</div>
          <div className="font-mono-stats text-primary text-2xl">0</div>
        </div>
        <div className="w-px h-12 bg-white/10" />
        <div className="text-center">
          <div className="font-label-caps text-on-surface-variant text-sm tracking-widest">Medals</div>
          <div className="font-mono-stats text-tertiary text-2xl flex items-center justify-center gap-xs">
            <Trophy className="w-5 h-5" /> 0
          </div>
        </div>
      </div>

    </div>
  );
};