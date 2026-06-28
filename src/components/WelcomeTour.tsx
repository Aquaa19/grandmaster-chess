import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, X, Sparkles } from 'lucide-react';

interface WelcomeTourProps {
  onComplete: () => void;
}

interface TourStep {
  targetId: string;
  title: string;
  content: string;
  placement: 'right' | 'left' | 'top' | 'bottom' | 'center';
}

const TOUR_STEPS: TourStep[] = [
  {
    targetId: '', // Center spotlight
    title: 'Welcome to the Arena',
    content: 'Welcome to Grandmaster Chess! Let us take you on a quick 1-minute tour of the key features to get you started.',
    placement: 'center'
  },
  {
    targetId: 'nav-item-home',
    title: 'Matchmaking Lobby',
    content: 'On the Home screen, you can join live Ranked Multiplayer queues, host custom lobbies, and check your standing on the leaderboard.',
    placement: 'right'
  },
  {
    targetId: 'nav-item-puzzles',
    title: 'Tactics Trainer',
    content: 'Sharpen your patterns! Accept daily puzzles and complete tactical scenarios of various ELO levels to gain XP and profile rewards.',
    placement: 'right'
  },
  {
    targetId: 'nav-item-ai',
    title: 'Caissa Engine',
    content: 'Train against our Stockfish-powered Caissa Engine. Test yourself across 5 difficulty levels with real-time evaluation gauges.',
    placement: 'right'
  },
  {
    targetId: 'nav-item-settings',
    title: 'Themes & Skins',
    content: 'Personalize your battlefield! Adjust board colors ( Midnight, Green) and apply premium piece designs (Staunty, Cburnett, Retro).',
    placement: 'right'
  }
];

export const WelcomeTour: React.FC<WelcomeTourProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const step = TOUR_STEPS[currentStep];

  useEffect(() => {
    if (!step.targetId) {
      setCoords(null);
      return;
    }

    const el = document.getElementById(step.targetId);
    let originalPosition = '';
    let originalZIndex = '';
    let originalPointerEvents = '';

    if (el) {
      originalPosition = el.style.position;
      originalZIndex = el.style.zIndex;
      originalPointerEvents = el.style.pointerEvents;

      el.style.position = 'relative';
      el.style.zIndex = '1001';
      el.style.pointerEvents = 'none'; // Prevent navigation clicks during tour
    }

    const updateCoords = () => {
      if (el) {
        const rect = el.getBoundingClientRect();
        setCoords({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height
        });
      }
    };

    // Delay coords calculation slightly to allow layout calculations to settle
    const timer = setTimeout(updateCoords, 200);

    window.addEventListener('resize', updateCoords);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateCoords);
      if (el) {
        el.style.position = originalPosition;
        el.style.zIndex = originalZIndex;
        el.style.pointerEvents = originalPointerEvents;
      }
    };
  }, [currentStep, step.targetId]);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const getTooltipStyle = () => {
    if (!coords) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        position: 'fixed' as const
      };
    }

    const margin = 16;
    if (window.innerWidth < 768) {
      return {
        bottom: '100px',
        left: '50%',
        transform: 'translateX(-50%)',
        position: 'fixed' as const,
        width: 'calc(100% - 32px)',
        maxWidth: '400px'
      };
    }

    return {
      top: `${coords.top + coords.height / 2}px`,
      left: `${coords.left + coords.width + margin}px`,
      transform: 'translateY(-50%)',
      position: 'absolute' as const,
      width: '320px'
    };
  };

  return (
    <div className="fixed inset-0 z-[1000] overflow-hidden pointer-events-auto">
      {/* Semi-transparent Backdrop with Spotlight Effect */}
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm transition-all duration-300" />

      {/* Spotlight Highlight Box */}
      {coords && (
        <div
          className="absolute rounded-lg border-2 border-tertiary shadow-[0_0_50px_rgba(233,195,73,0.3)] transition-all duration-300 pointer-events-none"
          style={{
            top: `${coords.top - 4}px`,
            left: `${coords.left - 4}px`,
            width: `${coords.width + 8}px`,
            height: `${coords.height + 8}px`,
          }}
        />
      )}

      {/* Tooltip Card */}
      <div
        className="glass-panel p-6 rounded-2xl border-t border-white/20 shadow-2xl animate-in zoom-in-95 duration-200 pointer-events-auto w-[90%] max-w-[400px] flex flex-col gap-4"
        style={getTooltipStyle()}
      >
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-tertiary animate-pulse" />
            <h4 className="font-display-lg text-lg text-primary">{step.title}</h4>
          </div>
          <button
            onClick={onComplete}
            className="text-on-surface-variant hover:text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-on-surface-variant leading-relaxed">
          {step.content}
        </p>

        <div className="flex justify-between items-center mt-2">
          <span className="text-[10px] font-mono-stats text-on-surface-variant/60 uppercase tracking-widest">
            Step {currentStep + 1} of {TOUR_STEPS.length}
          </span>

          <div className="flex gap-2">
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                className="bg-surface-variant hover:bg-surface-container-high text-primary px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all active:scale-95 border border-white/5 text-xs font-title-md"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="bg-tertiary hover:bg-yellow-400 text-on-tertiary px-4 py-1.5 rounded-lg flex items-center gap-1 transition-all active:scale-95 text-xs font-title-md shadow-md shadow-tertiary/20"
            >
              {currentStep === TOUR_STEPS.length - 1 ? 'Get Started' : 'Next'} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
