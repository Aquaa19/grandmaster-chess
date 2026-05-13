// /home/aquaax19/Workspace/Projects/Chess/grandmaster-chess/src/components/chess/ChessBoard.tsx

import React, { useState } from 'react';
import { Chess } from 'chess.js';
import type { Square, Color, PieceSymbol, Move } from 'chess.js';

// --- Theme Definitions ---
export const BOARD_THEMES = {
  default: { light: 'board-square-light', dark: 'board-square-dark', name: 'Grandmaster (Default)' },
  classic: { light: 'bg-[#f0d9b5]', dark: 'bg-[#b58863]', name: 'Classic Wood' },
  midnight: { light: 'bg-slate-400', dark: 'bg-slate-800', name: 'Midnight Blue' },
  emerald: { light: 'bg-emerald-200', dark: 'bg-emerald-700', name: 'Emerald Park' },
  coral: { light: 'bg-rose-200', dark: 'bg-rose-800', name: 'Coral Reef' },
};

export const PIECE_THEMES = {
  standard: { w: 'fill-on-surface', b: 'fill-tertiary', name: 'Gold & Ivory' },
  monochrome: { w: 'fill-white drop-shadow-md', b: 'fill-slate-900 drop-shadow-lg', name: 'Monochrome' },
  neon: { 
    w: 'fill-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]', 
    b: 'fill-fuchsia-500 drop-shadow-[0_0_8px_rgba(217,70,239,0.8)]', 
    name: 'Neon Cyber' 
  },
};

export type BoardThemeKey = keyof typeof BOARD_THEMES;
export type PieceThemeKey = keyof typeof PIECE_THEMES;

// --- SVG Piece Components ---
const SVGs: Record<PieceSymbol, string> = {
  p: "M12,2A3,3 0 0,1 15,5A3,3 0 0,1 12,8A3,3 0 0,1 9,5A3,3 0 0,1 12,2M16,18H8V20H16V18M15,10H9A2,2 0 0,0 7,12V16H17V12A2,2 0 0,0 15,10Z",
  r: "M5,20H19V18H5V20M19,9H15V3H9V9H5V15H19V9M17,13H7V11H9V5H15V11H17V13Z",
  n: "M19,19H5V17H19V19M19,15H5V13C5,13 5,9 8,6C9,5 10,5 11,5V3H13V5C15,5 17,6 18,8C19,10 19,12 19,12V15Z",
  b: "M12,2C10,2 9,3 9,5C9,5.57 9.13,6.1 9.35,6.57C8.54,7.34 8,8.42 8,9.61C8,10.23 8.14,10.82 8.39,11.35C7.54,12.05 7,13.11 7,14.29C7,15.11 7.22,15.87 7.59,16.53C6.67,17.2 6,18.27 6,19.5V22H18V19.5C18,18.27 17.33,17.2 16.41,16.53C16.78,15.87 17,15.11 17,14.29C17,13.11 16.46,12.05 15.61,11.35C15.86,10.82 16,10.23 16,9.61C16,8.42 15.46,7.34 14.65,6.57C14.87,6.1 15,5.57 15,5C15,3 14,2 12,2Z",
  q: "M18,3L12,5L6,3V5L8,7L5,13H19L16,7L18,5V3M17.5,15H6.5L5,21H19L17.5,15Z",
  k: "M19,22H5V20H19V22M17,10C15.58,10 14.26,10.77 13.5,12H13V7H15V5H13V3H11V5H9V7H11V12H10.5C9.74,10.77 8.42,10 7,10C4.79,10 3,11.79 3,14C3,16.21 4.79,18 7,18H17C19.21,18 21,16.21 21,14C21,11.79 19.21,10 17,10Z",
};

const PieceIcon = ({ type, color, theme }: { type: PieceSymbol; color: Color; theme: PieceThemeKey }) => {
  const themeClasses = PIECE_THEMES[theme][color];
  return (
    <svg 
      viewBox="0 0 24 24" 
      className={`w-[60%] h-[60%] lg:w-[75%] lg:h-[75%] transition-transform duration-200 ${themeClasses}`}
    >
      <path d={SVGs[type]} />
    </svg>
  );
};

