// Escape the Desk - level 1
// A side-view pixel art game: Timothy the pencil tries to get off the school
// desk before the kid's hands grab him. Plain JavaScript and a <canvas>,
// no libraries and no build step: open index.html in a browser to play.
(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Screen and world
  // ---------------------------------------------------------------------------
  const W = 320, H = 180;            // the game is drawn at this size, then scaled up
  const DESK_Y = 140;                // the top of the desk (the floor Timothy walks on)
  const DESK_L = 20, DESK_R = 300;   // the two ends of the desk
  const FLOOR_Y = 172;               // the classroom floor below the desk
  const GRAVITY = 600;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Every colour in the game. Change these to restyle it.
  const PAL = {
    outline: '#2a2230',
    wall: '#a9c2b0', wallLine: '#9ab5a2',
    board: '#2f4a3c', boardEdge: '#8a6440', chalk: '#e8efe6',
    deskTop: '#e2ad72', desk: '#c98f55', deskDark: '#8f5c31',
    floor: '#5d4b5e', floorLine: '#4d3d4f', leg: '#7d8590', legDark: '#5b626c',
    yellow: '#f6c624', yellowDark: '#d89b12', yellowLight: '#ffe37a',
    wood: '#ecc68f', woodDark: '#c99a5e', lead: '#3a3a44', leadLight: '#6a6a78',
    metal: '#c3c9d2', metalDark: '#7c8490',
    pink: '#f08aa0', pinkDark: '#c9607a',
    skin: '#f3c29b', skinDark: '#d99a72', nail: '#f8dccb',
    shirt: '#d9544d', shirtStripe: '#f4ecd8', marker: '#3f6fd8',
    shadow: 'rgba(40,24,40,0.45)', danger: '#ff4d4d',
    glue: '#f7f4ea', glueEdge: '#cfc8b0',
    bookRed: '#c4453d', bookBlue: '#3f7bbf', bookYellow: '#e2b33c', bookGreen: '#4f9a5c', pages: '#f2ead8',
    eraser: '#f29bb0', eraserDark: '#cf6f89', eraserBand: '#4c7fd0',
    ruler: '#efd27a', rulerMark: '#7a5a2a',
    cup: '#5a7fc0', cupDark: '#3f5d96', cupLight: '#86a6dc',
    white: '#ffffff', ok: '#7be08a',
  };

  // ---------------------------------------------------------------------------
  // Level 1 layout (x = distance from the left of the screen, h = height)
  // ---------------------------------------------------------------------------
  const LEVEL = {
    start: 150,
    solids: [
      { kind: 'books', x: 50, w: 34, h: 20 },
      { kind: 'eraser', x: 96, w: 14, h: 7 },
      { kind: 'book', x: 222, w: 28, h: 14 },
      { kind: 'cup', x: 256, w: 14, h: 34 },
    ],
    glue: { x: 172, w: 18 },
    ramp: { x1: 196, x2: 222, rise: 14 },   // the ruler, leaning on the green book
    sharpener: { x: 118, w: 10, h: 9 },
  };
  for (const s of LEVEL.solids) s.top = DESK_Y - s.h;

  // ---------------------------------------------------------------------------
  // Tuning: how Timothy and the hands feel
  // ---------------------------------------------------------------------------
  const TUNE = {
    walkSpeed: 70,
    jumpSpeed: 200,
    rollAccel: 240,
    rollBrake: 380,
    rollFriction: 45,       // low friction = lots of rolling momentum
    rollMax: 170,
    rampPush: 220,          // extra speed rolling down the ruler
    dullSlowdown: 0.15,     // each stab makes Timothy this much slower
    maxDull: 3,
    shortenBy: 3,           // pixels lost when sharpening a pencil that is already sharp
    minBody: 8,
    warnTime: 0.7,          // the warning before each hand move
  };

  // ---------------------------------------------------------------------------
  // Little helpers
  // ---------------------------------------------------------------------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - (1 - t) * (1 - t);
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function rampY(x) {
    const r = LEVEL.ramp;
    return DESK_Y - r.rise * clamp((x - r.x1) / (r.x2 - r.x1), 0, 1);
  }
  // The highest surface at x, where a hand would land.
  function groundAt(x) {
    let y = DESK_Y;
    for (const s of LEVEL.solids) if (x >= s.x && x <= s.x + s.w) y = Math.min(y, s.top);
    const r = LEVEL.ramp;
    if (x >= r.x1 && x <= r.x2) y = Math.min(y, rampY(x));
    return y;
  }
  function circleRect(cx, cy, r, b) {
    const nx = clamp(cx, b.l, b.r), ny = clamp(cy, b.t, b.b);
    const dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }

  // ---------------------------------------------------------------------------
  // Tiny 3x5 pixel font for words drawn inside the game
  // ---------------------------------------------------------------------------
  const FONT = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
    E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
    I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
    M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
    Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
    Y: '101101010010010', Z: '111001010100111',
    0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
    4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010',
    8: '111101111101111', 9: '111101111001110',
    '!': '010010010000010', '+': '000010111010000', '=': '000111000111000', '.': '000000000000010',
    '-': '000000111000000', '?': '110001010000010', ':': '000010000010000', ' ': '000000000000000',
  };
  function textWidth(str, s = 1) { return str.length * 4 * s - s; }
  function drawText(g, str, x, y, col, s = 1, outline = null) {
    str = String(str).toUpperCase();
    const draw = (ox, oy, c) => {
      g.fillStyle = c;
      for (let i = 0; i < str.length; i++) {
        const glyph = FONT[str[i]] || FONT['?'];
        for (let p = 0; p < 15; p++) {
          if (glyph[p] === '1') g.fillRect(x + ox + (i * 4 + (p % 3)) * s, y + oy + Math.floor(p / 3) * s, s, s);
        }
      }
    };
    if (outline) for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) draw(ox, oy, outline);
    draw(0, 0, col);
  }

  // ---------------------------------------------------------------------------
  // Sprites, drawn once into small off-screen canvases
  // ---------------------------------------------------------------------------
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    return [c, g];
  }
  function px(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }
  // A filled box with a 1px outline and clipped corners (looks rounded at pixel size).
  function blob(g, x, y, w, h, col, ol = PAL.outline) {
    px(g, x - 1, y, w + 2, h, ol);
    px(g, x, y - 1, w, h + 2, ol);
    px(g, x, y, w, h, col);
  }

  // The kid's open hand, fingers pointing down, fingertips at the bottom edge.
  const HAND_OPEN = (() => {
    const [c, g] = makeCanvas(26, 32);
    blob(g, 5, 1, 16, 7, PAL.shirt);
    px(g, 5, 4, 16, 1, PAL.shirtStripe);
    const fingers = [[5, 8], [9, 10], [13, 9], [17, 7]];
    for (const [fx, len] of fingers) {
      blob(g, fx, 19, 3, len, PAL.skin);
      px(g, fx + 1, 19 + len - 2, 1, 1, PAL.nail);
    }
    blob(g, 21, 10, 3, 5, PAL.skin);
    blob(g, 20, 14, 3, 5, PAL.skin);
    blob(g, 5, 8, 16, 11, PAL.skin);
    for (const [fx] of fingers) px(g, fx, 19, 3, 1, PAL.skin);
    px(g, 5, 8, 16, 1, PAL.skinDark);
    // a smiley drawn on the back of the hand in blue marker
    px(g, 10, 11, 1, 1, PAL.marker); px(g, 14, 11, 1, 1, PAL.marker);
    px(g, 10, 13, 1, 1, PAL.marker); px(g, 11, 14, 3, 1, PAL.marker); px(g, 14, 13, 1, 1, PAL.marker);
    return c;
  })();

  // The same hand closed into a grabbing fist (centred on what it holds).
  const HAND_FIST = (() => {
    const [c, g] = makeCanvas(26, 26);
    blob(g, 5, 1, 16, 7, PAL.shirt);
    px(g, 5, 4, 16, 1, PAL.shirtStripe);
    blob(g, 4, 8, 18, 14, PAL.skin);
    px(g, 4, 20, 18, 2, PAL.skinDark);
    for (const kx of [8, 12, 16]) px(g, kx, 16, 1, 6, PAL.outline);
    blob(g, 6, 12, 11, 3, PAL.skin);
    px(g, 6, 15, 11, 1, PAL.skinDark);
    px(g, 11, 9, 1, 1, PAL.marker); px(g, 15, 9, 1, 1, PAL.marker);
    return c;
  })();

  // Timothy lying down, seen end-on (he tipped toward or away from the camera).
  // 24 rotation frames for each end, so he visibly rolls.
  function makeRollFrames(end) {
    const frames = [];
    const R = 5.6, N = 24, S = 13, c0 = S / 2;
    const k = Math.sqrt(3);
    for (let f = 0; f < N; f++) {
      const a = (f / N) * Math.PI * 2;
      const [c, g] = makeCanvas(S, S);
      for (let j = 0; j < S; j++) {
        for (let i = 0; i < S; i++) {
          const x0 = i + 0.5 - c0, y0 = j + 0.5 - c0;
          const x = x0 * Math.cos(-a) - y0 * Math.sin(-a);
          const y = x0 * Math.sin(-a) + y0 * Math.cos(-a);
          const inside = (rr) => Math.abs(y) <= rr * k / 2 && k * Math.abs(x) + Math.abs(y) <= k * rr;
          if (!inside(R)) continue;
          let col;
          if (!inside(R - 1.1)) col = PAL.outline;
          else {
            const d = Math.hypot(x0, y0);
            // facets: shade by which side of the hexagon this pixel is on
            const face = (Math.floor(((Math.atan2(y, x) + Math.PI / 6) / (Math.PI / 3)) + 6) % 6);
            col = face % 2 ? PAL.yellow : PAL.yellowLight;
            if (face === 0 && d > 2.6) col = PAL.yellowDark; // the printed side, shows the roll
            if (end === 'tip') {
              if (d < 3.1) col = PAL.wood;
              if (d < 1.3) col = PAL.lead;
            } else {
              if (d < 3.9) col = PAL.metalDark;
              if (d < 3.1) col = PAL.pink;
              if (d < 1.4) col = PAL.eraser;
            }
          }
          px(g, i, j, 1, 1, col);
        }
      }
      frames.push(c);
    }
    return frames;
  }
  const ROLL_TIP = makeRollFrames('tip');
  const ROLL_ERASER = makeRollFrames('eraser');

  // Timothy standing up, drawn fresh each frame because he changes:
  // he gets duller when he stabs, and shorter when he sharpens.
  function drawTimothy(g, cx, feet, opts) {
    const { bodyLen, dull, facing, walkPhase, stabbing, mood, airborne } = opts;
    const L = Math.round(cx) - 4;            // left edge of the 9px-wide pencil
    let y = Math.round(feet);
    const ol = PAL.outline;
    // legs
    const step = airborne ? 0 : Math.round(Math.sin(walkPhase * Math.PI * 2));
    px(g, L + 2, y - 2, 1, 2 - (step > 0 ? 1 : 0), ol);
    px(g, L + 6, y - 2, 1, 2 - (step < 0 ? 1 : 0), ol);
    px(g, L + 1 + (facing > 0 ? 1 : 0), y - 1, 2, 1, ol);
    px(g, L + 5 + (facing > 0 ? 1 : 0), y - 1, 2, 1, ol);
    if (airborne) { px(g, L + 1, y - 1, 2, 1, ol); px(g, L + 6, y - 1, 2, 1, ol); }
    y -= 2;
    // eraser
    px(g, L + 1, y - 1, 7, 1, ol);
    px(g, L, y - 4, 9, 3, ol);
    px(g, L + 1, y - 4, 7, 3, PAL.pink);
    px(g, L + 1, y - 2, 7, 1, PAL.pinkDark);
    px(g, L + 2, y - 1, 5, 1, PAL.pinkDark);
    y -= 4;
    // metal ferrule
    px(g, L, y - 3, 9, 3, ol);
    px(g, L + 1, y - 3, 7, 3, PAL.metal);
    px(g, L + 1, y - 2, 7, 1, PAL.metalDark);
    y -= 3;
    // yellow body with facets
    const top = y - bodyLen;
    px(g, L, top, 9, bodyLen, ol);
    px(g, L + 1, top, 7, bodyLen, PAL.yellow);
    px(g, L + 2, top, 1, bodyLen, PAL.yellowLight);
    px(g, L + 6, top, 1, bodyLen, PAL.yellowDark);
    // face: two dot eyes and a smiling line mouth
    const f = facing > 0 ? 1 : 0;
    const ey = top + 4;
    px(g, L + 2 + f, ey, 1, 2, ol);
    px(g, L + 5 + f, ey, 1, 2, ol);
    const my = ey + 4;
    if (mood === 'worried') {
      px(g, L + 3 + f, my, 2, 2, ol);
    } else if (mood === 'happy') {
      px(g, L + 2 + f, my, 4, 1, ol); px(g, L + 3 + f, my + 1, 2, 1, PAL.pinkDark);
    } else {
      px(g, L + 2 + f, my, 1, 1, ol); px(g, L + 3 + f, my + 1, 2, 1, ol); px(g, L + 5 + f, my, 1, 1, ol);
    }
    // tiny arms
    const ay = top + Math.max(10, Math.floor(bodyLen * 0.6));
    if (stabbing) {
      px(g, L - 1, ay - 5, 1, 5, ol); px(g, L + 9, ay - 5, 1, 5, ol);
    } else {
      const swing = airborne ? -1 : Math.round(Math.sin(walkPhase * Math.PI * 2 + 1.5));
      px(g, L - 2, ay + swing, 2, 1, ol); px(g, L - 2, ay + swing + 1, 1, 1, ol);
      px(g, L + 9, ay - swing, 2, 1, ol); px(g, L + 10, ay - swing + 1, 1, 1, ol);
    }
    // the sharpened tip: wood cone and graphite, blunter with each stab
    const widths = [1, 3, 3, 5, 5, 7].slice(dull);
    const leadRows = dull === 0 ? 2 : 1;
    let ty = top - widths.length;
    for (let r = 0; r < widths.length; r++) {
      const w = widths[r], x = L + 4 - (w - 1) / 2;
      px(g, x - 1, ty + r, w + 2, 1, ol);
      px(g, x, ty + r, w, 1, r < leadRows ? PAL.lead : PAL.wood);
      if (r >= leadRows && w > 2) px(g, x + w - 1, ty + r, 1, 1, PAL.woodDark);
    }
    if (dull === 0) px(g, L + 4, ty - 1, 1, 1, ol);
    if (stabbing) {
      // a little flash at the tip
      px(g, L + 4, ty - 5, 1, 3, PAL.white);
      px(g, L + 2, ty - 3, 1, 1, PAL.white); px(g, L + 6, ty - 3, 1, 1, PAL.white);
    }
  }

  // ---------------------------------------------------------------------------
  // The classroom background (drawn once)
  // ---------------------------------------------------------------------------
  const BG = (() => {
    const [c, g] = makeCanvas(W, H);
    px(g, 0, 0, W, FLOOR_Y, PAL.wall);
    for (let x = 6; x < W; x += 16) px(g, x, 0, 1, FLOOR_Y, PAL.wallLine);
    // chalkboard
    px(g, 62, 14, 196, 68, PAL.boardEdge);
    px(g, 64, 16, 192, 64, PAL.board);
    px(g, 58, 82, 204, 3, PAL.boardEdge);
    px(g, 90, 81, 6, 1, PAL.chalk); px(g, 200, 81, 4, 1, '#f4b8c8');
    drawText(g, 'TODAY: SPELLING TEST', 76, 24, PAL.chalk);
    drawText(g, '2+2=4', 76, 36, PAL.chalk);
    drawText(g, 'NO PENCILS ON THE FLOOR!', 76, 64, PAL.chalk);
    // a chalk sun doodle
    for (let a = 0; a < 8; a++) {
      const ang = a * Math.PI / 4;
      px(g, Math.round(222 + Math.cos(ang) * 9), Math.round(42 + Math.sin(ang) * 9), 1, 1, PAL.chalk);
    }
    for (let a = 0; a < 20; a++) {
      const ang = a * Math.PI / 10;
      px(g, Math.round(222 + Math.cos(ang) * 5), Math.round(42 + Math.sin(ang) * 5), 1, 1, PAL.chalk);
    }
    // clock
    for (let a = 0; a < 40; a++) {
      const ang = a * Math.PI / 20;
      px(g, Math.round(290 + Math.cos(ang) * 10), Math.round(34 + Math.sin(ang) * 10), 1, 1, PAL.outline);
    }
    g.fillStyle = PAL.white; g.beginPath(); g.arc(290, 34, 9.4, 0, Math.PI * 2); g.fill();
    px(g, 290, 27, 1, 7, PAL.outline); px(g, 290, 34, 5, 1, PAL.outline);
    // floor
    px(g, 0, FLOOR_Y, W, H - FLOOR_Y, PAL.floor);
    for (let x = 0; x < W; x += 20) px(g, x, FLOOR_Y, 1, H - FLOOR_Y, PAL.floorLine);
    px(g, 0, FLOOR_Y, W, 1, PAL.floorLine);
    // desk legs
    for (const lx of [28, 288]) {
      px(g, lx, DESK_Y + 12, 4, FLOOR_Y - DESK_Y - 12, PAL.leg);
      px(g, lx + 3, DESK_Y + 12, 1, FLOOR_Y - DESK_Y - 12, PAL.legDark);
    }
    px(g, 32, 160, 256, 2, PAL.legDark);
    // desk top and front
    px(g, DESK_L, DESK_Y, DESK_R - DESK_L, 12, PAL.outline);
    px(g, DESK_L + 1, DESK_Y, DESK_R - DESK_L - 2, 3, PAL.deskTop);
    px(g, DESK_L + 1, DESK_Y + 3, DESK_R - DESK_L - 2, 8, PAL.desk);
    px(g, DESK_L + 1, DESK_Y + 10, DESK_R - DESK_L - 2, 1, PAL.deskDark);
    for (let x = DESK_L + 9; x < DESK_R - 6; x += 37) px(g, x, DESK_Y + 5, 9, 1, PAL.deskDark);
    // doodles scratched into the desk
    drawText(g, 'A+', 140, DESK_Y + 4, PAL.marker);
    px(g, 236, DESK_Y + 5, 2, 1, PAL.bookRed); px(g, 239, DESK_Y + 5, 2, 1, PAL.bookRed);
    px(g, 236, DESK_Y + 6, 5, 1, PAL.bookRed); px(g, 237, DESK_Y + 7, 3, 1, PAL.bookRed); px(g, 238, DESK_Y + 8, 1, 1, PAL.bookRed);

    // --- things on the desk ---
    const book = (x, y, w, h, col) => {
      px(g, x - 1, y - 1, w + 2, h + 2, PAL.outline);
      px(g, x, y, w, h, col);
      px(g, x + w - 3, y + 1, 2, h - 2, PAL.pages);
      px(g, x + 3, y, 1, h, PAL.outline);
    };
    // stack of textbooks
    book(51, 133, 32, 7, PAL.bookRed);
    book(53, 127, 28, 5, PAL.bookBlue);
    book(52, 121, 30, 5, PAL.bookYellow);
    // eraser
    px(g, 96, 133, 14, 7, PAL.outline);
    px(g, 97, 134, 12, 5, PAL.eraser);
    px(g, 97, 138, 12, 1, PAL.eraserDark);
    px(g, 101, 134, 4, 5, PAL.eraserBand);
    // sharpener
    const sp = LEVEL.sharpener;
    px(g, sp.x, DESK_Y - sp.h, sp.w, sp.h, PAL.outline);
    px(g, sp.x + 1, DESK_Y - sp.h + 1, sp.w - 2, sp.h - 2, PAL.metal);
    px(g, sp.x + 1, DESK_Y - 3, sp.w - 2, 1, PAL.metalDark);
    px(g, sp.x + 1, DESK_Y - 7, 3, 3, PAL.outline);
    px(g, sp.x + 6, DESK_Y - 7, 2, 1, PAL.metalDark);
    // glue puddle
    const gl = LEVEL.glue;
    px(g, gl.x + 1, DESK_Y - 2, gl.w - 2, 2, PAL.glueEdge);
    px(g, gl.x + 2, DESK_Y - 2, gl.w - 4, 1, PAL.glue);
    px(g, gl.x, DESK_Y - 1, gl.w, 1, PAL.glueEdge);
    px(g, gl.x + 5, DESK_Y - 3, 5, 1, PAL.glue);
    px(g, gl.x + 4, DESK_Y - 2, 1, 1, PAL.white);
    // green book under the ruler
    book(223, 127, 26, 12, PAL.bookGreen);
    // ruler ramp
    const r = LEVEL.ramp;
    for (let x = r.x1 - 1; x <= r.x2 + 4; x++) {
      const y = Math.round(rampY(Math.min(x, r.x2)));
      px(g, x, y - 1, 1, 3, PAL.outline);
    }
    for (let x = r.x1; x <= r.x2 + 3; x++) {
      const y = Math.round(rampY(Math.min(x, r.x2)));
      px(g, x, y - 1, 1, 2, PAL.ruler);
      if ((x - r.x1) % 3 === 0) px(g, x, y, 1, 1, PAL.rulerMark);
    }
    // pencil cup
    const cup = LEVEL.solids[3];
    px(g, cup.x - 1, cup.top - 1, cup.w + 2, cup.h + 1, PAL.outline);
    px(g, cup.x, cup.top, cup.w, cup.h, PAL.cup);
    px(g, cup.x, cup.top, cup.w, 2, PAL.cupLight);
    px(g, cup.x + 2, cup.top + 3, 1, cup.h - 5, PAL.cupLight);
    px(g, cup.x + cup.w - 2, cup.top + 2, 1, cup.h - 2, PAL.cupDark);
    px(g, cup.x + 6, cup.top + 14, 3, 3, PAL.bookYellow);
    return c;
  })();

  // ---------------------------------------------------------------------------
  // Sound effects, made with the browser's synthesizer (no sound files)
  // ---------------------------------------------------------------------------
  const sfx = (() => {
    let ac = null, master = null, muted = false, noiseBuf = null;
    function ensure() {
      if (!ac) {
        try {
          ac = new (window.AudioContext || window.webkitAudioContext)();
          master = ac.createGain(); master.gain.value = 0.7; master.connect(ac.destination);
          noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
          const d = noiseBuf.getChannelData(0);
          for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        } catch (e) { ac = null; }
      }
      if (ac && ac.state === 'suspended') ac.resume();
    }
    function tone(f1, f2, dur, type = 'square', vol = 0.06, delay = 0) {
      if (!ac || muted) return;
      const t = ac.currentTime + delay;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f1, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.02);
    }
    function noise(dur, vol, f1, f2, kind = 'bandpass', delay = 0) {
      if (!ac || muted) return;
      const t = ac.currentTime + delay;
      const src = ac.createBufferSource(); src.buffer = noiseBuf;
      const f = ac.createBiquadFilter(); f.type = kind; f.Q.value = 1.2;
      f.frequency.setValueAtTime(f1, t);
      f.frequency.exponentialRampToValueAtTime(f2, t + dur);
      const g = ac.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t); src.stop(t + dur + 0.02);
    }
    return {
      ensure,
      toggleMute() { muted = !muted; return muted; },
      get muted() { return muted; },
      step() { tone(900, 700, 0.03, 'square', 0.025); },
      jump() { tone(280, 720, 0.16, 'square', 0.06); },
      thud() { tone(140, 60, 0.12, 'sine', 0.18); noise(0.1, 0.12, 600, 200, 'lowpass'); },
      roll() { tone(1500, 1300, 0.02, 'square', 0.02); },
      bonk() { tone(220, 110, 0.08, 'square', 0.06); },
      whoosh() { noise(0.35, 0.16, 300, 2200, 'bandpass'); },
      slam() { noise(0.18, 0.3, 500, 80, 'lowpass'); tone(90, 40, 0.15, 'sine', 0.25); },
      warn() { tone(880, 880, 0.06, 'square', 0.03); },
      stab() { tone(1200, 2600, 0.07, 'sawtooth', 0.04); },
      ouch() { tone(620, 240, 0.28, 'square', 0.07); tone(500, 180, 0.28, 'triangle', 0.06, 0.03); },
      grind() { noise(0.45, 0.12, 2600, 1600, 'bandpass'); tone(180, 160, 0.4, 'sawtooth', 0.02); },
      caught() { [523, 415, 330, 220].forEach((f, i) => tone(f, f * 0.97, 0.18, 'square', 0.06, i * 0.15)); },
      win() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, f, 0.14, 'square', 0.06, i * 0.1)); },
      go() { tone(660, 660, 0.08, 'square', 0.05); tone(990, 990, 0.14, 'square', 0.05, 0.1); },
    };
  })();

  // ---------------------------------------------------------------------------
  // Keyboard and touch input
  // ---------------------------------------------------------------------------
  const held = { left: false, right: false, up: false, down: false, stab: false };
  const pressed = { up: false, down: false, stab: false, restart: false, start: false };
  const KEYS = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    Space: 'stab', KeyJ: 'stab', KeyR: 'restart', Enter: 'start',
  };
  function press(action) {
    sfx.ensure();
    if (action in held) held[action] = true;
    if (action in pressed) pressed[action] = true;
  }
  function release(action) { if (action in held) held[action] = false; }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') { sfx.ensure(); updateMuteLabel(sfx.toggleMute()); return; }
    const a = KEYS[e.code];
    if (!a) return;
    e.preventDefault();
    if (e.repeat && a in pressed && !(a in held)) return;
    if (e.repeat) { if (a in held) held[a] = true; return; }
    press(a);
  });
  window.addEventListener('keyup', (e) => { const a = KEYS[e.code]; if (a) release(a); });
  window.addEventListener('blur', () => { for (const k in held) held[k] = false; });
  for (const btn of document.querySelectorAll('[data-act]')) {
    const a = btn.dataset.act;
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); btn.setPointerCapture?.(e.pointerId); press(a); btn.classList.add('down'); });
    const up = () => { release(a); btn.classList.remove('down'); };
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('lostpointercapture', up);
  }

  // ---------------------------------------------------------------------------
  // Timothy
  // ---------------------------------------------------------------------------
  const P = {};
  function resetPencil() {
    Object.assign(P, {
      x: LEVEL.start, y: DESK_Y, vx: 0, vy: 0,
      onGround: true, onRamp: false, lying: false, facing: 1, end: 'tip',
      roll: 0, rollTick: 0, bodyLen: 20, dull: 0,
      stabT: 0, stabCD: 0, sharpLock: false, walkPhase: 0, stepT: 0,
    });
  }
  const tipH = () => 6 - P.dull;
  const standH = () => 2 + 4 + 3 + P.bodyLen + tipH();
  const halfW = () => (P.lying ? 5.5 : 3.5);
  const bodyH = () => (P.lying ? 11 : standH());
  const speedFactor = () => 1 - TUNE.dullSlowdown * P.dull;
  function pencilBox(shrink = 0) {
    const hw = halfW() - shrink;
    return { l: P.x - hw, r: P.x + hw, t: P.y - bodyH() + shrink, b: P.y - shrink };
  }
  function hitsSolid(l, r, t, b) {
    for (const s of LEVEL.solids) {
      if (r > s.x + 0.01 && l < s.x + s.w - 0.01 && b > s.top + 0.5 && t < DESK_Y) return s;
    }
    return null;
  }
  const onDesk = () => P.x >= DESK_L && P.x <= DESK_R;
  const onGlue = () => P.onGround && P.y >= DESK_Y - 0.5 && P.x > LEVEL.glue.x && P.x < LEVEL.glue.x + LEVEL.glue.w;

  function pushOut() {
    const hw = halfW();
    const s = hitsSolid(P.x - hw, P.x + hw, P.y - bodyH(), P.y);
    if (!s) return;
    P.x = P.x < s.x + s.w / 2 ? s.x - hw : s.x + s.w + hw;
  }

  // The sharpener: stand at it and press Down. Sharp again if dull,
  // otherwise Timothy just gets a bit shorter (and jumps lower).
  function atSharpener() {
    const sp = LEVEL.sharpener, hw = halfW();
    return !P.lying && P.x + hw > sp.x - 2 && P.x - hw < sp.x + sp.w + 2 && P.y > DESK_Y - sp.h;
  }
  function sharpen() {
    sfx.grind();
    const y = P.y - standH() - 8;
    if (P.dull > 0) {
      P.dull = 0;
      pop(P.x, y, 'SHARP!', PAL.ok);
    } else if (P.bodyLen > TUNE.minBody) {
      P.bodyLen -= TUNE.shortenBy;
      pop(P.x, y, 'SHORTER!', PAL.bookYellow);
    } else {
      pop(P.x, y, 'TOO SHORT!', PAL.bookYellow);
    }
    updateHud();
  }

  function updatePencil(dt) {
    const dir = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    const spd = speedFactor();
    const glue = onGlue();

    if (!P.lying) {
      P.vx = dir * TUNE.walkSpeed * spd * (glue ? 0.4 : 1);
      if (dir) P.facing = dir;
      if (pressed.up && P.onGround) {
        P.vy = -TUNE.jumpSpeed * (0.7 + 0.3 * P.bodyLen / 20);
        P.onGround = false;
        sfx.jump();
      } else if (pressed.down && P.onGround && atSharpener()) {
        sharpen();
      } else if (pressed.down && P.onGround) {
        P.lying = true;
        P.end = P.facing > 0 ? 'tip' : 'eraser';   // tip over toward or away from the camera
        P.vx *= 0.6;
        pushOut();
        sfx.thud();
      }
      if (P.onGround && dir) {
        P.walkPhase += dt * 4;
        P.stepT -= dt;
        if (P.stepT <= 0) { sfx.step(); P.stepT = 0.2; }
      } else if (!dir) {
        P.walkPhase = 0;
      }
    } else {
      if (glue) {
        P.vx *= Math.exp(-10 * dt);
      } else {
        if (dir) {
          const braking = Math.sign(P.vx) === -dir && Math.abs(P.vx) > 5;
          P.vx += dir * (braking ? TUNE.rollBrake : TUNE.rollAccel) * spd * dt;
          P.facing = dir;
        } else if (P.onGround) {
          P.vx -= Math.sign(P.vx) * Math.min(Math.abs(P.vx), TUNE.rollFriction * dt);
        }
        if (P.onRamp) P.vx -= TUNE.rampPush * dt;
        const max = TUNE.rollMax * spd;
        P.vx = clamp(P.vx, -max, max);
      }
      if (pressed.up) {
        P.lying = false;
        P.vx = clamp(P.vx, -TUNE.walkSpeed, TUNE.walkSpeed);
        pushOut();
      }
      P.roll += (P.vx * dt) / 5.5;
      P.rollTick += Math.abs(P.vx * dt);
      if (P.rollTick > 6 && P.onGround) { P.rollTick = 0; sfx.roll(); }
    }

    // stab: point the tip at a hand
    P.stabCD -= dt;
    if (P.stabT > 0) P.stabT -= dt;
    if (pressed.stab && P.stabCD <= 0) {
      if (P.lying) { P.lying = false; pushOut(); P.vx = clamp(P.vx, -TUNE.walkSpeed, TUNE.walkSpeed); }
      P.stabT = 0.22; P.stabCD = 0.45;
      sfx.stab();
    }

    // move sideways and bump into things
    P.x += P.vx * dt;
    const hw = halfW();
    const s = hitsSolid(P.x - hw, P.x + hw, P.y - bodyH(), P.y);
    if (s) {
      const canStep = !P.lying && P.onGround && s.top >= P.y - 7.5 &&
        !hitsSolid(P.x - hw, P.x + hw, s.top - bodyH(), s.top);
      if (canStep) {
        P.y = s.top;
      } else {
        if (P.vx > 0) P.x = s.x - hw; else if (P.vx < 0) P.x = s.x + s.w + hw; else pushOut();
        if (P.lying && Math.abs(P.vx) > 50) sfx.bonk();
        P.vx = 0;
      }
    }

    // fall and land
    const prevY = P.y;
    P.vy = Math.min(P.vy + GRAVITY * dt, 420);
    P.y += P.vy * dt;
    P.onGround = false; P.onRamp = false;
    if (P.vy >= 0) {
      for (const sl of LEVEL.solids) {
        if (P.x + hw > sl.x + 0.01 && P.x - hw < sl.x + sl.w - 0.01 && prevY <= sl.top + 0.5 && P.y >= sl.top) {
          P.y = sl.top; P.vy = 0; P.onGround = true;
        }
      }
    }
    if (onDesk() && P.y >= DESK_Y) { P.y = DESK_Y; P.vy = 0; P.onGround = true; }
    const r = LEVEL.ramp;
    if (P.x >= r.x1 && P.x <= r.x2 && P.vy >= 0) {
      const ry = rampY(P.x);
      if (P.y >= ry - 2.5 && P.y <= ry + 9) { P.y = ry; P.vy = 0; P.onGround = true; P.onRamp = true; }
    }
    if (!onDesk() && P.y >= FLOOR_Y) { P.y = FLOOR_Y; P.vy = 0; P.onGround = true; }

  }

  // ---------------------------------------------------------------------------
  // The hands: slam, dive, swipe and guard
  // ---------------------------------------------------------------------------
  const hands = [];
  function makeHand(home) {
    return { home, state: 'idle', move: null, t: 0, x: -40, y: -40, angle: 0, fist: false, rest: 0, shake: 0 };
  }
  function handDir(h) { return { x: -Math.sin(h.angle), y: Math.cos(h.angle) }; }
  function handCircle(h) {
    const d = handDir(h);
    const r = h.move === 'guard' ? 13 : 11;
    return { x: h.x - d.x * r, y: h.y - d.y * r, r };
  }

  function swipeBlocked(h) {
    const c = handCircle(h);
    return LEVEL.solids.some((s) => circleRect(c.x, c.y, c.r - 2, { l: s.x, r: s.x + s.w, t: s.top, b: DESK_Y }));
  }

  function startMove(h, move) {
    h.move = move; h.state = 'warn'; h.t = 0; h.fist = false;
    if (move === 'slam' || move === 'guard') {
      if (move === 'slam') {
        h.tx = clamp(P.x + P.vx * 0.2, DESK_L + 8, DESK_R - 8);
      } else {
        const nearer = P.x < (DESK_L + DESK_R) / 2 ? -1 : 1;
        h.side = Math.random() < 0.7 ? nearer : -nearer;
        h.tx = h.side < 0 ? DESK_L + 12 : DESK_R - 12;
      }
      h.ty = groundAt(h.tx);
      h.x = h.tx; h.y = -4; h.angle = 0;
    } else if (move === 'dive') {
      h.sx = h.home < 0 ? -6 : W + 6; h.sy = -6;
      const tx = clamp(P.x, DESK_L + 8, DESK_R - 8), ty = groundAt(tx);
      const dx = tx - h.sx, dy = ty - h.sy, len = Math.hypot(dx, dy);
      h.dx = dx / len; h.dy = dy / len; h.len = len; h.tx = tx; h.ty = ty;
      h.angle = Math.atan2(h.dy, h.dx) - Math.PI / 2;
      h.x = h.sx; h.y = h.sy; h.dist = 0;
    } else if (move === 'swipe') {
      // the hand drops in to one side of Timothy, turned sideways, then sweeps across
      h.high = Math.random() < 0.5;
      h.dirX = -h.home;                       // the left hand sweeps right, the right hand sweeps left
      h.angle = h.dirX > 0 ? -Math.PI / 2 : Math.PI / 2;
      h.ty = h.high ? DESK_Y - 27 : DESK_Y - 8;
      h.x = clamp(P.x - h.dirX * 80, DESK_L + 4, DESK_R - 4);
      if (Math.abs(h.x - P.x) < 40) {          // too close to an end: come from the other side
        h.dirX = -h.dirX;
        h.angle = -h.angle;
        h.x = clamp(P.x - h.dirX * 80, DESK_L + 4, DESK_R - 4);
      }
      h.y = h.ty;
      for (let i = 0; i < 30 && swipeBlocked(h); i++) h.x += h.dirX * 4;   // don't start inside a book
      h.y = -12;
    }
    sfx.warn();
  }

  function endMove(h, rest = rand(0.6, 1.2)) {
    h.state = 'idle'; h.move = null; h.rest = rest; h.x = -40; h.y = -40;
    game.nextMove = Math.max(game.nextMove, rand(0.8, 1.4));
  }

  // Is this hand able to catch Timothy right now?
  function handDangerous(h) {
    if (h.state === 'act') {
      if (h.move === 'slam') return h.t < 0.12 + 0.35;
      if (h.move === 'guard') return h.t < 0.15 + 2.6;
      return true;
    }
    return false;
  }

  function updateHand(h, dt) {
    h.t += dt;
    if (h.shake > 0) h.shake -= dt;
    if (h.state === 'idle') { h.rest -= dt; return; }
    const warn = TUNE.warnTime;

    if (h.state === 'hurt') {
      h.x += h.hvx * dt; h.y += h.hvy * dt; h.hvy -= 200 * dt;
      if (h.t > 0.7) endMove(h, 1.8);
      return;
    }
    if (h.state === 'grab') return;

    switch (h.move) {
      case 'slam':
      case 'guard': {
        const hold = h.move === 'slam' ? 0.35 : 2.6;
        const drop = h.move === 'slam' ? 0.12 : 0.15;
        if (h.state === 'warn') {
          h.y = lerp(-4, 16, easeOut(Math.min(1, h.t / warn)));
          if (h.t >= warn) { h.state = 'act'; h.t = 0; sfx.whoosh(); }
        } else if (h.state === 'act') {
          if (h.t < drop) h.y = lerp(16, h.ty, h.t / drop);
          else if (h.t < drop + hold) {
            if (h.y !== h.ty) { h.y = h.ty; sfx.slam(); game.shake = 0.15; }
          } else if (h.t < drop + hold + 0.4) h.y = lerp(h.ty, -10, (h.t - drop - hold) / 0.4);
          else endMove(h);
        }
        break;
      }
      case 'dive': {
        if (h.state === 'warn') {
          const d = 22 * easeOut(Math.min(1, h.t / warn));
          h.x = h.sx + h.dx * d; h.y = h.sy + h.dy * d;
          if (h.t >= warn) { h.state = 'act'; h.t = 0; h.dist = 22; h.phase = 'go'; sfx.whoosh(); }
        } else if (h.state === 'act') {
          if (h.phase === 'go') {
            h.dist += 330 * dt;
            if (h.dist >= h.len) { h.dist = h.len; h.phase = 'hold'; h.holdT = 0; sfx.slam(); game.shake = 0.1; }
          } else if (h.phase === 'hold') {
            h.holdT += dt;
            if (h.holdT > 0.25) { h.state = 'retreat'; }
          }
          h.x = h.sx + h.dx * h.dist; h.y = h.sy + h.dy * h.dist;
        } else if (h.state === 'retreat') {
          h.dist -= 260 * dt;
          h.x = h.sx + h.dx * h.dist; h.y = h.sy + h.dy * h.dist;
          if (h.dist <= 0) endMove(h);
        }
        break;
      }
      case 'swipe': {
        if (h.state === 'warn') {
          h.y = lerp(-12, h.ty, easeOut(Math.min(1, h.t / warn)));
          if (h.t >= warn) { h.state = 'act'; h.t = 0; sfx.whoosh(); }
        } else if (h.state === 'act') {
          h.x += h.dirX * 250 * dt;
          if (swipeBlocked(h)) {
            const c = handCircle(h);
            h.state = 'retreat'; h.shake = 0.2; sfx.bonk();
            pop(c.x, c.y - 14, 'BONK', PAL.white);
          }
          if (h.x < -40 || h.x > W + 40) endMove(h);
        } else if (h.state === 'retreat') {
          h.y -= 260 * dt;
          if (h.y < -40) endMove(h);
        }
        break;
      }
    }
  }

  function scheduleHands(dt) {
    game.nextMove -= dt;
    if (game.nextMove > 0) return;
    const busy = hands.filter((h) => h.state !== 'idle');
    if (busy.some((h) => h.move !== 'guard')) return;   // one attack at a time (a guard can overlap)
    const ready = hands.filter((h) => h.state === 'idle' && h.rest <= 0);
    if (!ready.length) return;
    const h = ready.find((x) => x !== game.lastHand) || ready[0];
    const weights = { slam: 3, dive: 2, swipe: 3, guard: 1.5 };
    if (busy.length) delete weights.guard;
    if (game.lastMove && Object.keys(weights).length > 1) delete weights[game.lastMove];
    let total = 0;
    for (const k in weights) total += weights[k];
    let roll = Math.random() * total, move = 'slam';
    for (const k in weights) { roll -= weights[k]; if (roll <= 0) { move = k; break; } }
    startMove(h, move);
    game.lastMove = move; game.lastHand = h;
    game.nextMove = rand(0.5, 1.0);
  }

  // ---------------------------------------------------------------------------
  // Floating words (OUCH!, SHARP! and so on)
  // ---------------------------------------------------------------------------
  const pops = [];
  function pop(x, y, text, col) { pops.push({ x, y, text, col, t: 0 }); }

  // ---------------------------------------------------------------------------
  // Game state
  // ---------------------------------------------------------------------------
  const game = { state: 'title', t: 0, time: 0, nextMove: 0, lastMove: null, lastHand: null, shake: 0, overlayT: 0 };

  function startLevel() {
    resetPencil();
    hands.length = 0;
    hands.push(makeHand(-1), makeHand(1));
    pops.length = 0;
    Object.assign(game, { state: 'ready', t: 0, time: 0, nextMove: 1.0, lastMove: null, lastHand: null, shake: 0 });
    hideOverlay();
    updateHud();
  }

  function caught(h) {
    game.state = 'caught'; game.t = 0;
    h.state = 'grab'; h.fist = true; h.t = 0;
    h.x = P.x; h.y = P.y - bodyH() / 2;
    h.angle = 0;
    sfx.caught();
  }

  function update(dt) {
    game.t += dt;
    if (game.shake > 0) game.shake -= dt;
    for (const p of pops) p.t += dt;
    while (pops.length && pops[0].t > 0.9) pops.shift();

    if (game.state === 'title') {
      if (pressed.start || pressed.stab) startLevel();
    } else if (game.state === 'ready') {
      if (game.t >= 1.3) { game.state = 'play'; game.t = 0; sfx.go(); }
      if (pressed.restart) startLevel();
    } else if (game.state === 'play') {
      game.time += dt;
      updatePencil(dt);
      scheduleHands(dt);
      for (const h of hands) updateHand(h, dt);

      // stab first: a hand you poke can't grab you
      if (P.stabT > 0.07) {
        const top = P.y - standH();
        const tipBox = { l: P.x - 4, r: P.x + 4, t: top - 10, b: top + 6 };
        for (const h of hands) {
          if (h.state !== 'act' && h.state !== 'retreat') continue;
          const c = handCircle(h);
          if (circleRect(c.x, c.y, c.r, tipBox)) {
            h.state = 'hurt'; h.t = 0; h.shake = 0.4;
            h.hvx = Math.sign(h.x - P.x || h.home) * 140; h.hvy = -220;
            P.dull = Math.min(TUNE.maxDull, P.dull + 1);
            P.stabT = 0;
            sfx.ouch();
            pop(c.x, c.y - 16, 'OUCH!', PAL.danger);
            game.nextMove = Math.max(game.nextMove, 1.0);
            updateHud();
          }
        }
      }
      // then: did a hand catch Timothy?
      const box = pencilBox(1);
      for (const h of hands) {
        if (!handDangerous(h)) continue;
        const c = handCircle(h);
        if (circleRect(c.x, c.y, c.r, box)) { caught(h); break; }
      }
      // escaped off the end of the desk?
      if (game.state === 'play' && !onDesk() && P.y > DESK_Y + 6) {
        game.state = 'won'; game.t = 0;
        sfx.win();
      }
      if (pressed.restart) startLevel();
    } else if (game.state === 'caught') {
      const h = hands.find((x) => x.state === 'grab');
      if (h && game.t > 0.45) { h.y -= 140 * dt; P.y -= 140 * dt; }
      if (game.t > 1.1 && !game.overlayShown) showEnd(false);
      if (pressed.restart || (game.t > 1.1 && (pressed.start || pressed.stab))) startLevel();
    } else if (game.state === 'won') {
      // keep falling to the floor
      P.vy = Math.min(P.vy + GRAVITY * dt, 420);
      P.y += P.vy * dt; P.x = clamp(P.x + P.vx * dt * 0.5, 6, W - 6);
      if (P.y >= FLOOR_Y) { P.y = FLOOR_Y; P.vy = -Math.abs(P.vy) * 0.35; if (Math.abs(P.vy) < 30) P.vy = 0; }
      for (const h of hands) if (h.state !== 'idle') updateHand(h, dt);
      if (game.t > 0.8 && !game.overlayShown) showEnd(true);
      if (pressed.restart || (game.t > 0.8 && (pressed.start || pressed.stab))) startLevel();
    }
    for (const k in pressed) pressed[k] = false;
  }

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------
  function shadowAt(x, y, w) {
    w = Math.round(w);
    px(ctx, Math.round(x - w / 2), Math.round(y) - 2, w, 2, PAL.shadow);
    if (w > 6) px(ctx, Math.round(x - w / 2) + 2, Math.round(y) - 3, w - 4, 1, PAL.shadow);
  }

  function drawHand(h) {
    if (h.state === 'idle') return;
    const blink = Math.floor(game.t * 8) % 2 === 0;
    // warnings
    if (h.state === 'warn') {
      const k = Math.min(1, h.t / TUNE.warnTime);
      if (h.move === 'slam' || h.move === 'guard') {
        shadowAt(h.tx, h.ty, lerp(6, h.move === 'guard' ? 30 : 24, k));
        if (h.move === 'guard' && blink) drawText(ctx, '!', h.tx - 1, h.ty - 30, PAL.danger, 2, PAL.outline);
      } else if (h.move === 'dive' && blink) {
        for (let d = 30; d < h.len; d += 7) {
          px(ctx, Math.round(h.sx + h.dx * d), Math.round(h.sy + h.dy * d), 1, 1, PAL.danger);
        }
      } else if (h.move === 'swipe' && blink) {
        drawText(ctx, h.high ? '! HIGH' : '! LOW', Math.round(h.x + h.dirX * 6 - (h.dirX < 0 ? 24 : 0)), Math.round(h.ty) - 3, PAL.danger, 1, PAL.outline);
      }
    } else if (h.state === 'act' && (h.move === 'slam' || h.move === 'guard')) {
      shadowAt(h.tx, h.ty, h.move === 'guard' ? 30 : 24);
    }
    ctx.save();
    let sx = 0;
    if (h.shake > 0) sx = Math.round(Math.sin(h.t * 70) * 2);
    if (h.fist) {
      ctx.translate(Math.round(h.x) + sx, Math.round(h.y));
      ctx.drawImage(HAND_FIST, -13, -16);
    } else {
      ctx.translate(Math.round(h.x) + sx, Math.round(h.y));
      ctx.rotate(h.angle);
      ctx.drawImage(HAND_OPEN, -13, -32);
    }
    ctx.restore();
  }

  function drawPencil() {
    if (game.state === 'title') return;
    const nearHand = hands.some((h) => h.state === 'warn' || h.state === 'act') &&
      hands.some((h) => (h.state === 'warn' || h.state === 'act') && Math.hypot(h.x - P.x, h.y - P.y) < 70);
    if (P.lying && game.state !== 'caught') {
      const frames = P.end === 'tip' ? ROLL_TIP : ROLL_ERASER;
      const a = ((P.roll % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const f = frames[Math.floor((a / (Math.PI * 2)) * frames.length) % frames.length];
      ctx.drawImage(f, Math.round(P.x) - 6, Math.round(P.y) - 12);
      return;
    }
    let mood = nearHand ? 'worried' : 'smile';
    if (game.state === 'won') mood = 'happy';
    if (game.state === 'caught') mood = 'worried';
    const stabbing = P.stabT > 0.05;
    drawTimothy(ctx, P.x, P.y - (stabbing ? 3 : 0), {
      bodyLen: P.bodyLen, dull: P.dull, facing: P.facing, walkPhase: P.walkPhase,
      stabbing, mood, airborne: !P.onGround,
    });
  }

  function render() {
    ctx.save();
    if (game.shake > 0) ctx.translate(Math.round(rand(-1.5, 1.5)), Math.round(rand(-1, 1)));
    ctx.drawImage(BG, 0, 0);
    const caughtHand = hands.find((h) => h.state === 'grab');
    for (const h of hands) if (h !== caughtHand) drawHand(h);
    drawPencil();
    if (caughtHand) drawHand(caughtHand);
    for (const p of pops) {
      const y = Math.round(p.y - p.t * 18);
      const x = Math.round(clamp(p.x - textWidth(p.text) / 2, 2, W - textWidth(p.text) - 2));
      drawText(ctx, p.text, x, y, p.col, 1, PAL.outline);
    }
    if (game.state === 'play' && atSharpener()) {
      const msg = P.dull > 0 ? 'DOWN: SHARPEN' : 'DOWN: SHARPEN (SHORTER)';
      drawText(ctx, msg, Math.round(clamp(LEVEL.sharpener.x + 5 - textWidth(msg) / 2, 2, W - textWidth(msg) - 2)), DESK_Y - 52, PAL.white, 1, PAL.outline);
    }
    if (game.state === 'ready') {
      const word = game.t < 0.9 ? 'READY...' : 'GO!';
      drawText(ctx, word, Math.round(W / 2 - textWidth(word, 3) / 2), 92, PAL.yellow, 3, PAL.outline);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // The words around the game (heads-up display and the start/end cards)
  // ---------------------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay');
  function hideOverlay() { overlay.hidden = true; game.overlayShown = false; }
  function showEnd(won) {
    game.overlayShown = true;
    overlay.hidden = false;
    const secs = game.time.toFixed(1);
    overlay.innerHTML = won
      ? `<div class="card"><h2 class="win">Timothy escaped!</h2><p>Off the desk in ${secs} seconds.</p><button type="button" id="again">Play again</button><p class="hint">or press R</p></div>`
      : `<div class="card"><h2 class="lose">Caught!</h2><p>The hand got Timothy after ${secs} seconds.</p><button type="button" id="again">Try again</button><p class="hint">or press R</p></div>`;
    $('again').addEventListener('click', () => { sfx.ensure(); startLevel(); });
    $('again').focus({ preventScroll: true });
  }
  function updateHud() {
    const names = ['Sharp', 'A bit dull', 'Dull', 'Blunt'];
    $('hud-tip').textContent = names[P.dull] ?? 'Sharp';
    $('hud-tip').dataset.level = String(P.dull);
    $('hud-len').textContent = P.bodyLen >= 20 ? 'Full length' : `Shorter (${Math.round((standH() / (35)) * 100)}%)`;
  }
  function updateMuteLabel(m) { const b = $('mute'); if (b) b.textContent = m ? 'Sound off' : 'Sound on'; }
  $('play').addEventListener('click', () => { sfx.ensure(); startLevel(); });
  $('mute')?.addEventListener('click', () => { sfx.ensure(); updateMuteLabel(sfx.toggleMute()); });

  // ---------------------------------------------------------------------------
  // Main loop: fixed 60 steps per second
  // ---------------------------------------------------------------------------
  resetPencil();
  hands.push(makeHand(-1), makeHand(1));
  updateHud();
  const STEP = 1 / 60;
  let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    while (acc >= STEP) { update(STEP); acc -= STEP; }
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // A hook for automated tests: lets a script read the game state.
  window.__escapeTheDesk = { game, P, hands, startLevel, startMove, LEVEL };
})();
