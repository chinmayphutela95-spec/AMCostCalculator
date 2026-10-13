import type { PartGeometry } from '../../types'

let worker: Worker | null = null
let nextId = 0
const pending = new Map<number, { resolve: (g: PartGeometry) => void; reject: (e: Error) => void }>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./stl.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent) => {
      const { id, ok, result, error } = e.data
      const p = pending.get(id)
      pending.delete(id)
      if (ok) p?.resolve(result)
      else p?.reject(new Error(error))
    }
    worker.onerror = e => {
      // e.g. out of memory on a huge file — fail everything in flight and start fresh next time
      for (const p of pending.values()) p.reject(new Error(e.message || 'Geometry analysis failed'))
      pending.clear()
      worker?.terminate()
      worker = null
    }
  }
  return worker
}

/** Analyse an STL in the browser (Web Worker). Same result shape the backend used to return. */
export function analyzeStl(file: File, buildDirection: string, overhangAngle = 45, fillDensity = 0.3): Promise<PartGeometry> {
  return new Promise((resolve, reject) => {
    const id = ++nextId
    pending.set(id, { resolve, reject })
    getWorker().postMessage({ id, file, direction: buildDirection, angle: overhangAngle, density: fillDensity })
  })
}
