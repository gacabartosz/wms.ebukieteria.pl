// Sound themes for scanner feedback

export type SoundTheme = 'classic' | 'material' | 'ios' | 'retro' | 'minimal' | 'none';
export type SoundType = 'success' | 'error' | 'warning' | 'location';

interface SoundConfig {
  frequency: number;
  frequency2?: number;
  type: OscillatorType;
  duration: number;
  gain: number;
  ramp?: number;
}

interface ThemeConfig {
  name: string;
  description: string;
  sounds: Record<SoundType, SoundConfig | SoundConfig[]>;
}

// Sound theme configurations
export const soundThemes: Record<SoundTheme, ThemeConfig> = {
  classic: {
    name: 'Klasyczny',
    description: 'Proste sygnały dźwiękowe',
    sounds: {
      success: { frequency: 1200, type: 'sine', duration: 0.1, gain: 0.3 },
      error: { frequency: 300, frequency2: 200, type: 'square', duration: 0.3, gain: 0.2 },
      warning: { frequency: 800, type: 'triangle', duration: 0.15, gain: 0.25 },
      location: [
        { frequency: 1000, type: 'sine', duration: 0.08, gain: 0.3 },
        { frequency: 1400, type: 'sine', duration: 0.08, gain: 0.3 },
      ],
    },
  },

  material: {
    name: 'Material',
    description: 'Nowoczesne dźwięki w stylu Google',
    sounds: {
      success: { frequency: 880, frequency2: 1320, type: 'sine', duration: 0.15, gain: 0.25, ramp: 0.1 },
      error: { frequency: 220, frequency2: 165, type: 'triangle', duration: 0.4, gain: 0.2 },
      warning: { frequency: 587, type: 'sine', duration: 0.2, gain: 0.2 },
      location: [
        { frequency: 523, type: 'sine', duration: 0.1, gain: 0.25 },
        { frequency: 784, type: 'sine', duration: 0.15, gain: 0.25 },
      ],
    },
  },

  ios: {
    name: 'iOS',
    description: 'Czyste tony w stylu Apple',
    sounds: {
      success: { frequency: 1567, type: 'sine', duration: 0.08, gain: 0.2 },
      error: { frequency: 262, frequency2: 196, type: 'sine', duration: 0.35, gain: 0.25 },
      warning: { frequency: 1047, type: 'sine', duration: 0.12, gain: 0.2 },
      location: [
        { frequency: 1319, type: 'sine', duration: 0.06, gain: 0.2 },
        { frequency: 1568, type: 'sine', duration: 0.1, gain: 0.2 },
      ],
    },
  },

  retro: {
    name: 'Retro',
    description: 'Dźwięki 8-bit w stylu Atari',
    sounds: {
      success: { frequency: 660, frequency2: 880, type: 'square', duration: 0.12, gain: 0.15 },
      error: { frequency: 150, frequency2: 100, type: 'square', duration: 0.4, gain: 0.15 },
      warning: { frequency: 440, type: 'square', duration: 0.15, gain: 0.12 },
      location: [
        { frequency: 523, type: 'square', duration: 0.08, gain: 0.12 },
        { frequency: 698, type: 'square', duration: 0.08, gain: 0.12 },
        { frequency: 880, type: 'square', duration: 0.1, gain: 0.12 },
      ],
    },
  },

  minimal: {
    name: 'Minimalny',
    description: 'Delikatne, subtelne dźwięki',
    sounds: {
      success: { frequency: 1400, type: 'sine', duration: 0.05, gain: 0.15 },
      error: { frequency: 400, type: 'sine', duration: 0.2, gain: 0.15 },
      warning: { frequency: 900, type: 'sine', duration: 0.08, gain: 0.12 },
      location: [
        { frequency: 1200, type: 'sine', duration: 0.04, gain: 0.12 },
        { frequency: 1500, type: 'sine', duration: 0.06, gain: 0.12 },
      ],
    },
  },

  none: {
    name: 'Wyłączone',
    description: 'Brak dźwięków (tylko wibracje)',
    sounds: {
      success: { frequency: 0, type: 'sine', duration: 0, gain: 0 },
      error: { frequency: 0, type: 'sine', duration: 0, gain: 0 },
      warning: { frequency: 0, type: 'sine', duration: 0, gain: 0 },
      location: { frequency: 0, type: 'sine', duration: 0, gain: 0 },
    },
  },
};

