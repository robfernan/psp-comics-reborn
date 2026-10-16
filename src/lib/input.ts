import { useEffect, useRef } from 'react';

/**
 * Unified PSP-style input. Keyboard and gamepad are both mapped onto the PSP's
 * buttons; only the top-most active handler (e.g. an open dialog) receives them.
 */
export type Action =
  | 'up' | 'down' | 'left' | 'right'
  | 'confirm'   // ○ Circle  — Enter / Space
  | 'back'      // ✕ Cross   — Esc / Backspace
  | 'triangle'  // △         — I
  | 'square'    // □         — B
  | 'l' | 'r'   // L / R     — Q / E, PageUp / PageDown
  | 'start'     // START     — O
  | 'select';   // SELECT    — V

type Handler = (action: Action, repeat: boolean) => boolean | void;

const stack: { id: number; ref: { current: Handler } }[] = [];
let nextId = 1;

function dispatch(action: Action, repeat = false) {
  for (let i = stack.length - 1; i >= 0; i--) {
    // A handler returning `false` lets the action fall through to the one below.
    if (stack[i].ref.current(action, repeat) !== false) return;
  }
}

const KEYMAP: Record<string, Action> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
  Enter: 'confirm', ' ': 'confirm',
  Escape: 'back', Backspace: 'back',
  i: 'triangle', b: 'square',
  q: 'l', e: 'r', PageUp: 'l', PageDown: 'r',
  o: 'start', v: 'select',
};

export const KEY_HINTS: { action: Action; label: string; keys: string }[] = [
  { action: 'confirm', label: 'Circle ○', keys: 'Enter / Space' },
  { action: 'back', label: 'Cross ✕', keys: 'Esc / Backspace' },
  { action: 'triangle', label: 'Triangle △', keys: 'I' },
  { action: 'square', label: 'Square □', keys: 'B' },
  { action: 'l', label: 'L / R', keys: 'Q / E · PgUp / PgDn' },
  { action: 'start', label: 'START', keys: 'O' },
  { action: 'select', label: 'SELECT', keys: 'V' },
  { action: 'up', label: 'D-Pad', keys: 'Arrows / WASD' },
];

let installed = false;

function installGlobalListeners() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    const typing =
      target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    if (typing && e.key !== 'Escape') return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const action = KEYMAP[key];
    if (!action) return;
    e.preventDefault();
    dispatch(action, e.repeat);
  });

  // Gamepad: standard mapping, with auto-repeat on the D-pad / left stick.
  const BUTTONS: [number, Action][] = [
    [0, 'confirm'], [1, 'back'], [2, 'square'], [3, 'triangle'],
    [4, 'l'], [5, 'r'], [8, 'select'], [9, 'start'],
    [12, 'up'], [13, 'down'], [14, 'left'], [15, 'right'],
  ];
  const REPEATABLE = new Set<Action>(['up', 'down', 'left', 'right', 'l', 'r']);
  const held = new Map<Action, number>(); // action -> next repeat timestamp

  const poll = (now: number) => {
    const pad = Array.from(navigator.getGamepads?.() ?? []).find((p) => p?.connected);
    const active = new Set<Action>();
    if (pad) {
      for (const [index, action] of BUTTONS) if (pad.buttons[index]?.pressed) active.add(action);
      const [x = 0, y = 0] = pad.axes;
      if (y < -0.6) active.add('up');
      if (y > 0.6) active.add('down');
      if (x < -0.6) active.add('left');
      if (x > 0.6) active.add('right');
    }
    for (const action of active) {
      const next = held.get(action);
      if (next === undefined) {
        dispatch(action, false);
        held.set(action, now + 380);
      } else if (REPEATABLE.has(action) && now >= next) {
        dispatch(action, true);
        held.set(action, now + 85);
      }
    }
    for (const action of held.keys()) if (!active.has(action)) held.delete(action);
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
}

/** Subscribe to PSP actions while `enabled`. Later subscribers take priority. */
export function useInput(handler: Handler, enabled = true) {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    installGlobalListeners();
    if (!enabled) return;
    const id = nextId++;
    stack.push({ id, ref });
    return () => {
      const idx = stack.findIndex((s) => s.id === id);
      if (idx >= 0) stack.splice(idx, 1);
    };
  }, [enabled]);
}
