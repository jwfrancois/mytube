/**
 * Shared Audio Context Module
 *
 * Manages a single AudioContext + MediaElementAudioSourceNode per audio element
 * so that both AudioVisualizer and SoundSettings share the same Web Audio graph.
 *
 * Audio graph: source → filter0 → ... → filter4 → analyser → destination
 *
 * This prevents the "double playback / echo" bug caused by two separate
 * AudioContext instances calling createMediaElementSource() on the same
 * <audio> element.
 */

const EQ_FREQUENCIES = [60, 230, 910, 4000, 14000]

interface SharedAudioEntry {
  ctx: AudioContext
  source: MediaElementAudioSourceNode
  analyser: AnalyserNode
  filters: BiquadFilterNode[]
}

export interface SharedAudioContextResult {
  ctx: AudioContext
  source: MediaElementAudioSourceNode
  analyser: AnalyserNode
  filters: BiquadFilterNode[]
  /** Update EQ band gains on the shared filter chain */
  setEqBands: (bands: number[]) => void
}

// WeakMap ensures one entry per audio element and auto-cleanup when the element is GC'd
const sharedContextMap = new WeakMap<HTMLAudioElement | HTMLVideoElement, SharedAudioEntry>()

/**
 * Get or create the shared AudioContext for an element.
 * The graph is: source → filters (EQ chain) → analyser → destination
 *
 * This is the ONLY place createMediaElementSource() is called.
 */
export function getSharedAudioContext(el: HTMLAudioElement | HTMLVideoElement): SharedAudioContextResult {
  const existing = sharedContextMap.get(el)
  if (existing) {
    return {
      ...existing,
      setEqBands: (bands: number[]) => applyEqBands(existing.filters, bands),
    }
  }

  const ctx = new AudioContext()

  // Create EQ filter chain
  const filters = EQ_FREQUENCIES.map((freq, i) => {
    const filter = ctx.createBiquadFilter()
    if (i === 0) {
      filter.type = 'lowshelf'
    } else if (i === EQ_FREQUENCIES.length - 1) {
      filter.type = 'highshelf'
    } else {
      filter.type = 'peaking'
    }
    filter.frequency.value = freq
    filter.Q.value = 1
    filter.gain.value = 0 // flat by default
    return filter
  })

  // Create analyser
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 256
  analyser.smoothingTimeConstant = 0.8

  // Create source — THIS is the critical single-call point
  const source = ctx.createMediaElementSource(el)

  // Connect the graph: source → filter0 → ... → filterN → analyser → destination
  let lastNode: AudioNode = source
  for (const filter of filters) {
    lastNode.connect(filter)
    lastNode = filter
  }
  lastNode.connect(analyser)
  analyser.connect(ctx.destination)

  const entry: SharedAudioEntry = { ctx, source, analyser, filters }
  sharedContextMap.set(el, entry)

  return {
    ...entry,
    setEqBands: (bands: number[]) => applyEqBands(filters, bands),
  }
}

/**
 * Apply EQ band gains to the given filter chain.
 */
function applyEqBands(filters: BiquadFilterNode[], bands: number[]): void {
  filters.forEach((filter, i) => {
    if (i < bands.length) {
      filter.gain.value = bands[i]
    }
  })
}

/**
 * Resume the AudioContext (needed after a user gesture in most browsers).
 */
export function resumeAudioContext(el: HTMLAudioElement | HTMLVideoElement): void {
  const entry = sharedContextMap.get(el)
  if (entry && entry.ctx.state === 'suspended') {
    entry.ctx.resume()
  }
}

/**
 * Clean up the shared context for an element.
 * Disconnects all nodes and closes the AudioContext.
 */
export function cleanupAudioContext(el: HTMLAudioElement | HTMLVideoElement): void {
  const entry = sharedContextMap.get(el)
  if (!entry) return

  try {
    entry.source.disconnect()
    for (const filter of entry.filters) {
      filter.disconnect()
    }
    entry.analyser.disconnect()
    entry.ctx.close()
  } catch {
    // Ignore errors during cleanup
  }

  sharedContextMap.delete(el)
}

/**
 * Check if Web Audio API is supported in this browser.
 */
export function isWebAudioSupported(): boolean {
  try {
    return typeof AudioContext !== 'undefined' || typeof (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext !== 'undefined'
  } catch {
    return false
  }
}