interface ChessBoardProps {
  fen: string;
  onMove: (source: string, target: string) => boolean | Promise<boolean>;
  flipped?: boolean;
  inCheckSquare?: Square | null;
  previewMoveSquare?: Square | null;
  boardTheme?: BoardThemeKey;
  pieceTheme?: PieceThemeKey;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export const ChessBoard: React.FC<ChessBoardProps> = ({ 
  fen, 
  onMove, 
  flipped = false, 
  inCheckSquare = null,
  previewMoveSquare = null,
  boardTheme = 'default',
  pieceTheme = 'standard'
}) => {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  
  const game = new Chess(fen);
  const board = game.board();

  const validMoves: Move[] = selectedSquare ? game.moves({ square: selectedSquare, verbose: true }) as Move[] : [];
  const validTargetSquares = validMoves.map(m => m.to);
  const validCaptures = validMoves.filter(m => m.flags.includes('c') || m.flags.includes('e')).map(m => m.to);

  const handleSquareClick = async (square: Square) => {
    if (selectedSquare && validTargetSquares.includes(square)) {
      const moveResult = onMove(selectedSquare, square);
      const success = moveResult instanceof Promise ? await moveResult : moveResult;
      
      if (success) {
        setSelectedSquare(null);
      }
      return;
    }

    const piece = game.get(square);

    if (piece && piece.color === game.turn()) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
      } else {
        setSelectedSquare(square);
      }
      return;
    }

    setSelectedSquare(null);
  };

  const displayBoard = flipped ? [...board].reverse().map(row => [...row].reverse()) : board;
  const displayFiles = flipped ? [...FILES].reverse() : FILES;
  const displayRanks = flipped ? [...RANKS].reverse() : RANKS;

  const currentBoardTheme = BOARD_THEMES[boardTheme] || BOARD_THEMES.default;

  return (
    <div className="aspect-square w-full max-w-[800px] bg-primary-container p-unit rounded-lg border border-white/10 shadow-2xl relative overflow-hidden">
      <div className="absolute inset-0 border border-white/10 rounded-lg pointer-events-none z-10" />
      
      <div className="w-full h-full grid grid-cols-8 grid-rows-8 gap-0 rounded-DEFAULT overflow-hidden relative">
        {displayBoard.map((row, rowIndex) => 
          row.map((piece, colIndex) => {
            const file = displayFiles[colIndex];
            const rank = displayRanks[rowIndex];
            const squareName = `${file}${rank}` as Square;
            
            const isLightSquare = (rowIndex + colIndex) % 2 === 0;
            const isSelected = selectedSquare === squareName;
            
            const isValidEmptyTarget = validTargetSquares.includes(squareName) && !validCaptures.includes(squareName);
            const isCaptureTarget = validCaptures.includes(squareName);
            
            const isKingInCheck = inCheckSquare === squareName;
            const isPreview = previewMoveSquare === squareName;

            const showRank = colIndex === (flipped ? 7 : 0);
            const showFile = rowIndex === (flipped ? 0 : 7);

            const squareColorClass = isLightSquare ? currentBoardTheme.light : currentBoardTheme.dark;

            return (
              <div 
                key={squareName}
                onClick={() => handleSquareClick(squareName)}
                className={`
                  flex items-center justify-center relative cursor-pointer
                  ${squareColorClass}
                  ${isSelected || isPreview ? 'bg-tertiary/30' : ''}
                  ${isCaptureTarget ? 'bg-error/20 shadow-[inset_0_0_20px_var(--color-error)]' : ''}
                  ${isKingInCheck ? 'bg-error/40 shadow-[inset_0_0_30px_var(--color-error)] animate-pulse' : ''}
                `}
              >
                {(isSelected || isPreview) && (
                  <div className="absolute inset-0 border-2 border-tertiary/70 z-20 pointer-events-none" />
                )}

                {isValidEmptyTarget && (
                  <div className="absolute w-[20%] h-[20%] rounded-full bg-tertiary/40 pointer-events-none z-20" />
                )}

                {isCaptureTarget && (
                  <div className="absolute inset-0 border-2 border-error/70 z-20 pointer-events-none" />
                )}
                
                {isKingInCheck && (
                  <div className="absolute inset-0 border-2 border-error z-20 pointer-events-none animate-pulse" />
                )}

                {showRank && (
                  <span className="absolute top-1 left-1 text-[10px] text-on-surface-variant/50 font-mono-stats select-none z-30">
                    {rank}
                  </span>
                )}

                {showFile && (
                  <span className="absolute bottom-1 right-1 text-[10px] text-on-surface-variant/50 font-mono-stats select-none z-30">
                    {file}
                  </span>
                )}

                {piece && (
                  <div className={`w-full h-full flex items-center justify-center z-10 ${isSelected || isPreview ? 'scale-110' : ''} transition-transform`}>
                    <PieceIcon type={piece.type} color={piece.color} theme={pieceTheme} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};