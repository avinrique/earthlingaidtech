/**
 * hero-wave — a 3D field of glowing points rolling under the hero, in raw WebGL.
 *
 * Deliberately not three.js: the whole effect is one vertex shader displacing a grid of points
 * and one fragment shader drawing soft dots, so it costs ~3 kB instead of a second copy of the
 * renderer. That is also why it can run on phones (at a lower density and pixel ratio), which is
 * where most visitors arriving from a social link will see it.
 *
 * Hero.astro decides whether to call `initWave` at all (reduced motion, data saver and weak
 * devices keep the static CSS glow). Every failure path here returns quietly and leaves the
 * canvas transparent.
 */
import { loopWhileVisible } from './visible-loop';

const VERT = `
attribute vec2 a_grid;          // x in [-1, 1], y = depth in [0, 1] (0 = nearest row)
uniform float u_time;
uniform float u_aspect;
uniform float u_dpr;
uniform float u_amp;            // 0 → 1 as the field rises in on load
uniform vec3 u_mouse;           // xy in grid space, z = strength
varying float v_h;
varying float v_fade;

void main() {
  float x = a_grid.x * 15.0;
  float z = -2.5 - a_grid.y * 30.0;
  float t = u_time;

  float h = sin(x * 0.32 + t * 0.85) * 0.38
          + sin(z * 0.26 - t * 0.65) * 0.46
          + sin((x + z) * 0.17 + t * 0.45) * 0.42
          + sin(x * 0.9 - z * 0.4 + t * 1.3) * 0.08;

  // a soft swell that follows the pointer across the field
  vec2 d = (a_grid - u_mouse.xy) * vec2(1.0, 1.7);
  float swell = exp(-dot(d, d) * 14.0) * u_mouse.z;
  h = h * u_amp + swell * 1.1;

  vec3 p = vec3(x, h - 1.7, z);

  // camera pitched slightly down; horizon lands a little above the canvas centre
  float a = 0.14;
  float ca = cos(a), sa = sin(a);
  vec3 v = vec3(p.x, p.y * ca - p.z * sa, p.y * sa + p.z * ca);

  float f = 1.732; // 1 / tan(30deg): a 60deg vertical field of view
  gl_Position = vec4(v.x * f / u_aspect, v.y * f, 0.0, -v.z);

  float depth = -v.z;
  gl_PointSize = clamp(u_dpr * 34.0 / depth, 1.0, 5.5 * u_dpr);

  v_h = h + swell;
  v_fade = smoothstep(32.0, 8.0, depth)
         * smoothstep(1.2, 3.5, depth)
         * (1.0 - smoothstep(0.72, 1.0, abs(a_grid.x)));
}
`;

const FRAG = `
precision mediump float;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
varying float v_h;
varying float v_fade;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);
  float dotA = smoothstep(0.5, 0.05, r);
  float k = clamp(v_h * 0.55 + 0.5, 0.0, 1.0);
  vec3 col = mix(u_c1, u_c2, k);
  col = mix(col, u_c3, smoothstep(0.85, 1.0, k));
  float alpha = dotA * v_fade * (0.35 + 0.65 * k);
  gl_FragColor = vec4(col * alpha, alpha);
}
`;

const hex = (h: number): [number, number, number] => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

export function initWave(canvas: HTMLCanvasElement, area: HTMLElement) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'low-power' });
  if (!gl) return;

  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const cols = coarse ? 96 : 150;
  const rows = coarse ? 48 : 70;

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  const grid = new Float32Array(cols * rows * 2);
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      grid[i++] = (c / (cols - 1)) * 2 - 1;
      grid[i++] = r / (rows - 1);
    }
  }
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, grid, gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a_grid');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = (name: string) => gl.getUniformLocation(prog, name);
  const uTime = u('u_time');
  const uAspect = u('u_aspect');
  const uDpr = u('u_dpr');
  const uAmp = u('u_amp');
  const uMouse = u('u_mouse');
  gl.uniform3fv(u('u_c1'), hex(0x2e7bd6)); // deep brand blue
  gl.uniform3fv(u('u_c2'), hex(0x4a9eff)); // brand accent
  gl.uniform3fv(u('u_c3'), hex(0x5eead4)); // teal crest

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE); // premultiplied, additive: overlapping dots glow
  gl.clearColor(0, 0, 0, 0);

  const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.25 : 1.75);
  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(uAspect, w / h);
    gl.uniform1f(uDpr, dpr);
  };
  resize();
  new ResizeObserver(resize).observe(canvas);

  // Pointer → a point on the field. The mapping is approximate on purpose: the swell only has
  // to feel like it follows the cursor, not sit under it to the pixel.
  const target = { x: 0, y: 0.35, s: 0 };
  const mouse = { x: 0, y: 0.35, s: 0 };
  if (!coarse) {
    area.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      target.x = px * 2 - 1;
      target.y = Math.min(1, Math.max(0, (1 - py) / 0.62)) ** 1.6;
      target.s = py > 0.25 ? 1 : 0;
    });
    area.addEventListener('pointerleave', () => { target.s = 0; });
  }

  const start = performance.now();
  let last = start;
  loopWhileVisible(canvas, (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - start) / 1000;
    const k = Math.min(1, dt * 3);
    mouse.x += (target.x - mouse.x) * k;
    mouse.y += (target.y - mouse.y) * k;
    mouse.s += (target.s - mouse.s) * Math.min(1, dt * 2);
    // rise in over the first ~1.8s, eased
    const rise = Math.min(1, t / 1.8);
    const amp = 1 - (1 - rise) ** 3;

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uTime, t);
    gl.uniform1f(uAmp, amp);
    gl.uniform3f(uMouse, mouse.x, mouse.y, mouse.s);
    gl.drawArrays(gl.POINTS, 0, cols * rows);
    if (!canvas.hasAttribute('data-ready')) canvas.setAttribute('data-ready', '');
  });
}
