// /home/aquaax19/Workspace/Projects/Chess/grandmaster-chess/src/components/chess/ChessBoard.tsx

import React, { useState } from 'react';
import { Chess } from 'chess.js';
import type { Square, Color, PieceSymbol, Move } from 'chess.js';

// --- SVG Piece Components based on your HTML design ---
const SVGs: Record<PieceSymbol, string> = {
  p: "M12,2A3,3 0 0,1 15,5A3,3 0 0,1 12,8A3,3 0 0,1 9,5A3,3 0 0,1 12,2M16,18H8V20H16V18M15,10H9A2,2 0 0,0 7,12V16H17V12A2,2 0 0,0 15,10Z",
  r: "M5,20H19V18H5V20M19,9H15V3H9V9H5V15H19V9M17,13H7V11H9V5H15V11H17V13Z",
  n: "M19,19H5V17H19V19M19,15H5V13C5,13 5,9 8,6C9,5 10,5 11,5V3H13V5C15,5 17,6 18,8C19,10 19,12 19,12V15Z",
  b: "M12,2C10,2 9,3 9,5C9,5.57 9.13,6.1 9.35,6.57C8.54,7.34 8,8.42 8,9.61C8,10.23 8.14,10.82 8.39,11.35C7.54,12.05 7,13.11 7,14.29C7,15.11 7.22,15.87 7.59,16.53C6.67,17.2 6,18.27 6,19.5V22H18V19.5C18,18.27 17.33,17.2 16.41,16.53C16.78,15.87 17,15.11 17,14.29C17,13.11 16.46,12.05 15.61,11.35C15.86,10.82 16,10.23 16,9.61C16,8.42 15.46,7.34 14.65,6.57C14.87,6.1 15,5.57 15,5C15,3 14,2 12,2Z",
  q: "M18,3L12,5L6,3V5L8,7L5,13H19L16,7L18,5V3M17.5,15H6.5L5,21H19L17.5,15Z",
  k: "M19,22H5V20H19V22M17,10C15.58,10 14.26,10.77 13.5,12H13V7H15V5H13V3H11V5H9V7H11V12H10.5C9.74,10.77 8.42,10 7,10C4.79,10 3,11.79 3,14C3,16.21 4.79,18 7,18H17C19.21,18 21,16.21 21,14C21,11.79 19.21,10 17,10Z",
};

const PieceIcon = ({ type, color }: { type: PieceSymbol; color: Color }) => (
  <svg 
    viewBox="0 0 24 24" 
    className={`w-[60%] h-[60%] lg:w-[75%] lg:h-[75%] transition-transform duration-200 ${
      color === 'w' ? 'fill-on-surface' : 'fill-tertiary'
    }`}
  >
    <path d={SVGs[type]} />
  </svg>
);

