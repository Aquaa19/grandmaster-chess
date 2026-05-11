# Grandmaster Chess

A modern, responsive chess application built with React, TypeScript, and Vite. It features local multiplayer, AI opponents, game history, and match replays.

## Features

- **Single Player vs AI**: Play against an AI opponent with dynamic timers.
- **Local Multiplayer**: Play against a friend on the same device.
- **Match History**: Keep track of your past games and results.
- **Match Replays**: Review your past matches move by move.
- **Player Profiles**: Customize your player name and profile.
- **Modern UI**: Built with Tailwind CSS, Lucide icons, and a beautiful, sleek interface.
- **Firebase Integration**: Stores user profiles and match histories seamlessly in the cloud.

## Technology Stack

- **Framework:** React 19 & Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Game Logic:** `chess.js`
- **Backend/Auth/Database:** Firebase v12
- **Icons:** Lucide React

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm, yarn, or pnpm

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd grandmaster-chess
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to the local URL provided by Vite (usually `http://localhost:5173`).

### Building for Production

To create a production build:
```bash
npm run build
```

This will compile your TypeScript files and build the production-ready application in the `dist` folder.

### Linting

To run the ESLint checker:
```bash
npm run lint
```

## Project Structure

- `src/components/`: Reusable UI components (buttons, boards, layout, etc.)
- `src/screens/`: The main views of the application (Home, SinglePlayer, LocalMultiplayer, History, etc.)
- `src/hooks/`: Custom React hooks, including the core `useChessGame` hook.
- `src/config/`: Configuration files (Firebase, etc.)

## License

This project is private and intended for demonstration purposes.
