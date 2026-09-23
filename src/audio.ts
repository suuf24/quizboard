// Web Audio API sound engine - no audio files needed
// Uses oscillators to generate clean, classroom-appropriate sounds

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function initAudio() {
  getAudioContext();
}

function playTone(
  frequency: number,
  duration: number,
  volume: number = 0.3,
  type: OscillatorType = 'sine',
  delay: number = 0
) {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime + delay);

  gain.gain.setValueAtTime(0, ctx.currentTime + delay);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + delay + 0.02);
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    ctx.currentTime + delay + duration
  );

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration);
}

// Short positive sound - quiz start
export function playQuizStart(volume: number = 0.3) {
  playTone(523.25, 0.15, volume * 0.4, 'sine', 0);       // C5
  playTone(659.25, 0.15, volume * 0.4, 'sine', 0.1);      // E5
  playTone(783.99, 0.25, volume * 0.5, 'sine', 0.2);      // G5
}

// Short attention cue - question start
export function playQuestionStart(volume: number = 0.3) {
  playTone(880, 0.08, volume * 0.3, 'sine', 0);            // A5
  playTone(1108.73, 0.12, volume * 0.4, 'sine', 0.08);    // C#6
}

// Subtle tick - 10 seconds warning
export function playWarningTick(volume: number = 0.3) {
  playTone(698.46, 0.06, volume * 0.25, 'triangle', 0);    // F5
}

// Countdown beep - 5 seconds
export function playCountdownBeep(volume: number = 0.3) {
  playTone(880, 0.08, volume * 0.35, 'square', 0);         // A5
}

// Distinct time up sound
export function playTimeUp(volume: number = 0.3) {
  playTone(587.33, 0.15, volume * 0.4, 'sine', 0);        // D5
  playTone(440, 0.15, volume * 0.35, 'sine', 0.15);       // A4
  playTone(349.23, 0.3, volume * 0.4, 'sine', 0.3);       // F4
}

// Transition sound - next question
export function playTransition(volume: number = 0.3) {
  playTone(659.25, 0.1, volume * 0.3, 'sine', 0);         // E5
  playTone(783.99, 0.15, volume * 0.35, 'sine', 0.1);     // G5
}

// Quiz complete - positive finish
export function playComplete(volume: number = 0.3) {
  playTone(523.25, 0.15, volume * 0.4, 'sine', 0);        // C5
  playTone(659.25, 0.15, volume * 0.4, 'sine', 0.15);     // E5
  playTone(783.99, 0.15, volume * 0.4, 'sine', 0.3);      // G5
  playTone(1046.50, 0.35, volume * 0.5, 'sine', 0.45);    // C6
}
