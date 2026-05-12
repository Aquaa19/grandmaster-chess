import React from 'react';

interface EvaluationBarProps {
  /** Evaluation in centipawns (positive for white, negative for black) */
  evaluation: number;
  /** Number of moves to mate (if applicable) */
  mate: number | null;
  /** Whether the board is flipped (black at bottom) */
  flipped?: boolean;
}

export const EvaluationBar: React.FC<EvaluationBarProps> = ({ evaluation, mate, flipped = false }) => {
  // Sigmoid function to map centipawn evaluation to a 0-100 percentage
  // This prevents the bar from being too sensitive at high advantages
  const getPercentage = () => {
    if (mate !== null) {
      return mate > 0 ? 100 : 0;
    }
    
    // Standard formula: percentage = 50 + (50 * (2 / (1 + exp(-0.0036 * cp)) - 1))
    // Simplification for UI: clamp eval between -1000 and 1000 (10 points)
    const val = Math.max(-1000, Math.min(1000, evaluation));
    return 50 - (val / 20); // Result is percentage of BLACK (top)
  };

  const blackPercentage = getPercentage();
  const displayScore = mate !== null 
    ? `M${Math.abs(mate)}` 
    : (evaluation / 100).toFixed(1);

  // If flipped, we invert the visual representation
  const topPercentage = flipped ? 100 - blackPercentage : blackPercentage;

  return (
    <div className="relative w-8 h-full min-h-[400px] bg-white rounded-md overflow-hidden border border-white/10 shadow-xl flex flex-col">
      {/* Black Evaluation (Top part) */}
      <div 
        className="bg-slate-900 w-full transition-all duration-700 ease-out flex items-start justify-center pt-2"
        style={{ height: `${topPercentage}%` }}
      >
        {!flipped && evaluation < -150 && (
          <span className="text-[10px] font-mono-stats text-white font-bold">{displayScore}</span>
        )}
        {flipped && evaluation > 150 && (
          <span className="text-[10px] font-mono-stats text-white font-bold">+{displayScore}</span>
        )}
      </div>

      {/* White Evaluation (Bottom part) */}
      <div className="flex-1 bg-white flex items-end justify-center pb-2">
        {!flipped && evaluation > 150 && (
          <span className="text-[10px] font-mono-stats text-slate-900 font-bold">+{displayScore}</span>
        )}
        {flipped && evaluation < -150 && (
          <span className="text-[10px] font-mono-stats text-slate-900 font-bold">{displayScore}</span>
        )}
      </div>

      {/* Center Line */}
      <div className="absolute top-1/2 left-0 w-full h-px bg-tertiary/30 z-10" />
    </div>
  );
};