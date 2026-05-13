// /home/aquaax19/Workspace/Projects/Chess/grandmaster-chess/src/screens/LoginScreen.tsx

import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, Crown, Loader2, Eye, EyeOff } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase';

interface LoginScreenProps {
  onAuth: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // We don't necessarily need to call onAuth() to change screens anymore
      // because our global App listener will detect the login and route us!
    } catch (err: any) {
      setError(err.message || "Failed to sign in.");
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!email || !password) {
      setError("Please enter an email and password to create an account.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err.message || "Failed to create account.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-md relative overflow-hidden fade-slide-up">
      {/* Background with blend mode */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center opacity-30"
        style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCISF_jBVHIQdgGhS1NXrT0WSrjNxHwJ4_5kQm6gND3ZAJ3m7-Bei_Muzuu1cozTVR4J9zkvimqHSzEgaIDqg3pQ9ybWPn1a-M3etRTMTyIHcORhFUG6uWe24ErXW33paOlX0SUH-uxFPf-VZtp4XESQIKoHKpyT0HdA8mYyup6QzHZIsVknPjZWn_kh-m5p192MqA1e5KbXWwYF1dtR3WBPzn_sAXv7NoiQ1M4Sy9ZZlCvfWUzZ66sozcbxadFVjTI3IRm_2XVyBM')" }}
      />
      <div className="absolute inset-0 z-0 bg-background/80" />

      {/* Login Card (Glassmorphism) */}
      <main className="relative z-10 w-full max-w-[448px] glass-panel rounded-xl p-xl shadow-2xl flex flex-col gap-lg">
        
        {/* Header */}
        <div className="flex flex-col items-center gap-sm text-center">
          <Crown className="text-tertiary w-12 h-12" />
          <h1 className="font-display-lg text-display-lg text-primary tracking-tight">Grandmaster</h1>
          <p className="font-body-lg text-on-surface-variant">Enter the arena.</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-sm bg-error/10 border border-error/20 text-error rounded text-body-sm text-center">
            {error}
          </div>
        )}

        {/* Form */}
        <form className="flex flex-col gap-md" onSubmit={handleSignIn}>
          {/* Email Field */}
          <div className="flex flex-col gap-xs">
            <label className="font-label-caps text-on-surface-variant uppercase tracking-widest text-[10px]">
              Email Address
            </label>
            <div className="relative flex items-center">
              <Mail className="absolute left-md text-on-surface-variant w-5 h-5" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="player@grandmaster.com"
                className="w-full bg-surface-container text-on-surface font-body-lg pl-[48px] pr-md py-sm rounded border border-white/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none transition-colors"
                required
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="flex flex-col gap-xs">
            <div className="flex justify-between items-center">
              <label className="font-label-caps text-on-surface-variant uppercase tracking-widest text-[10px]">
                Password
              </label>
            </div>
            <div className="relative flex items-center">
              <Lock className="absolute left-md text-on-surface-variant w-5 h-5" />
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-surface-container text-on-surface font-body-lg pl-[48px] pr-[48px] py-sm rounded border border-white/20 focus:border-tertiary focus:ring-1 focus:ring-tertiary outline-none transition-colors"
                required
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-md text-on-surface-variant hover:text-primary transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Action Button */}
          <button 
            type="submit" 
            disabled={loading}
            className="mt-sm w-full bg-tertiary hover:bg-tertiary-container text-on-tertiary font-title-md py-md px-lg rounded flex items-center justify-center gap-sm transition-all disabled:opacity-50 group active:scale-95 shadow-[0_0_15px_rgba(233,195,73,0.15)]"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>Sign In <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>
            )}
          </button>
        </form>

        {/* Create Account & Alternatives */}
        <div className="text-center mt-sm flex flex-col gap-md">
          <p className="font-body-sm text-on-surface-variant">
            New to the game?{' '}
            <button 
              type="button" 
              onClick={handleCreate} 
              className="text-primary hover:text-tertiary transition-colors font-title-md underline decoration-white/30 underline-offset-4"
            >
              Create Account
            </button>
          </p>
        </div>
        
      </main>
    </div>
  );
};

export default LoginScreen;