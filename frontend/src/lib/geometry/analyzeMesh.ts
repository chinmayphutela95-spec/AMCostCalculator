/**
 * STL geometry analysis — a TypeScript port of the former backend
 * geometry_parser.py (parse_stl + estimate_support_volume), run in the browser
 * so part files never have to be uploaded.
 *
 * Numbers match the Python version, including its support estimate: each
 * overhang face gets a column straight down to the build plate. (The Python
 * code also attempted a ray-cast refinement, but it needed the optional
 * `rtree` package, so in practice it always used the build-plate distance.)
 */
import type { PartGeometry } from '../../types'

/** Vertex coordinates, 9 per triangle (non-indexed, as stored in STL). Binary STLs are
 *  float32; ASCII coordinates are kept as float64, as trimesh does. */
export type Positions = Float32Array | Float64Array

/** Per-mesh data that doesn't depend on build direction — computed once per file. */
export interface MeshData {
  positions: Positions
  faceCount: number
  normals: Float64Array        // unit face normals from winding (zero for degenerate faces); float64 so
                               // faces exactly at the overhang threshold classify as in Python
  areas: Float64Array          // face areas, mm²
  volumeMm3: number            // |signed volume|
  surfaceAreaMm2: number
  min: [number, number, number]
  max: [number, number, number]
  vertexCount: number | null   // unique vertices; null when skipped for very large meshes
  isWatertight: boolean | null // every edge shared by exactly two faces
}

// Unique-vertex / edge hashing costs memory proportional to the mesh; skip it beyond this
const TOPOLOGY_FACE_LIMIT = 4_000_000   // ≈ 200 MB binary STL

// ── STL parsing ───────────────────────────────────────────────────────────────

export function parseStl(buffer: ArrayBuffer): Positions {
  const view = new DataView(buffer)
  if (buffer.byteLength >= 84) {
    const n = view.getUint32(80, true)
    if (84 + n * 50 === buffer.byteLength) return parseBinary(view, n)
  }
  const head = new TextDecoder().decode(new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 256)))
  if (/^\s*solid/i.test(head)) return parseAscii(new TextDecoder().decode(buffer))
  throw new Error('Not a valid STL file (unexpected size for binary STL, and not ASCII).')
}

function parseBinary(view: DataView, n: number): Float32Array {
  const out = new Float32Array(n * 9)
  for (let i = 0; i < n; i++) {
    const base = 84 + i * 50 + 12   // skip the stored normal; recompute from winding
    for (let k = 0; k < 9; k++) out[i * 9 + k] = view.getFloat32(base + k * 4, true)
  }
  return out
}

function parseAscii(text: string): Float64Array {
  const re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/g
  const values: number[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) values.push(+m[1], +m[2], +m[3])
  const usable = values.length - (values.length % 9)
  if (usable === 0) throw new Error('STL file contains no triangles.')
  return Float64Array.from(values.slice(0, usable))
}

// ── Direction-independent mesh data ───────────────────────────────────────────

export function buildMeshData(positions: Positions): MeshData {
  const faceCount = positions.length / 9
  if (faceCount === 0) throw new Error('Mesh has no geometry (0 vertices or faces).')

  const normals = new Float64Array(faceCount * 3)
  const areas = new Float64Array(faceCount)
  let signedVolume6 = 0
  let surface = 0
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]

  for (let f = 0; f < faceCount; f++) {
    const o = f * 9
    const ax = positions[o], ay = positions[o + 1], az = positions[o + 2]
    const bx = positions[o + 3], by = positions[o + 4], bz = positions[o + 5]
    const cx = positions[o + 6], cy = positions[o + 7], cz = positions[o + 8]

    for (let v = 0; v < 9; v += 3) {
      for (let k = 0; k < 3; k++) {
        const p = positions[o + v + k]
        if (p < min[k]) min[k] = p
        if (p > max[k]) max[k] = p
      }
    }

    // Signed tetrahedron volume (×6) against the origin: a · (b × c)
    signedVolume6 += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)

    // Same operations, in the same order, as trimesh (edges b−a and c−b; scale by 1/|n|),
    // so faces lying exactly on the overhang threshold classify identically
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az
    const e2x = cx - bx, e2y = cy - by, e2z = cz - bz
    const nx = e1y * e2z - e1z * e2y
    const ny = e1z * e2x - e1x * e2z
    const nz = e1x * e2y - e1y * e2x
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
    areas[f] = len / 2
    surface += len / 2
    if (len > 1e-13) {
      const inv = 1 / len
      normals[f * 3] = nx * inv
      normals[f * 3 + 1] = ny * inv
      normals[f * 3 + 2] = nz * inv
    }
  }

  const topology = faceCount <= TOPOLOGY_FACE_LIMIT ? meshTopology(positions, faceCount) : null

  return {
    positions, faceCount, normals, areas,
    volumeMm3: Math.abs(signedVolume6 / 6),
    surfaceAreaMm2: surface,
    min, max,
    vertexCount: topology?.vertexCount ?? null,
    isWatertight: topology?.isWatertight ?? null,
  }
}

