/**
 * Procedural PSP UI Sound Effects synthesized via Web Audio API.
 * Authentic retro tones without external asset loading.
 */

let ctx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      ctx = new AudioCtx();
    }
  }
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

/** Subtle high-frequency mechanical tick when moving cursor */
export function playCursorTick(enabled = true) {
  if (!enabled) return;
  const audio = getAudioContext();
  if (!audio) return;

  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1400, now);
  osc.frequency.exponentialRampToValueAtTime(700, now + 0.025);

  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

  osc.connect(gain);
  gain.connect(audio.destination);

  osc.start(now);
  osc.stop(now + 0.025);
}

/** Authentic PSP high-pitch confirm chime (○ button) */
export function playConfirmChime(enabled = true) {
  if (!enabled) return;
  const audio = getAudioContext();
  if (!audio) return;

  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const osc2 = audio.createOscillator();
  const gain = audio.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, now); // A5
  osc.frequency.exponentialRampToValueAtTime(1320, now + 0.07); // E6

  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(1320, now);
  osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.07);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  osc.connect(gain);
  osc2.connect(gain);
  gain.connect(audio.destination);

  osc.start(now);
  osc2.start(now);
  osc.stop(now + 0.12);
  osc2.stop(now + 0.12);
}

/** Authentic PSP descending cancel tone (✕ button) */
export function playCancelChime(enabled = true) {
  if (!enabled) return;
  const audio = getAudioContext();
  if (!audio) return;

  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(660, now);
  osc.frequency.exponentialRampToValueAtTime(330, now + 0.09);

  gain.gain.setValueAtTime(0.1, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

  osc.connect(gain);
  gain.connect(audio.destination);

  osc.start(now);
  osc.stop(now + 0.09);
}

/** Page turn sound */
export function playPageTurn(enabled = true) {
  if (!enabled) return;
  const audio = getAudioContext();
  if (!audio) return;

  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(450, now);
  osc.frequency.exponentialRampToValueAtTime(220, now + 0.05);

  gain.gain.setValueAtTime(0.07, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  osc.connect(gain);
  gain.connect(audio.destination);

  osc.start(now);
  osc.stop(now + 0.05);
}
