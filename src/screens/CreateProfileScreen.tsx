// /home/aquaax19/Workspace/Projects/Chess/grandmaster-chess/src/screens/CreateProfileScreen.tsx

import React, { useState } from 'react';
import { 
  User, ArrowRight, TowerControl, Bot, Castle, Gamepad2, 
  BrainCircuit, Gem, Loader2
} from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, appId } from '../config/firebase';

interface CreateProfileScreenProps {
  user: FirebaseUser | null;
  onContinue: () => void;
}

const avatars = [
  { id: 1, icon: TowerControl },
  { id: 2, icon: Bot },
  { id: 3, icon: Castle },
  { id: 4, icon: Gamepad2 },
  { id: 5, icon: BrainCircuit },
  { id: 6, icon: Gem },
];

export const CreateProfileScreen: React.FC<CreateProfileScreenProps> = ({ user, onContinue }) => {
  const [selectedAvatar, setSelectedAvatar] = useState<number>(1);
  const [playerName, setPlayerName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      onContinue();
      return;
    }

    setSaving(true);
    try {
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
      
      // Initialize the full profile structure for a new user
      await setDoc(profileRef, {
        name: playerName || 'Guest Player',
        avatarId: selectedAvatar,
        updatedAt: serverTimestamp(),
        aiStats: { xp: 0, wins: 0, losses: 0 },
        onlineStats: { xp: 0, wins: 0, losses: 0 }
      }, { merge: true });

      onContinue();
    } catch (error) {
      console.error("Error creating profile:", error);
      onContinue(); // Let them through even if it fails, fallback to guest
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-background text-on-background min-h-screen flex items-center justify-center p-4 md:p-8 relative overflow-hidden fade-slide-up w-full">
      
      {/* Decorative background elements */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-tertiary/5 blur-[100px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-primary/5 blur-[100px]" />
      </div>

      <main className="w-full max-w-[448px] mx-auto relative z-10 glass-panel rounded-2xl p-8 md:p-12 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="font-display-lg text-4xl text-primary mb-2">Create Profile</h1>
          <p className="font-body-lg text-on-surface-variant">Forging your identity on the board.</p>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-8">
          
          <div className="space-y-3">
            <label htmlFor="player-name" className="font-label-caps text-xs text-on-surface uppercase tracking-widest block">
              Player Name
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant w-5 h-5" />
              <input 
                type="text" 
                id="player-name" 
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your moniker" 
                className="w-full bg-surface-container text-on-surface font-body-lg border border-white/20 rounded-lg py-3 pl-12 pr-4 focus:outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary transition-colors duration-200"
                maxLength={20}
                required
              />
            </div>
          </div>

          <div className="space-y-4">
            <label className="font-label-caps text-xs text-on-surface uppercase tracking-widest block">
              Select Avatar
            </label>
            <div className="grid grid-cols-3 gap-4">
              {avatars.map(({ id, icon: Icon }) => (
                <label key={id} className="cursor-pointer group">
                  <input 
                    type="radio" 
                    name="avatar" 
                    value={id} 
                    checked={selectedAvatar === id}
                    onChange={() => setSelectedAvatar(id)}
                    className="peer sr-only" 
                  />
                  <div className="aspect-square rounded-xl border-2 border-transparent peer-checked:border-tertiary bg-surface-container flex items-center justify-center relative overflow-hidden transition-all duration-200 group-hover:border-white/30">
                    <Icon className={`w-8 h-8 transition-colors ${selectedAvatar === id ? 'text-tertiary' : 'text-on-surface-variant'}`} />
                    <div className={`absolute inset-0 bg-tertiary/10 transition-opacity ${selectedAvatar === id ? 'opacity-100' : 'opacity-0'}`} />
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 flex gap-4">
            <button 
              type="submit" 
              disabled={saving}
              className="flex-1 bg-tertiary text-on-tertiary font-title-md py-3 rounded-lg hover:bg-yellow-400 transition-colors flex items-center justify-center gap-2 group disabled:opacity-50 active:scale-95 shadow-lg shadow-tertiary/20"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <><span>Continue</span> <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>
              )}
            </button>
          </div>
          
        </form>
      </main>
    </div>
  );
};