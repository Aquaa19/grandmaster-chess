const playSoundFile = (filename: string) => {
  try {
    const audio = new Audio(`/sounds/${filename}`);
    audio.volume = 0.6;
    audio.play().catch(e => {
      console.warn(`Audio playback blocked or failed for ${filename}`, e);
    });
  } catch (e) {
    console.error(`Failed to play audio file ${filename}`, e);
  }
};

export const playMoveSound = () => {
  playSoundFile('move.mp3');
};

export const playCaptureSound = () => {
  playSoundFile('capture.mp3');
};

export const playCheckSound = () => {
  playSoundFile('check.mp3');
};

export const playVictorySound = () => {
  playSoundFile('victory.mp3');
};

export const playDefeatSound = () => {
  playSoundFile('defeat.mp3');
};
