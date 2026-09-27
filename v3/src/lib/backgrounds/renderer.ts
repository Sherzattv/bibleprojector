/**
 * Рендер живого фона на экране проектора.
 *
 * Один WebGL-canvas на все шейдерные фоны (программы компилируются лениво и
 * кэшируются) и Canvas 2D для потока частиц. Что бережёт слабый ноутбук:
 * фон рисуется в доле разрешения (мягким градиентам это незаметно), кадры
 * ограничены 30/60 к/с, а чёрный фон вообще не запускает цикл.
 *
 * Палитра не переключается, а перетекает за ~секунду. Раз в секунду
 * меряется контраст белого текста с фоном в центре экрана — пульт показывает
 * его оператору.
 */
import { findPalette, findPreset, sceneSource } from './catalog'
import { SHADER_FOOT, SHADER_HEAD } from './shaders'
import { contrastOnBackground } from './contrast'
import { DEFAULT_BACKGROUND, type BackgroundSettings } from './settings'

type Rgb = [number, number, number]

const VERT = 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }'
const UNIFORMS = ['uRes', 'uTime', 'uGrain', 'uVig', 'uBg', 'uC1', 'uC2', 'uC3'] as const
type UniformName = (typeof UNIFORMS)[number]

interface Program {
  program: WebGLProgram
  u: Record<UniformName, WebGLUniformLocation | null>
}

interface Particle {
  x: number
  y: number
  life: number
}

const PROBE_EVERY_MS = 1000

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16)
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255]
}

function paletteRgb(id: string): Rgb[] {
  return findPalette(id).colors.map(hexToRgb)
}

