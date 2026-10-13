// Parses and analyses STL files off the main thread. The parsed mesh of the most
// recent file is kept, so re-analysing with a new orientation, overhang angle or
// support density skips the expensive parse.
import { analyzeMesh, buildMeshData, parseStl, type MeshData } from './analyzeMesh'

export interface AnalyzeRequest {
  id: number
  file: File
  direction: string
  angle: number
  density: number
}

let cached: { key: string; mesh: MeshData } | null = null
// Typed for the worker scope (the project compiles against the DOM lib, where self is a Window)
const reply = (msg: unknown) => (self as unknown as { postMessage(m: unknown): void }).postMessage(msg)

self.onmessage = async (e: MessageEvent<AnalyzeRequest>) => {
  const { id, file, direction, angle, density } = e.data
  try {
    const key = `${file.name}|${file.size}|${file.lastModified}`
    if (cached?.key !== key) {
      cached = null   // release the previous mesh before parsing the next one
      cached = { key, mesh: buildMeshData(parseStl(await file.arrayBuffer())) }
    }
    const result = analyzeMesh(cached.mesh, direction, angle, density)
    reply({ id, ok: true, result: { ...result, file_name: file.name } })
  } catch (err) {
    reply({ id, ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
