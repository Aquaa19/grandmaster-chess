/**
 * Calculates the expected score for a player.
 * @param rating The player's current rating.
 * @param opponentRating The opponent's current rating.
 * @returns A probability between 0 and 1.
 */
export const getExpectedScore = (rating: number, opponentRating: number): number => {
  return 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
};

/**
 * Calculates the new Elo rating for a player after a match.
 * @param rating The player's current rating.
 * @param opponentRating The opponent's current rating.
 * @param actualScore The match outcome: 1 for a win, 0.5 for a draw, 0 for a loss.
 * @param kFactor The maximum possible adjustment per game (standard is 32).
 * @returns The newly calculated integer rating.
 */
export const calculateNewElo = (
  rating: number, 
  opponentRating: number, 
  actualScore: 1 | 0.5 | 0, 
  kFactor: number = 32
): number => {
  const expectedScore = getExpectedScore(rating, opponentRating);
  const newRating = rating + kFactor * (actualScore - expectedScore);
  
  // Return rounded integer, ensuring rating never drops below a minimum floor (e.g., 100)
  return Math.max(100, Math.round(newRating));
};