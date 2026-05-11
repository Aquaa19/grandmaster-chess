// /home/aquaax19/Workspace/Projects/Chess/grandmaster-chess/src/screens/ProfileScreen.tsx

import React, { useState } from 'react';
import { 
  User, 
  ArrowRight, 
  TowerControl, 
  Bot, 
  Castle, 
  Gamepad2, 
  BrainCircuit, 
  Gem,
  Loader2
} from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, appId } from '../config/firebase';

interface ProfileScreenProps {
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

const ProfileScreen: React.FC<ProfileScreenProps> = ({ user, onContinue }) => {
  const [selectedAvatar, setSelectedAvatar] = useState<number>(1);
  const [playerName, setPlayerName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If user isn't logged in, just proceed without saving to DB
    if (!user) {
      onContinue();
      return;
    }

    setSaving(true);
    try {
      // Rule 1: Always use the exact namespaced path for private user data
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
      await setDoc(profileRef, {
        name: playerName || 'Guest Player',
        avatarId: selectedAvatar,
        updatedAt: serverTimestamp()
      });
      onContinue();
    } catch (error) {
      console.error("Error saving profile:", error);
      // Even if saving fails, let them play
      onContinue();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-background text-on-background min-h-screen flex items-center justify-center p-md relative overflow-hidden fade-slide-up">
      
      {/* Decorative background elements */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-tertiary/5 blur-[100px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-primary/5 blur-[100px]" />
      </div>

      <main className="w-full max-w-[448px] mx-auto glass-panel rounded-xl p-xl shadow-2xl relative z-10">
        <div className="text-center mb-xl">
          <h1 className="font-display-lg text-display-lg text-primary mb-sm">Create Profile</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">Forging your identity on the board.</p>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-xl">
          
          {/* Player Name Input */}
          <div className="space-y-sm">
            <label htmlFor="player-name" className="font-label-caps text-label-caps text-on-surface uppercase tracking-widest block">
              Player Name
            </label>
            <div className="relative">
              <User className="absolute left-md top-1/2 -translate-y-1/2 text-on-surface-variant w-5 h-5" />
              <input 
                type="text" 
                id="player-name" 
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your moniker" 
                className="w-full bg-surface-container text-on-surface font-body-lg text-body-lg border border-white/20 rounded-DEFAULT py-md pl-12 pr-md focus:outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary transition-colors duration-200 placeholder:text-on-surface-variant/50"
              />
            </div>
          </div>

          {/* Avatar Selection */}
          <div className="space-y-md">
            <label className="font-label-caps text-label-caps text-on-surface uppercase tracking-widest block">
              Select Avatar
            </label>
            <div className="grid grid-cols-3 gap-md">
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
                  <div className="aspect-square rounded-DEFAULT border-2 border-transparent peer-checked:border-tertiary bg-surface-container flex items-center justify-center relative overflow-hidden transition-all duration-200 group-hover:border-white/30 peer-checked:group-hover:border-tertiary">
                    <Icon className={`w-8 h-8 transition-colors ${selectedAvatar === id ? 'text-tertiary' : 'text-on-surface-variant'}`} />
                    <div className={`absolute inset-0 bg-tertiary/10 transition-opacity ${selectedAvatar === id ? 'opacity-100' : 'opacity-0'}`} />
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-md">
            <button 
              type="submit" 
              disabled={saving}
              className="w-full bg-primary text-on-primary font-title-md text-title-md py-md px-lg rounded-DEFAULT hover:bg-white transition-colors duration-200 flex items-center justify-center gap-sm group disabled:opacity-50 active:scale-95"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>
          
        </form>
      </main>
    </div>
  );
};

export default ProfileScreen;