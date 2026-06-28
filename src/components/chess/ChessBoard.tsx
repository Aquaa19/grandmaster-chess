// /home/aquaax19/Workspace/Projects/Chess/grandmaster-chess/src/components/chess/ChessBoard.tsx

import React, { useState } from 'react';
import { Chess } from 'chess.js';
import type { Square, Color, PieceSymbol, Move } from 'chess.js';

// --- Theme Definitions ---
export const BOARD_THEMES = {
  default: { light: 'board-square-light', dark: 'board-square-dark', name: 'Grandmaster (Default)' },
  classic: { light: 'bg-[#f0d9b5]', dark: 'bg-[#b58863]', name: 'Classic Wood' },
  midnight: { light: 'bg-[#b0c4de]', dark: 'bg-[#4682b4]', name: 'Midnight Blue' },
  emerald: { light: 'bg-emerald-200', dark: 'bg-emerald-700', name: 'Emerald Park' },
  coral: { light: 'bg-rose-200', dark: 'bg-rose-800', name: 'Coral Reef' },
};

export const PIECE_THEMES = {
  cburnett: { name: 'Cburnett' },
  merida: { name: 'Merida' },
  pixel: { name: 'Retro Pixel' },
  staunty: { name: 'Staunty' },
};

export type BoardThemeKey = keyof typeof BOARD_THEMES;
export type PieceThemeKey = keyof typeof PIECE_THEMES;

const PieceIcon = ({ type, color, theme }: { type: PieceSymbol; color: Color; theme: PieceThemeKey }) => {
  return (
    <img 
      src={`/pieces/${theme}/${color}${type}.svg`} 
      alt={`${color === 'w' ? 'White' : 'Black'} ${type}`} 
      className="w-[85%] h-[85%] lg:w-[95%] lg:h-[95%] transition-transform duration-200 select-none object-contain"
    />
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
  lastMove?: { from: string; to: string } | null;
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
  pieceTheme = 'cburnett',
  lastMove = null
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

            const isLastMoveSource = lastMove && lastMove.from === squareName;
            const isLastMoveTarget = lastMove && lastMove.to === squareName;

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
                  ${isLastMoveSource || isLastMoveTarget ? 'bg-tertiary/20' : ''}
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