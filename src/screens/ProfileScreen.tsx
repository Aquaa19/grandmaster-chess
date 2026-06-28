import React, { useState, useEffect } from 'react';
import { 
  User, TowerControl, Bot, Castle, Gamepad2, 
  BrainCircuit, Gem, Loader2, Trophy, Medal, Target, 
  Globe, Shield, Crown, Activity, LogOut
} from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, appId, auth } from '../config/firebase';

interface ProfileScreenProps {
  user: FirebaseUser | null;
}

const avatars = [
  { id: 1, icon: TowerControl },
  { id: 2, icon: Bot },
  { id: 3, icon: Castle },
  { id: 4, icon: Gamepad2 },
  { id: 5, icon: BrainCircuit },
  { id: 6, icon: Gem },
];

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ user }) => {
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ai' | 'online'>('online');

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
    const unsubscribe = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        setProfileData(docSnap.data());
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (loading || !profileData) {
    return (
      <div className="w-full flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-12 h-12 text-tertiary animate-spin" />
      </div>
    );
  }

  // Calculate Stats
  const aiStats = profileData?.aiStats || { xp: 0, wins: 0, losses: 0 };
  const onlineStats = profileData?.onlineStats || { xp: 0, wins: 0, losses: 0 };
  
  const currentStats = activeTab === 'ai' ? aiStats : onlineStats;
  const currentLevel = activeTab === 'ai' 
    ? Math.floor(Math.max(0, aiStats.xp) / 100) + 1 
    : Math.floor(Math.max(0, onlineStats.xp) / 150) + 1;
    
  const calculateWinRate = (wins: number, losses: number) => {
    const total = wins + losses;
    if (total === 0) return 0;
    return Math.round((wins / total) * 100);
  };

  const currentWinRate = calculateWinRate(currentStats.wins, currentStats.losses);

  // Dynamic Achievements Logic
  const achievements = [
    { 
      id: 'first_blood', name: 'First Blood', desc: 'Win your first match.', 
      icon: Target, color: 'text-blue-400', 
      unlocked: aiStats.wins > 0 || onlineStats.wins > 0 
    },
    { 
      id: 'ai_slayer', name: 'AI Conqueror', desc: 'Reach AI Level 5.', 
      icon: Bot, color: 'text-purple-400', 
      unlocked: (Math.floor(Math.max(0, aiStats.xp) / 100) + 1) >= 5 
    },
    { 
      id: 'network_gm', name: 'Network Grandmaster', desc: 'Earn 500 Online XP.', 
      icon: Globe, color: 'text-green-400', 
      unlocked: onlineStats.xp >= 500 
    },
    { 
      id: 'veteran', name: 'Battle Hardened', desc: 'Play 20 total matches.', 
      icon: Shield, color: 'text-orange-400', 
      unlocked: (aiStats.wins + aiStats.losses + onlineStats.wins + onlineStats.losses) >= 20 
    },
    { 
      id: 'flawless', name: 'Tactician', desc: 'Maintain a 70%+ Online Win Rate (min 5 games).', 
      icon: Crown, color: 'text-yellow-400', 
      unlocked: (onlineStats.wins + onlineStats.losses) >= 5 && calculateWinRate(onlineStats.wins, onlineStats.losses) >= 70 
    }
  ];

  const CurrentAvatarIcon = avatars.find(a => a.id === profileData.avatarId)?.icon || User;

  return (
    <div className="w-full flex flex-col gap-8 max-w-4xl mx-auto pt-6 pb-12 animate-in fade-in duration-500">
      
      {/* Header Identity Card */}
      <div className="glass-panel rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl border-t border-white/10 relative overflow-hidden group">
         <div className="absolute top-0 right-0 w-64 h-64 bg-tertiary/5 rounded-full blur-3xl group-hover:bg-tertiary/10 transition-colors" />
         <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left relative z-10">
            <div className="w-24 h-24 rounded-full bg-surface-container-high border-2 border-tertiary/50 flex items-center justify-center shadow-[0_0_20px_rgba(233,195,73,0.15)]">
              <CurrentAvatarIcon className="w-12 h-12 text-tertiary" />
            </div>
            <div>
              <h1 className="font-display-lg text-4xl text-primary mb-1">{profileData.name}</h1>
              <div className="flex items-center justify-center md:justify-start gap-4 text-xs font-mono text-on-surface-variant">
                <span className="flex items-center gap-1 text-tertiary"><Trophy className="w-4 h-4" /> Grandmaster Candidate</span>
              </div>
            </div>
         </div>
         <button onClick={() => auth.signOut()} className="bg-error/15 hover:bg-error/25 text-error border border-error/30 font-title-md text-sm py-2 px-5 rounded-lg flex items-center gap-2 active:scale-95 transition-all z-10">
           <LogOut className="w-4 h-4" /> Sign Out
         </button>
      </div>

      {/* Stats Toggle & Overview */}
      <div className="glass-panel rounded-2xl p-6 md:p-8 border border-white/5">
        
        {/* Toggle Nav */}
        <div className="flex bg-surface-container-high rounded-lg p-1 mb-8 border border-white/5">
           <button 
             onClick={() => setActiveTab('online')}
             className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-md font-title-md transition-all ${activeTab === 'online' ? 'bg-tertiary/10 text-tertiary shadow-sm' : 'text-on-surface-variant hover:text-primary'}`}
           >
             <Globe className="w-5 h-5" /> Ranked Multiplayer
           </button>
           <button 
             onClick={() => setActiveTab('ai')}
             className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-md font-title-md transition-all ${activeTab === 'ai' ? 'bg-purple-500/10 text-purple-400 shadow-sm' : 'text-on-surface-variant hover:text-primary'}`}
           >
             <Bot className="w-5 h-5" /> AI Campaign
           </button>
        </div>

        {/* Dynamic Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6 animate-in slide-in-from-bottom-2 duration-300" key={activeTab}>
          <div className="bg-surface-container-high p-6 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
             <div className="text-on-surface-variant text-xs mb-2 uppercase tracking-widest font-label-caps">Total Experience</div>
             <div className={`text-4xl font-mono ${activeTab === 'online' ? 'text-tertiary' : 'text-purple-400'}`}>{currentStats.xp}</div>
          </div>
          <div className="bg-surface-container-high p-6 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
             <div className="text-on-surface-variant text-xs mb-2 uppercase tracking-widest font-label-caps">Current Level</div>
             <div className="text-4xl font-mono text-primary">Lv. {currentLevel}</div>
          </div>
        </div>

        {/* Win/Loss Bar */}
        <div className="bg-surface-variant/30 p-6 rounded-xl animate-in slide-in-from-bottom-4 duration-300" key={`wl-${activeTab}`}>
           <div className="flex items-center justify-between mb-4">
              <div className="flex gap-8">
                 <div>
                    <div className="text-xs text-on-surface-variant uppercase tracking-widest font-label-caps mb-1">Victories</div>
                    <div className="text-2xl font-bold text-green-400">{currentStats.wins}</div>
                 </div>
                 <div>
                    <div className="text-xs text-on-surface-variant uppercase tracking-widest font-label-caps mb-1">Defeats</div>
                    <div className="text-2xl font-bold text-error">{currentStats.losses}</div>
                 </div>
              </div>
              <div className="text-right">
                 <div className="text-xs text-on-surface-variant uppercase tracking-widest font-label-caps mb-1">Win Rate</div>
                 <div className={`text-2xl font-mono flex items-center gap-2 ${activeTab === 'online' ? 'text-tertiary' : 'text-purple-400'}`}>
                   <Activity className="w-6 h-6" /> {currentWinRate}%
                 </div>
              </div>
           </div>
           
           {/* Visual Ratio Bar */}
           <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden flex">
              <div className="h-full bg-green-500 transition-all duration-1000 ease-out" style={{ width: `${currentStats.wins + currentStats.losses > 0 ? (currentStats.wins / (currentStats.wins + currentStats.losses)) * 100 : 0}%` }} />
              <div className="h-full bg-error transition-all duration-1000 ease-out" style={{ width: `${currentStats.wins + currentStats.losses > 0 ? (currentStats.losses / (currentStats.wins + currentStats.losses)) * 100 : 0}%` }} />
           </div>
        </div>
      </div>

      {/* Achievements Section */}
      <div className="glass-panel rounded-2xl p-6 md:p-8">
         <div className="flex items-center gap-3 mb-6">
            <Medal className="w-6 h-6 text-tertiary" />
            <h3 className="text-2xl font-serif text-primary">Trophy Room</h3>
         </div>
         
         <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
           {achievements.map((ach) => (
              <div key={ach.id} className={`p-4 rounded-xl border flex items-start gap-4 transition-all ${ach.unlocked ? 'bg-surface-container-high border-white/10 hover:border-white/20 hover:-translate-y-1' : 'bg-surface-container/50 border-transparent opacity-50 grayscale'}`}>
                 <div className={`p-3 rounded-lg ${ach.unlocked ? 'bg-surface-variant shadow-inner' : 'bg-surface-container-high'}`}>
                    <ach.icon className={`w-6 h-6 ${ach.unlocked ? ach.color : 'text-on-surface-variant'}`} />
                 </div>
                 <div>
                   <h4 className={`text-sm font-bold ${ach.unlocked ? 'text-primary' : 'text-on-surface-variant'}`}>{ach.name}</h4>
                   <p className="text-[10px] text-on-surface-variant mt-1 leading-tight">{ach.desc}</p>
                 </div>
              </div>
           ))}
         </div>
      </div>

    </div>
  );
};