// Get current theme from localStorage
const SOUND_THEME_KEY = 'wms-sound-theme';
const SOUND_VOLUME_KEY = 'wms-sound-volume';

export const getSoundTheme = (): SoundTheme => {
  const saved = localStorage.getItem(SOUND_THEME_KEY);
  return (saved as SoundTheme) || 'classic';
};

export const setSoundTheme = (theme: SoundTheme): void => {
  localStorage.setItem(SOUND_THEME_KEY, theme);
};

export const getSoundVolume = (): number => {
  const saved = localStorage.getItem(SOUND_VOLUME_KEY);
  return saved ? parseFloat(saved) : 1.0;
};

export const setSoundVolume = (volume: number): void => {
  localStorage.setItem(SOUND_VOLUME_KEY, String(Math.max(0, Math.min(1, volume))));
};

// Audio context for scan sounds
let audioContext: AudioContext | null = null;

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  // Resume if suspended (browser policy)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
};

// Play a single sound config
const playSoundConfig = (ctx: AudioContext, config: SoundConfig, startTime: number, volumeMultiplier: number) => {
  if (config.frequency === 0) return;

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.frequency.value = config.frequency;
  oscillator.type = config.type;
  gainNode.gain.value = config.gain * volumeMultiplier;

  oscillator.start(startTime);

  // Frequency ramp for second frequency
  if (config.frequency2) {
    const rampTime = config.ramp || config.duration * 0.3;
    oscillator.frequency.setValueAtTime(config.frequency, startTime);
    oscillator.frequency.linearRampToValueAtTime(config.frequency2, startTime + rampTime);
  }

  oscillator.stop(startTime + config.duration);

  // Fade out
  gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + config.duration);
};

// Main play function
const playSound = (type: SoundType) => {
  const theme = getSoundTheme();
  if (theme === 'none') {
    // Only vibrate
    if ('vibrate' in navigator) {
      const patterns: Record<SoundType, number | number[]> = {
        success: 50,
        error: [100, 50, 100],
        warning: [50, 30, 50],
        location: [30, 20, 30],
      };
      navigator.vibrate(patterns[type]);
    }
    return;
  }

  try {
    const ctx = getAudioContext();
    const config = soundThemes[theme].sounds[type];
    const volume = getSoundVolume();

    if (Array.isArray(config)) {
      // Multiple sounds (e.g., location beeps)
      let time = ctx.currentTime;
      config.forEach((soundConfig) => {
        playSoundConfig(ctx, soundConfig, time, volume);
        time += soundConfig.duration + 0.04; // Small gap between sounds
      });
    } else {
      playSoundConfig(ctx, config, ctx.currentTime, volume);
    }

    // Also vibrate on mobile
    if ('vibrate' in navigator) {
      const vibrationDurations: Record<SoundType, number | number[]> = {
        success: 30,
        error: [50, 30, 50],
        warning: 40,
        location: [20, 15, 20],
      };
      navigator.vibrate(vibrationDurations[type]);
    }
  } catch (e) {
    // Fallback: vibrate on mobile if available
    if ('vibrate' in navigator) {
      navigator.vibrate(type === 'error' ? [100, 50, 100] : 50);
    }
  }
};

// Exported functions
export const playBeep = (type: 'success' | 'error' | 'warning' = 'success') => {
  playSound(type);
};

export const playLocationBeep = () => {
  playSound('location');
};

// Preview a specific theme's sound
export const previewThemeSound = (theme: SoundTheme, type: SoundType = 'success') => {
  if (theme === 'none') {
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
    return;
  }

  try {
    const ctx = getAudioContext();
    const config = soundThemes[theme].sounds[type];
    const volume = getSoundVolume();

    if (Array.isArray(config)) {
      let time = ctx.currentTime;
      config.forEach((soundConfig) => {
        playSoundConfig(ctx, soundConfig, time, volume);
        time += soundConfig.duration + 0.04;
      });
    } else {
      playSoundConfig(ctx, config, ctx.currentTime, volume);
    }
  } catch (e) {
    console.error('Error playing preview sound:', e);
  }
};
