import React, { useState, useEffect } from 'react';
import { Palette, LayoutTemplate, Save, Loader2, CheckCircle2, Paintbrush, Settings } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, appId } from '../config/firebase';
import { ChessBoard, BOARD_THEMES, PIECE_THEMES } from '../components/chess/ChessBoard';
import type { BoardThemeKey, PieceThemeKey } from '../components/chess/ChessBoard';

interface SettingsScreenProps {
  user: FirebaseUser | null;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [boardTheme, setBoardTheme] = useState<BoardThemeKey>('default');
  const [pieceTheme, setPieceTheme] = useState<PieceThemeKey>('cburnett');

  // Load existing preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
        const snap = await getDoc(profileRef);
        
        if (snap.exists()) {
          const data = snap.data();
          if (data.settings) {
            if (data.settings.boardTheme) setBoardTheme(data.settings.boardTheme as BoardThemeKey);
            if (data.settings.pieceTheme) setPieceTheme(data.settings.pieceTheme as PieceThemeKey);
          }
        }
      } catch (e) {
        console.error("Failed to load settings:", e);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSaveSuccess(false);
    
    try {
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
      await setDoc(profileRef, {
        settings: {
          boardTheme,
          pieceTheme
        }
      }, { merge: true }); // Merge ensures we don't overwrite stats/history!
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error("Failed to save settings:", e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center min-h-[60vh] gap-4 fade-slide-up">
        <Loader2 className="w-12 h-12 text-tertiary animate-spin" />
        <p className="font-label-caps text-on-surface-variant tracking-widest text-[10px] uppercase animate-pulse">
          Loading Preferences...
        </p>
      </div>
    );
  }

  // Standard starting position for the preview board
  const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  return (
    <div className="w-full max-w-container-max mx-auto fade-slide-up pt-6 pb-12 px-4 md:px-8">
      
      <div className="mb-8">
        <h2 className="text-3xl font-display-lg text-primary flex items-center gap-3">
          <Settings className="w-8 h-8 text-tertiary" /> 
          Preferences
        </h2>
        <p className="text-on-surface-variant font-body-md mt-2">
          Customize your board colors and piece sets. Changes apply to all game modes.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-8">
        
        {/* Left Side: Controls */}
        <div className="flex flex-col gap-6">
          
          {/* Board Theme Selection */}
          <section className="glass-panel p-6 rounded-2xl border-t border-white/10 shadow-lg">
            <h3 className="text-primary font-title-md text-xl flex items-center gap-2 mb-6">
              <LayoutTemplate className="w-5 h-5 text-tertiary" /> Board Theme
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {(Object.entries(BOARD_THEMES) as [BoardThemeKey, typeof BOARD_THEMES[BoardThemeKey]][]).map(([key, theme]) => (
                <button
                  key={key}
                  onClick={() => setBoardTheme(key)}
                  className={`relative p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 active:scale-95 ${
                    boardTheme === key 
                      ? 'border-tertiary bg-tertiary/10 shadow-[0_0_15px_rgba(233,195,73,0.2)]' 
                      : 'border-white/5 bg-surface-container hover:bg-surface-variant hover:border-white/20'
                  }`}
                >
                  {/* Miniature swatch preview */}
                  <div className="w-16 h-16 rounded-md overflow-hidden flex flex-wrap border border-white/20 shadow-inner">
                    <div className={`w-8 h-8 ${theme.light}`} />
                    <div className={`w-8 h-8 ${theme.dark}`} />
                    <div className={`w-8 h-8 ${theme.dark}`} />
                    <div className={`w-8 h-8 ${theme.light}`} />
                  </div>
                  <span className={`font-title-md text-sm ${boardTheme === key ? 'text-tertiary' : 'text-on-surface-variant'}`}>
                    {theme.name}
                  </span>
                  {boardTheme === key && (
                    <div className="absolute top-2 right-2 text-tertiary">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Piece Theme Selection */}
          <section className="glass-panel p-6 rounded-2xl border-t border-white/10 shadow-lg">
            <h3 className="text-primary font-title-md text-xl flex items-center gap-2 mb-6">
              <Palette className="w-5 h-5 text-tertiary" /> Piece Set
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {(Object.entries(PIECE_THEMES) as [PieceThemeKey, typeof PIECE_THEMES[PieceThemeKey]][]).map(([key, theme]) => (
                <button
                  key={key}
                  onClick={() => setPieceTheme(key)}
                  className={`relative p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 active:scale-95 ${
                    pieceTheme === key 
                      ? 'border-tertiary bg-tertiary/10 shadow-[0_0_15px_rgba(233,195,73,0.2)]' 
                      : 'border-white/5 bg-surface-container hover:bg-surface-variant hover:border-white/20'
                  }`}
                >
                  <div className="w-16 h-16 flex items-center justify-center bg-surface-container-high rounded-md border border-white/10 shadow-inner">
                    {/* SVG preview of a Knight */}
                    <img src={`/pieces/${key}/wn.svg`} alt="White Knight Preview" className="w-12 h-12 select-none object-contain" />
                  </div>
                  <span className={`font-title-md text-sm ${pieceTheme === key ? 'text-tertiary' : 'text-on-surface-variant'}`}>
                    {theme.name}
                  </span>
                  {pieceTheme === key && (
                    <div className="absolute top-2 right-2 text-tertiary">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>

        </div>

        {/* Right Side: Live Preview & Save */}
        <div className="flex flex-col gap-6">
          <div className="glass-panel p-6 rounded-2xl border-t border-white/10 shadow-lg sticky top-24">
            <h3 className="text-primary font-title-md text-lg flex items-center gap-2 mb-4">
              <Paintbrush className="w-5 h-5 text-tertiary" /> Live Preview
            </h3>
            
            <div className="mb-6 rounded-lg overflow-hidden ring-4 ring-surface-container-high">
              <ChessBoard 
                fen={STARTING_FEN} 
                onMove={() => false} // No moves allowed in preview
                boardTheme={boardTheme}
                pieceTheme={pieceTheme}
              />
            </div>

            <button 
              onClick={handleSave}
              disabled={saving}
              className={`w-full py-4 rounded-lg font-title-md flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg ${
                saveSuccess 
                  ? 'bg-green-500 text-slate-900 shadow-green-500/20' 
                  : 'bg-tertiary hover:bg-yellow-400 text-slate-900 shadow-tertiary/20'
              } disabled:opacity-70 disabled:cursor-not-allowed`}
            >
              {saving ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>
              ) : saveSuccess ? (
                <><CheckCircle2 className="w-5 h-5" /> Saved Successfully!</>
              ) : (
                <><Save className="w-5 h-5" /> Save Preferences</>
              )}
            </button>
            <p className="text-center text-on-surface-variant/50 text-xs mt-3">
              Preferences are synced to your cloud profile.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};