/** Детерминированный value noise для поля течения частиц */
function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hash2(xi, yi)
  const b = hash2(xi + 1, yi)
  const c = hash2(xi, yi + 1)
  const d = hash2(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

export class BackgroundRenderer {
  /** Контраст белого текста с самыми светлыми участками фона; null — не мерили */
  onContrast: ((ratio: number | null) => void) | null = null

  private glCanvas: HTMLCanvasElement
  private flowCanvas: HTMLCanvasElement
  private gl: WebGLRenderingContext | null
  private ctx: CanvasRenderingContext2D | null
  private programs = new Map<string, Program | null>()
  private settings: BackgroundSettings = { ...DEFAULT_BACKGROUND }
  private current: Rgb[] = paletteRgb(DEFAULT_BACKGROUND.palette)
  private target: Rgb[] = paletteRgb(DEFAULT_BACKGROUND.palette)
  private raf = 0
  private time = 0
  private last = 0
  private lastDraw = 0
  private lastProbe = 0
  private particles: Particle[][] = [[], [], []]
  private probeBuf: Uint8Array | null = null
  private resizeObserver: ResizeObserver | null = null
  private destroyed = false
  private firstUpdate = true

  constructor(glCanvas: HTMLCanvasElement, flowCanvas: HTMLCanvasElement) {
    this.glCanvas = glCanvas
    this.flowCanvas = flowCanvas
    this.gl = glCanvas.getContext('webgl', {
      antialias: false,
      alpha: false,
      powerPreference: 'low-power',
    })
    this.ctx = flowCanvas.getContext('2d', { willReadFrequently: true })
    if (this.gl) this.initGeometry(this.gl)

    // Драйвер может отобрать контекст (сон ноутбука, смена GPU) — пересобираемся
    glCanvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      this.programs.clear()
    })
    glCanvas.addEventListener('webglcontextrestored', () => {
      if (this.gl) this.initGeometry(this.gl)
    })

    const parent = glCanvas.parentElement
    if (parent && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize())
      this.resizeObserver.observe(parent)
    }
    this.resize()
  }

  /** WebGL недоступен — шейдерные фоны невозможны, остаётся чёрный экран */
  get supported(): boolean {
    return this.gl !== null
  }

  update(next: BackgroundSettings) {
    const prev = this.settings
    this.settings = next
    if (this.firstUpdate) {
      // Экран только открылся — палитре не из чего перетекать
      this.firstUpdate = false
      this.target = paletteRgb(next.palette)
      this.current = paletteRgb(next.palette)
    } else if (next.palette !== prev.palette) {
      this.target = paletteRgb(next.palette)
    }
    if (next.quality !== prev.quality) this.resize()
    if (next.preset !== prev.preset && findPreset(next.preset).kind === 'particles') {
      this.initParticles()
    }
    this.syncVisibility()
    this.ensureLoop()
  }

  destroy() {
    this.destroyed = true
    cancelAnimationFrame(this.raf)
    this.raf = 0
    this.resizeObserver?.disconnect()
  }

  private get kind() {
    return findPreset(this.settings.preset).kind
  }

  /** Этот фон рисует рендер (а не чёрный экран и не свой файл) */
  private get renders(): boolean {
    return this.kind === 'shader' || this.kind === 'particles'
  }

  private syncVisibility() {
    const kind = this.kind
    this.glCanvas.hidden = kind !== 'shader'
    this.flowCanvas.hidden = kind !== 'particles'
  }

  private ensureLoop() {
    if (this.destroyed) return
    if (!this.renders) {
      cancelAnimationFrame(this.raf)
      this.raf = 0
      // Свой файл контраст меряет сам (MotionBackground), чёрному мерить нечего
      if (this.kind === 'none') this.onContrast?.(null)
      return
    }
    if (!this.raf) {
      this.last = performance.now()
      this.raf = requestAnimationFrame((t) => this.frame(t))
    }
  }

  private resize() {
    const parent = this.glCanvas.parentElement
    if (!parent) return
    const rect = parent.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = Math.max(2, Math.round(rect.width * dpr * this.settings.quality))
    const h = Math.max(2, Math.round(rect.height * dpr * this.settings.quality))
    for (const c of [this.glCanvas, this.flowCanvas]) {
      if (c.width !== w || c.height !== h) {
        c.width = w
        c.height = h
      }
    }
    if (this.kind === 'particles') this.initParticles()
  }

  private initGeometry(gl: WebGLRenderingContext) {
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    // Один треугольник на весь экран — без шва по диагонали
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  }

  private program(id: string): Program | null {
    const gl = this.gl
    if (!gl) return null
    if (this.programs.has(id)) return this.programs.get(id) ?? null
    const scene = sceneSource(id)
    let result: Program | null = null
    if (scene) {
      try {
        result = this.compile(gl, SHADER_HEAD + scene + SHADER_FOOT)
      } catch (e) {
        // Сломанный шейдер не должен ронять экран: остаётся база палитры
        console.error(`background ${id}:`, e)
      }
    }
    this.programs.set(id, result)
    return result
  }

  private compile(gl: WebGLRenderingContext, fragment: string): Program {
    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)
      if (!s) throw new Error('createShader failed')
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s) ?? '')
      return s
    }
    const program = gl.createProgram()
    if (!program) throw new Error('createProgram failed')
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERT))
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment))
    gl.bindAttribLocation(program, 0, 'a')
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(program) ?? '')
    const u = {} as Program['u']
    for (const name of UNIFORMS) u[name] = gl.getUniformLocation(program, name)
    return { program, u }
  }

  private frame(now: number) {
    if (this.destroyed || !this.renders) {
      this.raf = 0
      return
    }
    this.raf = requestAnimationFrame((t) => this.frame(t))
    const dt = Math.min(0.1, (now - this.last) / 1000)
    this.last = now
    this.time += dt * this.settings.speed

    if (now - this.lastDraw < 1000 / this.settings.fps - 2) return
    const frameDt = Math.min(0.1, (now - this.lastDraw) / 1000)
    this.lastDraw = now

    // Палитра перетекает, а не щёлкает
    const k = 1 - Math.exp(-frameDt * 2.8)
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 3; j++) this.current[i][j] += (this.target[i][j] - this.current[i][j]) * k
    }

    const probe = now - this.lastProbe > PROBE_EVERY_MS
    if (probe) this.lastProbe = now
    if (this.kind === 'shader') this.drawShader(probe)
    else this.drawParticles(frameDt, probe)
  }

  private drawShader(probe: boolean) {
    const gl = this.gl
    const prog = this.program(this.settings.preset)
    if (!gl || !prog || gl.isContextLost()) return
    const c = this.current
    gl.useProgram(prog.program)
    gl.viewport(0, 0, this.glCanvas.width, this.glCanvas.height)
    gl.uniform2f(prog.u.uRes, this.glCanvas.width, this.glCanvas.height)
    gl.uniform1f(prog.u.uTime, this.time)
    gl.uniform1f(prog.u.uGrain, this.settings.grain ? 1 : 0)
    gl.uniform1f(prog.u.uVig, this.settings.vignette)
    gl.uniform3fv(prog.u.uBg, c[0])
    gl.uniform3fv(prog.u.uC1, c[1])
    gl.uniform3fv(prog.u.uC2, c[2])
    gl.uniform3fv(prog.u.uC3, c[3])
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    // Буфер кадра читается только сразу после отрисовки, до композитинга
    if (probe) this.probeGl(gl)
  }

  /** Центр экрана, где стоит текст: 70% ширины × 50% высоты */
  private probeRect(w: number, h: number) {
    const pw = Math.max(1, Math.round(w * 0.7))
    const ph = Math.max(1, Math.round(h * 0.5))
    return { x: Math.round((w - pw) / 2), y: Math.round((h - ph) / 2), w: pw, h: ph }
  }

  private probeGl(gl: WebGLRenderingContext) {
    const r = this.probeRect(this.glCanvas.width, this.glCanvas.height)
    const size = r.w * r.h * 4
    if (!this.probeBuf || this.probeBuf.length !== size) this.probeBuf = new Uint8Array(size)
    gl.readPixels(r.x, r.y, r.w, r.h, gl.RGBA, gl.UNSIGNED_BYTE, this.probeBuf)
    this.onContrast?.(contrastOnBackground(this.probeBuf, r.w, r.h, this.settings.dim))
  }

  private initParticles() {
    const w = this.flowCanvas.width
    const h = this.flowCanvas.height
    const n = Math.max(800, Math.min(4000, Math.round((w * h) / 90)))
    this.particles = [[], [], []]
    for (let i = 0; i < n; i++) this.particles[i % 3].push(this.spawn({ x: 0, y: 0, life: 0 }))
    if (this.ctx) {
      this.ctx.fillStyle = '#000'
      this.ctx.fillRect(0, 0, w, h)
    }
  }

  private spawn(p: Particle): Particle {
    p.x = Math.random() * this.flowCanvas.width
    p.y = Math.random() * this.flowCanvas.height
    p.life = 2 + Math.random() * 6
    return p
  }

  private drawParticles(dt: number, probe: boolean) {
    const ctx = this.ctx
    if (!ctx) return
    const w = this.flowCanvas.width
    const h = this.flowCanvas.height
    const rgba = (c: Rgb, gain: number, a: number) =>
      `rgba(${c.map((v) => Math.min(255, Math.round(v * 255 * gain))).join(',')},${a})`

    // Полупрозрачная заливка базой палитры оставляет за частицами шлейф
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = rgba(this.current[0], 1, 0.08)
    ctx.fillRect(0, 0, w, h)
    ctx.globalCompositeOperation = 'lighter'
    const speed = this.settings.speed
    const step = h * 0.0022 * speed * dt * 60
    const size = Math.max(1, h / 320)
    const scale = 1.8 / h
    for (let g = 0; g < 3; g++) {
      ctx.fillStyle = rgba(this.current[g + 1], 1.7, 0.4)
      for (const p of this.particles[g]) {
        const a = valueNoise(p.x * scale, p.y * scale + this.time * 0.04) * Math.PI * 4
        p.x += Math.cos(a) * step
        p.y += Math.sin(a) * step
        p.life -= dt * speed
        if (p.life < 0 || p.x < 0 || p.y < 0 || p.x > w || p.y > h) this.spawn(p)
        ctx.fillRect(p.x, p.y, size, size)
      }
    }
    ctx.globalCompositeOperation = 'source-over'

    if (probe) {
      const r = this.probeRect(w, h)
      const px = ctx.getImageData(r.x, r.y, r.w, r.h).data
      this.onContrast?.(contrastOnBackground(px, r.w, r.h, this.settings.dim))
    }
  }
}