// ── Unique vertices and watertightness (open-addressing hash tables) ──────────

function mix(h: number, k: number): number {
  h = Math.imul(h ^ k, 0x85ebca6b)
  return Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
}

function meshTopology(positions: Positions, faceCount: number) {
  // Vertex identity = exact coordinate values (−0 equals +0); hashed from their bit patterns
  const words = positions.BYTES_PER_ELEMENT / 4
  const bits = new Uint32Array(positions.buffer, positions.byteOffset, positions.length * words)
  const hashVertex = (p: number) => {
    let h = 0x9e3779b9
    for (let i = p * 3; i < p * 3 + 3; i++) {
      if (positions[i] === 0) { h = mix(h, 0); continue }
      for (let w = 0; w < words; w++) h = mix(h, bits[i * words + w])
    }
    return h >>> 0
  }
  const sameVertex = (p: number, q: number) =>
    positions[p * 3] === positions[q * 3] &&
    positions[p * 3 + 1] === positions[q * 3 + 1] &&
    positions[p * 3 + 2] === positions[q * 3 + 2]

  let cap = 1 << 16
  while (cap < faceCount) cap <<= 1          // closed meshes have ~F/2 vertices
  let slots = new Int32Array(cap).fill(-1)   // → index of first occurrence in positions/3
  let used = 0
  const vertexId = new Uint32Array(faceCount * 3)
  const uniqueAt: number[] = []              // position index of each unique vertex

  const insert = (p: number, table: Int32Array, mask: number): number => {
    let h = hashVertex(p) & mask
    for (;;) {
      const s = table[h]
      if (s === -1) return ~h
      if (sameVertex(s, p)) return s
      h = (h + 1) & mask
    }
  }

  for (let p = 0; p < faceCount * 3; p++) {
    if (used * 2 > cap) {          // grow at 50% load
      cap <<= 1
      slots = new Int32Array(cap).fill(-1)
      for (const q of uniqueAt) slots[~insert(q, slots, cap - 1)] = q
    }
    const r = insert(p, slots, cap - 1)
    if (r < 0) {
      slots[~r] = p
      vertexId[p] = uniqueAt.length
      uniqueAt.push(p)
      used++
    } else {
      vertexId[p] = vertexId[r]
    }
  }

  // Count each undirected edge; watertight ⇔ every edge appears exactly twice
  let ecap = 1 << 16
  while (ecap < faceCount * 4) ecap <<= 1   // ≤ 75% load even if no edges are shared
  const ea = new Uint32Array(ecap), eb = new Uint32Array(ecap), count = new Uint8Array(ecap)
  const emask = ecap - 1
  let watertight = true
  for (let f = 0; f < faceCount && watertight; f++) {
    for (let e = 0; e < 3; e++) {
      const u = vertexId[f * 3 + e], v = vertexId[f * 3 + ((e + 1) % 3)]
      const a = Math.min(u, v), b = Math.max(u, v)
      let h = (mix(mix(0x9e3779b9, a), b) >>> 0) & emask
      while (count[h] !== 0 && (ea[h] !== a || eb[h] !== b)) h = (h + 1) & emask
      if (count[h] === 0) { ea[h] = a; eb[h] = b }
      if (++count[h] > 2) { watertight = false; break }
    }
  }
  if (watertight) {
    for (let h = 0; h < ecap; h++) if (count[h] === 1) { watertight = false; break }
  }

  return { vertexCount: uniqueAt.length, isWatertight: watertight }
}

// ── Build direction ───────────────────────────────────────────────────────────

/** 'x' | '-z' | 'custom:nx,ny,nz' → unit build vector and its axis (null if not axis-aligned). */
export function parseBuildVec(direction: string): { vec: [number, number, number]; axis: number | null } {
  const d = direction.trim().toLowerCase()
  const presets: Record<string, { vec: [number, number, number]; axis: number }> = {
    x: { vec: [1, 0, 0], axis: 0 }, y: { vec: [0, 1, 0], axis: 1 }, z: { vec: [0, 0, 1], axis: 2 },
    '-x': { vec: [-1, 0, 0], axis: 0 }, '-y': { vec: [0, -1, 0], axis: 1 }, '-z': { vec: [0, 0, -1], axis: 2 },
  }
  if (presets[d]) return presets[d]
  if (d.startsWith('custom:')) {
    const parts = d.slice(7).split(',').slice(0, 3).map(Number)
    if (parts.length === 3 && parts.every(Number.isFinite)) {
      const n = Math.hypot(parts[0], parts[1], parts[2])
      if (n > 1e-6) return { vec: [parts[0] / n, parts[1] / n, parts[2] / n], axis: null }
    }
  }
  return presets.z
}