interface ChessBoardProps {
  fen: string;
  onMove: (source: string, target: string) => boolean;
  flipped?: boolean;
  inCheckSquare?: Square | null;
  previewMoveSquare?: Square | null;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export const ChessBoard: React.FC<ChessBoardProps> = ({ 
  fen, 
  onMove, 
  flipped = false, 
  inCheckSquare = null,
  previewMoveSquare = null
}) => {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  
  // Initialize local instance to parse the board state and calculate valid moves
  const game = new Chess(fen);
  const board = game.board();

  // Get valid moves for the currently selected piece
  const validMoves: Move[] = selectedSquare ? game.moves({ square: selectedSquare, verbose: true }) as Move[] : [];
  const validTargetSquares = validMoves.map(m => m.to);
  // Captures include 'c' (standard capture) or 'e' (en passant)
  const validCaptures = validMoves.filter(m => m.flags.includes('c') || m.flags.includes('e')).map(m => m.to);

  const handleSquareClick = (square: Square) => {
    // If a square is selected and the clicked square is a valid target, execute move
    if (selectedSquare && validTargetSquares.includes(square)) {
      const success = onMove(selectedSquare, square);
      if (success) {
        setSelectedSquare(null);
      }
      return;
    }

    const piece = game.get(square);

    // If clicking a piece of the current turn's color, select it
    if (piece && piece.color === game.turn()) {
      // If clicking the same selected piece, deselect it
      if (selectedSquare === square) {
        setSelectedSquare(null);
      } else {
        setSelectedSquare(square);
      }
      return;
    }

    // If clicking an empty square or opponent piece that isn't a valid move, deselect
    setSelectedSquare(null);
  };

  // Determine row and col based on flip state
  const displayBoard = flipped ? [...board].reverse().map(row => [...row].reverse()) : board;
  const displayFiles = flipped ? [...FILES].reverse() : FILES;
  const displayRanks = flipped ? [...RANKS].reverse() : RANKS;

  return (
    <div className="aspect-square w-full max-w-[800px] bg-primary-container p-unit rounded-lg border border-white/10 shadow-2xl relative overflow-hidden">
      {/* Inner glow/stroke */}
      <div className="absolute inset-0 border border-white/10 rounded-lg pointer-events-none z-10" />
      
      {/* 8x8 Grid */}
      <div className="w-full h-full grid grid-cols-8 grid-rows-8 gap-0 rounded-DEFAULT overflow-hidden relative">
        {displayBoard.map((row, rowIndex) => 
          row.map((piece, colIndex) => {
            const file = displayFiles[colIndex];
            const rank = displayRanks[rowIndex];
            const squareName = `${file}${rank}` as Square;
            
            const isLightSquare = (rowIndex + colIndex) % 2 === 0;
            const isSelected = selectedSquare === squareName;
            
            // Check if this square is a valid target or capture
            const isValidEmptyTarget = validTargetSquares.includes(squareName) && !validCaptures.includes(squareName);
            const isCaptureTarget = validCaptures.includes(squareName);
            
            // Checks and highlights
            const isKingInCheck = inCheckSquare === squareName;
            const isPreview = previewMoveSquare === squareName;

            // Coordinate labels
            const showRank = colIndex === (flipped ? 7 : 0);
            const showFile = rowIndex === (flipped ? 0 : 7);

            return (
              <div 
                key={squareName}
                onClick={() => handleSquareClick(squareName)}
                className={`
                  flex items-center justify-center relative cursor-pointer
                  ${isLightSquare ? 'board-square-light' : 'board-square-dark'}
                  ${isSelected || isPreview ? 'bg-tertiary/30' : ''}
                  ${isCaptureTarget ? 'bg-error/20 shadow-[inset_0_0_20px_var(--color-error)]' : ''}
                  ${isKingInCheck ? 'bg-error/40 shadow-[inset_0_0_30px_var(--color-error)] animate-pulse' : ''}
                `}
              >
                {/* Highlight ring for selected piece or previewed move */}
                {(isSelected || isPreview) && (
                  <div className="absolute inset-0 border-2 border-tertiary/70 z-20 pointer-events-none" />
                )}

                {/* Dot indicator for valid empty moves */}
                {isValidEmptyTarget && (
                  <div className="absolute w-[20%] h-[20%] rounded-full bg-tertiary/40 pointer-events-none z-20" />
                )}

                {/* Ring indicator for valid capture moves */}
                {isCaptureTarget && (
                  <div className="absolute inset-0 border-2 border-error/70 z-20 pointer-events-none" />
                )}
                
                {/* Extra warning border if in check */}
                {isKingInCheck && (
                  <div className="absolute inset-0 border-2 border-error z-20 pointer-events-none animate-pulse" />
                )}

                {/* Rank Number (Left) */}
                {showRank && (
                  <span className="absolute top-1 left-1 text-[10px] text-on-surface-variant/50 font-mono-stats select-none z-30">
                    {rank}
                  </span>
                )}

                {/* File Letter (Bottom) */}
                {showFile && (
                  <span className="absolute bottom-1 right-1 text-[10px] text-on-surface-variant/50 font-mono-stats select-none z-30">
                    {file}
                  </span>
                )}

                {/* The Piece */}
                {piece && (
                  <div className={`w-full h-full flex items-center justify-center z-10 ${isSelected || isPreview ? 'scale-110' : ''} transition-transform`}>
                    <PieceIcon type={piece.type} color={piece.color} />
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