// ── Per-orientation analysis ──────────────────────────────────────────────────

const round = (v: number, d = 4) => Math.round(v * 10 ** d) / 10 ** d

export function analyzeMesh(
  mesh: MeshData,
  buildDirection: string,
  overhangAngleDeg = 45,
  fillDensity = 0.3,
): PartGeometry {
  const { positions, faceCount, normals, areas } = mesh
  const { vec: b, axis } = parseBuildVec(buildDirection)
  const extents = [0, 1, 2].map(k => mesh.max[k] - mesh.min[k])
  const volumeCm3 = mesh.volumeMm3 / 1000

  // Height along the build direction
  let minProj = Infinity, maxProj = -Infinity
  for (let i = 0; i < positions.length; i += 3) {
    const p = positions[i] * b[0] + positions[i + 1] * b[1] + positions[i + 2] * b[2]
    if (p < minProj) minProj = p
    if (p > maxProj) maxProj = p
  }

  // Projected area perpendicular to the build direction (bounding rectangle)
  let projectedAreaCm2: number
  if (axis !== null) {
    const [a1, a2] = [0, 1, 2].filter(k => k !== axis)
    projectedAreaCm2 = (extents[a1] * extents[a2]) / 100
  } else {
    const ref = Math.abs(b[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]
    let p1 = [b[1] * ref[2] - b[2] * ref[1], b[2] * ref[0] - b[0] * ref[2], b[0] * ref[1] - b[1] * ref[0]]
    const n1 = Math.hypot(p1[0], p1[1], p1[2])
    p1 = p1.map(v => v / n1)
    const p2 = [b[1] * p1[2] - b[2] * p1[1], b[2] * p1[0] - b[0] * p1[2], b[0] * p1[1] - b[1] * p1[0]]
    let lo1 = Infinity, hi1 = -Infinity, lo2 = Infinity, hi2 = -Infinity
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i], y = positions[i + 1], z = positions[i + 2]
      const q1 = x * p1[0] + y * p1[1] + z * p1[2]
      const q2 = x * p2[0] + y * p2[1] + z * p2[2]
      if (q1 < lo1) lo1 = q1
      if (q1 > hi1) hi1 = q1
      if (q2 < lo2) lo2 = q2
      if (q2 > hi2) hi2 = q2
    }
    projectedAreaCm2 = ((hi1 - lo1) * (hi2 - lo2)) / 100
  }

  // Support: overhang faces (normal · build < −cos α) each project a column down to the plate
  const threshold = -Math.cos(overhangAngleDeg * (Math.PI / 180))   // same rounding as math.radians
  let overhangAreaMm2 = 0
  let supportMm3 = 0
  for (let f = 0; f < faceCount; f++) {
    const dot = normals[f * 3] * b[0] + normals[f * 3 + 1] * b[1] + normals[f * 3 + 2] * b[2]
    if (!(dot < threshold)) continue
    overhangAreaMm2 += areas[f]
    const o = f * 9
    const centroidProj = (
      (positions[o] + positions[o + 3] + positions[o + 6]) * b[0] +
      (positions[o + 1] + positions[o + 4] + positions[o + 7]) * b[1] +
      (positions[o + 2] + positions[o + 5] + positions[o + 8]) * b[2]
    ) / 3
    const height = Math.max(centroidProj - minProj, 0)
    supportMm3 += areas[f] * Math.abs(dot) * height
  }
  const supportCm3 = (supportMm3 * fillDensity) / 1000
  const volForPct = volumeCm3 > 0 ? volumeCm3 : 1e-9
  const supportPct = Math.min((supportCm3 / volForPct) * 100, 100)

  const bboxVolCm3 = (extents[0] * extents[1] * extents[2]) / 1000
  const relativeDensity = bboxVolCm3 > 0 ? volumeCm3 / bboxVolCm3 : 1

  return {
    success: true,
    volume_cm3: round(volumeCm3),
    height_cm: round((maxProj - minProj) / 10),
    projected_area_cm2: round(projectedAreaCm2),
    surface_area_cm2: round(mesh.surfaceAreaMm2 / 100),
    bounding_box_mm: { x: round(extents[0], 2), y: round(extents[1], 2), z: round(extents[2], 2) },
    relative_density: round(Math.min(relativeDensity, 1)),
    support_volume_cm3: round(supportCm3),
    support_area_cm2: round(overhangAreaMm2 / 100),
    estimated_support_pct: round(supportPct),
    face_count: faceCount,
    vertex_count: mesh.vertexCount,
    build_direction: buildDirection,
    is_watertight: mesh.isWatertight,
  }
}
