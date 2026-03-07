import { useCallback, useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, File as FileIcon, RotateCcw, Info, ChevronRight, Loader2, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, Html } from '@react-three/drei'
// @ts-ignore
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import * as THREE from 'three'
import { geometryApi } from '../../../lib/api'
import type { AnalysisState } from '../../../types'

// ─── Three.js scene components ────────────────────────────────────────────────

function OverhangMesh({ geometry, buildAxis, overhangAngle, elevationMm }: {
  geometry: THREE.BufferGeometry
  buildAxis: number
  overhangAngle: number
  elevationMm: number
}) {
  const coloredGeo = useMemo(() => {
    const geo = geometry.clone()
    const normals = geo.attributes.normal as THREE.BufferAttribute
    const pos = geo.attributes.position as THREE.BufferAttribute
    const count = geo.attributes.position.count
    const colors = new Float32Array(count * 3)

    const buildVec = [0, 0, 0]
    buildVec[buildAxis] = 1.0
    // Angle is measured from horizontal; face needs support when its normal · up < -sin(angle)
    const threshold = -Math.sin((overhangAngle * Math.PI) / 180)

    // When sitting directly on the plate, the bottom face is supported — exclude it
    geo.computeBoundingBox()
    const minY = geo.boundingBox!.min.y
    const eps = (geo.boundingBox!.max.y - minY) * 0.005

    for (let i = 0; i < count; i += 3) {
      const nx = normals.getX(i)
      const ny = normals.getY(i)
      const nz = normals.getZ(i)
      const dot = nx * buildVec[0] + ny * buildVec[1] + nz * buildVec[2]
      let isOverhang = dot < threshold
      // Bottom face touching the plate is plate-supported, not an overhang
      if (isOverhang && elevationMm === 0) {
        const y0 = pos.getY(i), y1 = pos.getY(i + 1), y2 = pos.getY(i + 2)
        if (Math.min(y0, y1, y2) <= minY + eps) isOverhang = false
      }
      const [r, g, b] = isOverhang ? [1.0, 0.3, 0.05] : [0.22, 0.52, 0.95]
      for (let v = 0; v < 3; v++) {
        colors[(i + v) * 3 + 0] = r
        colors[(i + v) * 3 + 1] = g
        colors[(i + v) * 3 + 2] = b
      }
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
  }, [geometry, buildAxis, overhangAngle, elevationMm])

  return (
    <mesh geometry={coloredGeo} castShadow>
      <meshStandardMaterial vertexColors metalness={0.35} roughness={0.45} />
    </mesh>
  )
}

/** Cyan wireframe bounding box with dimension labels */
function BoundingBoxWire({ geometry }: { geometry: THREE.BufferGeometry }) {
  const { center, size, min, max } = useMemo(() => {
    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    const c = new THREE.Vector3(); box.getCenter(c)
    const s = new THREE.Vector3(); box.getSize(s)
    return { center: c, size: s, min: box.min.clone(), max: box.max.clone() }
  }, [geometry])

  const labelStyle: React.CSSProperties = {
    color: '#06b6d4',
    fontSize: '11px',
    whiteSpace: 'nowrap',
    background: 'rgba(6,18,40,0.82)',
    padding: '2px 6px',
    borderRadius: 3,
    border: '1px solid rgba(6,182,212,0.35)',
    fontFamily: 'monospace',
    pointerEvents: 'none',
    userSelect: 'none',
  }

  return (
    <>
      <mesh position={center}>
        <boxGeometry args={[size.x, size.y, size.z]} />
        <meshBasicMaterial color="#06b6d4" wireframe />
      </mesh>

      {/* X dimension — bottom-front edge center */}
      <Html position={[center.x, min.y - size.y * 0.08, max.z + size.z * 0.08]} center>
        <div style={labelStyle}>X {size.x.toFixed(1)} mm</div>
      </Html>

      {/* Y dimension — right-front edge center */}
      <Html position={[max.x + size.x * 0.08, center.y, max.z + size.z * 0.08]} center>
        <div style={labelStyle}>Y {size.y.toFixed(1)} mm</div>
      </Html>

      {/* Z dimension — right-bottom edge center */}
      <Html position={[max.x + size.x * 0.08, min.y - size.y * 0.08, center.z]} center>
        <div style={labelStyle}>Z {size.z.toFixed(1)} mm</div>
      </Html>
    </>
  )
}

/** Build plate + elevation gap visual */
function BuildPlatform({ geometry, elevationMm }: { geometry: THREE.BufferGeometry; elevationMm: number }) {
  const { partBottomY, size, centerX, centerZ } = useMemo(() => {
    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    const s = new THREE.Vector3(); box.getSize(s)
    const c = new THREE.Vector3(); box.getCenter(c)
    return { partBottomY: box.min.y, size: s, centerX: c.x, centerZ: c.z }
  }, [geometry])

  const plateY = partBottomY - elevationMm
  const plateH = Math.max(size.x, size.z) * 0.012  // thin slab
  const plateSize = Math.max(size.x, size.z) * 2.4
  const cellSize = Math.max(size.x, size.z) * 0.12
  const sectionSize = Math.max(size.x, size.z) * 0.6

  const labelStyle: React.CSSProperties = {
    color: '#f59e0b',
    fontSize: '10px',
    whiteSpace: 'nowrap',
    background: 'rgba(6,18,40,0.88)',
    padding: '2px 6px',
    borderRadius: 3,
    border: '1px solid rgba(245,158,11,0.4)',
    fontFamily: 'monospace',
    pointerEvents: 'none',
    userSelect: 'none',
  }

  return (
    <>
      {/* Build plate: translucent thin slab for depth cue */}
      <mesh position={[centerX, plateY - plateH / 2, centerZ]}>
        <boxGeometry args={[plateSize, plateH, plateSize]} />
        <meshStandardMaterial
          color="#1b3a6e"
          metalness={0.5}
          roughness={0.4}
          opacity={0.18}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Build plate: grid surface — visible from top and bottom */}
      <Grid
        args={[plateSize, plateSize]}
        position={[centerX, plateY, centerZ]}
        cellSize={cellSize}
        cellThickness={0.6}
        cellColor="#2a4a7a"
        sectionSize={sectionSize}
        sectionThickness={1.2}
        sectionColor="#4a80cc"
        fadeDistance={plateSize}
        fadeStrength={1.5}
      />
      {/* Elevation gap: amber support-pillar volume */}
      {elevationMm > 1 && (
        <>
          <mesh position={[centerX, plateY + elevationMm / 2, centerZ]}>
            <boxGeometry args={[size.x * 0.88, elevationMm, size.z * 0.88]} />
            <meshStandardMaterial color="#f59e0b" opacity={0.13} transparent depthWrite={false} />
          </mesh>
          <Html position={[centerX + size.x * 0.62, plateY + elevationMm / 2, centerZ]} center>
            <div style={labelStyle}>↕ {elevationMm.toFixed(0)} mm</div>
          </Html>
        </>
      )}
    </>
  )
}

/** Positions and orients camera based on mesh + build axis + elevation; resets on change */
function AutoCamera({ geometry, buildAxis, elevationMm }: { geometry: THREE.BufferGeometry; buildAxis: number; elevationMm: number }) {
  const { camera, controls } = useThree()

  useEffect(() => {
    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    const size = new THREE.Vector3(); box.getSize(size)
    const center = new THREE.Vector3(); box.getCenter(center)

    // Shift center down so camera frames both part and elevated platform
    center.y -= elevationMm / 2
    const totalHeight = size.y + elevationMm
    const maxDim = Math.max(size.x, size.z, totalHeight)
    const dist = maxDim * 2.5

    const positions: [number, number, number][] = [
      [center.x + dist, center.y + dist * 0.3, center.z + dist * 0.5],
      [center.x + dist * 0.4, center.y + dist, center.z + dist * 0.4],
      [center.x + dist * 0.7, center.y + dist * 0.5, center.z + dist],
    ]
    const [px, py, pz] = positions[buildAxis] ?? positions[2]

    camera.position.set(px, py, pz)
    camera.lookAt(center)
    camera.updateProjectionMatrix()

    const ctrl = controls as any
    if (ctrl?.target) {
      ctrl.target.set(center.x, center.y, center.z)
      ctrl.update?.()
    }
  }, [geometry, buildAxis, elevationMm, camera, controls])

  return null
}

function StlScene({ geometry, overhangAngle, elevationMm }: {
  geometry: THREE.BufferGeometry
  overhangAngle: number
  elevationMm: number
}) {
  const { platformY, gridSize } = useMemo(() => {
    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    const s = new THREE.Vector3(); box.getSize(s)
    const plateH = Math.max(s.x, s.z) * 0.035
    return {
      platformY: (box.min.y ?? 0) - elevationMm - plateH,
      gridSize: Math.max(s.x, s.y, s.z, elevationMm) * 4,
    }
  }, [geometry, elevationMm])

  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[15, 25, 10]} intensity={1.2} castShadow />
      <directionalLight position={[-10, -5, -15]} intensity={0.25} />
      <AutoCamera geometry={geometry} buildAxis={1} elevationMm={elevationMm} />
      <OverhangMesh geometry={geometry} buildAxis={1} overhangAngle={overhangAngle} elevationMm={elevationMm} />
      <BoundingBoxWire geometry={geometry} />
      <BuildPlatform geometry={geometry} elevationMm={elevationMm} />
      <Grid
        args={[gridSize, gridSize]}
        position={[0, platformY, 0]}
        cellColor="#1e2a45"
        sectionColor="#2d3142"
        fadeDistance={gridSize * 1.5}
        infiniteGrid
      />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
    </>
  )
}

// ─── Client-side overhang area fraction (0–100%) ─────────────────────────────

function calcOverhangAreaPct(
  geo: THREE.BufferGeometry,
  buildAxis: number,
  overhangAngle: number,
  elevationMm = 0,
): number {
  const normals = geo.attributes.normal as THREE.BufferAttribute
  const pos = geo.attributes.position as THREE.BufferAttribute
  const count = pos.count
  const buildVec = [0, 0, 0]
  buildVec[buildAxis] = 1.0
  // Angle is measured from horizontal; face needs support when its normal · up < -sin(angle)
  const threshold = -Math.sin((overhangAngle * Math.PI) / 180)

  geo.computeBoundingBox()
  const minY = geo.boundingBox!.min.y
  const eps = (geo.boundingBox!.max.y - minY) * 0.005

  let overhangArea = 0, totalArea = 0
  const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3()

  for (let i = 0; i < count; i += 3) {
    v0.fromBufferAttribute(pos, i)
    v1.fromBufferAttribute(pos, i + 1)
    v2.fromBufferAttribute(pos, i + 2)
    const area = v1.clone().sub(v0).cross(v2.clone().sub(v0)).length() * 0.5

    const dot = normals.getX(i) * buildVec[0] + normals.getY(i) * buildVec[1] + normals.getZ(i) * buildVec[2]
    totalArea += area
    if (dot < threshold) {
      // Exclude the plate-contact face when elevation = 0 (it's supported by the plate)
      if (elevationMm === 0 && Math.min(v0.y, v1.y, v2.y) <= minY + eps) continue
      overhangArea += area
    }
  }

  return totalArea === 0 ? 0 : (overhangArea / totalArea) * 100
}

// ─── Main PartStep ────────────────────────────────────────────────────────────

interface Props {
  state: AnalysisState
  update: (p: Partial<AnalysisState>) => void
  onNext: () => void
}

const AXIS_MAP = { x: 0, y: 1, z: 2 } as const

export function PartStep({ state, update, onNext }: Props) {
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  const [threeGeo, setThreeGeo] = useState<THREE.BufferGeometry | null>(null)
  const [overhangAngle, setOverhangAngle] = useState(45)
  const [showSupportInfo, setShowSupportInfo] = useState(false)

  const fileRef = useRef<File | null>(null)
  const loaderRef = useRef(new STLLoader())
  // Server's estimated_support_pct (0–100) — source of truth for initial value
  const serverPctRef = useRef(0)

  // ── Server parse ──────────────────────────────────────────────────────────
  const parseOnServer = useCallback(async (file: File, direction: string) => {
    setParsing(true)
    setParseError('')
    try {
      const result = await geometryApi.parse(file, direction)
      if (!result.success) { setParseError(result.error || 'Failed to parse'); return }
      serverPctRef.current = result.estimated_support_pct
      update({
        geometry: result,
        partFileName: result.file_name ?? file.name,
        partFilePath: result.file_path,
        partVolume: result.volume_cm3,
        partHeight: result.height_cm,
        partProjectedArea: result.projected_area_cm2,
        // Use server value directly — slider will scale from this baseline
        supportPctOfMass: Math.min(result.estimated_support_pct / 100, 0.5),
      })
    } catch (e: any) {
      setParseError(e.message || 'Parse error')
    } finally {
      setParsing(false)
    }
  }, [update])

  // ── Load geometry into Three.js viewer ────────────────────────────────────
  // Pre-rotate so the chosen build axis always points up (screen Y).
  // After this rotation all downstream components (plate, overhang, camera)
  // can unconditionally treat Y as the build direction.
  const loadViewer = useCallback((file: File, axis: number) => {
    const url = URL.createObjectURL(file)
    loaderRef.current.load(url, (geo: THREE.BufferGeometry) => {
      geo.computeVertexNormals()
      geo.center()
      if (axis === 0) {
        // X up → rotate -90° around Z so model +X becomes screen +Y
        geo.applyMatrix4(new THREE.Matrix4().makeRotationZ(-Math.PI / 2))
      } else if (axis === 2) {
        // Z up → rotate +90° around X so model +Z becomes screen +Y
        geo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2))
      }
      // Y up → no rotation needed (screen Y = model Y already)
      geo.computeVertexNormals()
      geo.computeBoundingBox()
      setThreeGeo(geo)
      URL.revokeObjectURL(url)
    })
  }, [])

  // ── On file drop ──────────────────────────────────────────────────────────
  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    fileRef.current = file
    loadViewer(file, AXIS_MAP[state.buildDirection])
    await parseOnServer(file, state.buildDirection)
  }, [state.buildDirection, parseOnServer, loadViewer])

  // ── Auto re-parse + re-orient viewer when build direction changes ──────────
  useEffect(() => {
    if (fileRef.current && state.partFileName) {
      parseOnServer(fileRef.current, state.buildDirection)
      loadViewer(fileRef.current, AXIS_MAP[state.buildDirection])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.buildDirection])

  // ── Shared support recalc: overhang (angle-scaled) + elevation pillars ──
  // Geometry is pre-rotated so overhang always uses axis=1 (Y).
  // Elevation contribution is computed even without a loaded STL.
  const recomputeSupport = useCallback((angle: number, elevMm: number) => {
    if (state.partVolume <= 0 || state.partProjectedArea <= 0) return
    let scaledOverhangPct = serverPctRef.current
    if (threeGeo) {
      const base = calcOverhangAreaPct(threeGeo, 1, 45, elevMm)
      if (base > 0) {
        const clientAtAngle = calcOverhangAreaPct(threeGeo, 1, angle, elevMm)
        scaledOverhangPct = serverPctRef.current * (clientAtAngle / base)
      }
    }
    // Elevation pillars: projected_area (cm²) × elevation (cm) / part_volume (cm³)
    const elevSupportPct = (state.partProjectedArea * (elevMm / 10)) / state.partVolume * 100
    update({ supportPctOfMass: Math.min((scaledOverhangPct + elevSupportPct) / 100, 0.80) })
  }, [threeGeo, state.partVolume, state.partProjectedArea, update])

  const handleAngleChange = useCallback((angle: number) => {
    setOverhangAngle(angle)
    recomputeSupport(angle, state.elevationMm ?? 0)
  }, [recomputeSupport, state.elevationMm])

  const handleElevationChange = useCallback((elevMm: number) => {
    const clamped = Math.max(0, elevMm)
    update({ elevationMm: clamped })
    recomputeSupport(overhangAngle, clamped)
  }, [recomputeSupport, overhangAngle, update])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/octet-stream': ['.stl'], 'model/stl': ['.stl'] },
    maxFiles: 1,
  })

  const canProceed = state.partVolume > 0 && state.partHeight > 0 && state.partProjectedArea > 0

  return (
    <div className="space-y-5">

      {/* ── Top row: upload + viewer ── */}
      <div className="grid grid-cols-2 gap-6">

        {/* Left column */}
        <div className="space-y-4">

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-accent-blue bg-accent-blue/5' : 'border-bg-border hover:border-accent-blue/50'
            }`}
          >
            <input {...getInputProps()} />
            {parsing ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 size={28} className="text-accent-blue animate-spin" />
                <p className="text-text-secondary text-sm">Parsing geometry…</p>
              </div>
            ) : state.partFileName ? (
              <div className="flex flex-col items-center gap-1">
                <FileIcon size={24} className="text-accent-blue" />
                <p className="text-text-primary font-medium text-sm">{state.partFileName}</p>
                <p className="text-text-muted text-xs">Drop a new file to replace</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload size={28} className="text-text-muted" />
                <p className="text-text-primary text-sm font-medium">Drop STL file here</p>
                <p className="text-text-muted text-xs">or click to browse · .stl supported</p>
                <div className="mt-2 pt-2 border-t border-bg-border/40 w-full">
                  <p className="text-text-muted text-xs">
                    No STL? <span className="text-accent-cyan font-medium">Enter parameters manually below ↓</span>
                  </p>
                </div>
              </div>
            )}
          </div>
          {parseError && (
            <p className="text-danger text-sm flex items-center gap-1">
              <Info size={13} />{parseError}
            </p>
          )}

          {/* Build direction */}
          <div>
            <label className="label">Build Direction — which axis points up during printing</label>
            <div className="flex gap-2">
              {(['x', 'y', 'z'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => update({ buildDirection: d })}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-mono font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                    state.buildDirection === d
                      ? 'bg-accent-blue/10 border-accent-blue text-accent-blue'
                      : 'border-bg-border text-text-secondary hover:border-accent-blue/40'
                  }`}
                >
                  {d.toUpperCase()} up
                  {parsing && state.buildDirection === d && <Loader2 size={11} className="animate-spin" />}
                </button>
              ))}
            </div>
            {state.partFileName && (
              <p className="text-text-muted text-xs mt-1.5 flex items-center gap-1">
                <Info size={11} /> Changing orientation auto-refreshes geometry, viewer, and support estimate
              </p>
            )}
          </div>

          {/* Elevation above build plate */}
          <div>
            <label className="label">Elevation above build plate</label>
            <div className="relative">
              <input
                type="number" step="1" min="0" className="input-field pr-10"
                value={state.elevationMm ?? 0}
                onChange={e => handleElevationChange(Math.max(0, +e.target.value))}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">mm</span>
            </div>
            <p className="text-text-muted text-xs mt-1">
              {(state.elevationMm ?? 0) === 0
                ? 'Part fused directly to plate — no elevation support needed.'
                : `Bottom face floats ${state.elevationMm} mm above plate — full projected-area support pillar added to estimate.`}
            </p>
          </div>

          {/* Overhang angle — only shown after file upload */}
          {threeGeo && (
            <div className="card border-bg-border/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <label className="label mb-0">Overhang Threshold</label>
                  <button
                    onClick={() => setShowSupportInfo(v => !v)}
                    className="text-text-muted hover:text-text-secondary transition-colors flex items-center gap-0.5"
                    title="How is support % estimated?"
                  >
                    <HelpCircle size={13} />
                    {showSupportInfo ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={15} max={75} step={1}
                    className="w-14 text-center input-field py-1 text-sm font-mono"
                    value={overhangAngle}
                    onChange={e => handleAngleChange(Math.min(75, Math.max(15, +e.target.value)))}
                  />
                  <span className="text-text-secondary text-sm">°</span>
                </div>
              </div>

              <input
                type="range" min={15} max={75} step={1}
                value={overhangAngle}
                onChange={e => handleAngleChange(+e.target.value)}
                className="w-full accent-accent-blue cursor-pointer"
              />
              <div className="flex justify-between text-xs text-text-muted">
                <span>15° (strict)</span>
                <span className="text-accent-cyan">45° (standard)</span>
                <span>75° (lenient)</span>
              </div>

              {/* Info panel */}
              {showSupportInfo && (
                <div className="p-3 rounded-lg bg-bg-primary border border-bg-border text-xs text-text-muted leading-relaxed space-y-1.5">
                  <p className="font-semibold text-text-secondary">How support % is estimated</p>
                  <p>
                    Every face of the mesh is tested: if its normal vector points
                    more than <span className="text-accent-cyan">(90° − threshold)</span> away from the build axis,
                    the face is flagged as an overhang that cannot self-support during printing.
                  </p>
                  <p>
                    The server computes an <em>estimated support volume</em> by projecting overhang areas
                    downward (avg. 20% of build height × 0.3 packing density) and expresses it as a
                    percentage of total part volume.
                  </p>
                  <p>
                    Adjusting the threshold slider scales this estimate proportionally — a stricter
                    angle flags more faces, a lenient one flags fewer. Standard LPBF machines
                    typically require support beyond 45° from vertical.
                  </p>
                  <p className="text-text-muted/60 text-xs">
                    The % shown is an approximation. Complex internal geometries may differ.
                    Drag the "Support Material" slider below to override manually.
                  </p>
                </div>
              )}

              {/* Legend */}
              <div className="flex items-center gap-4 text-xs pt-1 border-t border-bg-border">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-orange-500 inline-block" />
                  <span className="text-text-muted">Needs support</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />
                  <span className="text-text-muted">Self-supporting</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm border border-accent-cyan inline-block" />
                  <span className="text-text-muted">Bounding box (with dims)</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right column: 3D viewer */}
        <div className="flex flex-col gap-2">
          <div
            className="rounded-xl overflow-hidden border border-bg-border bg-bg-secondary flex-1"
            style={{ minHeight: 360 }}
          >
            {threeGeo ? (
              <Canvas shadows camera={{ fov: 45 }} style={{ height: '100%' }}>
                <Suspense fallback={null}>
                  <StlScene
                    geometry={threeGeo}
                    overhangAngle={overhangAngle}
                    elevationMm={state.elevationMm ?? 0}
                  />
                </Suspense>
              </Canvas>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3">
                <RotateCcw size={36} className="text-text-muted opacity-40" />
                <p className="text-text-muted text-sm">Upload STL to see 3D preview</p>
                <p className="text-text-muted text-xs">with overhang analysis & bounding box</p>
              </div>
            )}
          </div>
          {threeGeo && (
            <p className="text-text-muted text-xs text-center">
              Scroll to zoom · drag to orbit · right-click to pan
            </p>
          )}
        </div>
      </div>

      {/* ── Parsed geometry stats ── */}
      {state.geometry && (
        <div className="card border-success/20 bg-success/5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success" />
              <span className="text-success text-xs font-semibold uppercase tracking-wide">
                Geometry Parsed · {state.geometry.face_count.toLocaleString()} faces
              </span>
            </div>
            <span className={`badge text-xs ${state.geometry.is_watertight ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
              {state.geometry.is_watertight ? 'Watertight mesh' : 'Open mesh'}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-xs">
            {[
              ['Volume', `${state.geometry.volume_cm3.toFixed(3)} cm³`],
              ['Bounding Box', `${state.geometry.bounding_box_mm.x.toFixed(1)}×${state.geometry.bounding_box_mm.y.toFixed(1)}×${state.geometry.bounding_box_mm.z.toFixed(1)} mm`],
              [`Height (${state.buildDirection.toUpperCase()})`, `${state.geometry.height_cm.toFixed(2)} cm`],
              ['Projected Area', `${state.geometry.projected_area_cm2.toFixed(2)} cm²`],
              ['Surface Area', `${state.geometry.surface_area_cm2.toFixed(2)} cm²`],
              ['Fill Density', `${(state.geometry.relative_density * 100).toFixed(1)}%`],
              ['Est. Support Vol.', `${state.geometry.support_volume_cm3.toFixed(3)} cm³`],
              [`Support @${overhangAngle}°`, `~${(state.supportPctOfMass * 100).toFixed(1)}% of mass`],
            ].map(([k, v]) => (
              <div key={k} className="p-2 rounded-lg bg-bg-secondary border border-bg-border">
                <div className="text-text-muted mb-0.5 truncate">{k}</div>
                <div className="text-text-primary font-mono font-medium">{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Manual parameters section ── */}
      <div>
        {/* Divider — makes it clear this section is usable standalone */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-bg-border" />
          <span className="text-text-muted text-xs font-semibold uppercase tracking-wider px-1">
            {state.geometry
              ? 'Part Parameters — auto-filled from STL · edit to override'
              : 'Part Parameters — enter manually, or upload STL above to auto-fill'}
          </span>
          <div className="flex-1 h-px bg-bg-border" />
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Geometric inputs */}
          <div className="space-y-3">
            {([
              ['Part Volume', 'partVolume', 'cm³'],
              ['Height in Build Direction', 'partHeight', 'cm'],
              ['Projected Area', 'partProjectedArea', 'cm²'],
            ] as const).map(([label, key, unit]) => (
              <div key={key}>
                <label className="label">{label}</label>
                <div className="relative">
                  <input
                    type="number" step="any" className="input-field pr-12"
                    value={(state[key] as number) ?? ''}
                    onChange={e => update({ [key]: +e.target.value } as any)}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">{unit}</span>
                </div>
              </div>
            ))}
            <div>
              <label className="label">Computed Part Mass</label>
              <div className="relative">
                <input
                  type="number" step="any"
                  className="input-field pr-10 bg-bg-primary text-text-muted cursor-not-allowed"
                  value={state.partVolume && state.materialDensity
                    ? +(state.partVolume * state.materialDensity / 1000).toFixed(4) : ''}
                  readOnly
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">kg</span>
              </div>
              <p className="text-text-muted text-xs mt-0.5">Recalculates when you choose material</p>
            </div>
          </div>

          {/* Support & production */}
          <div className="space-y-3">
            <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide border-b border-bg-border pb-2">
              Support & Production
            </h3>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Support Material (% of part mass)</label>
                <span className="text-accent-cyan font-mono text-sm font-semibold">
                  {(state.supportPctOfMass * 100).toFixed(1)}%
                </span>
              </div>
              <input
                type="range" min={0} max={60} step={0.5}
                value={Math.round(state.supportPctOfMass * 100 * 2) / 2}
                onChange={e => update({ supportPctOfMass: +e.target.value / 100 })}
                className="w-full accent-accent-blue cursor-pointer"
              />
              <p className="text-text-muted text-xs mt-1">
                {threeGeo
                  ? `Estimated from overhang analysis at ${overhangAngle}°. Drag to override.`
                  : 'Fraction of part mass used for support structures. Typical: 10–30%.'}
              </p>
            </div>
            <div>
              <label className="label">Production Run</label>
              <div className="relative">
                <input
                  type="number" step="1" min="1" className="input-field pr-14"
                  value={state.productionRun}
                  onChange={e => update({ productionRun: Math.max(1, +e.target.value) })}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">parts</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-bg-border">
        <button onClick={onNext} disabled={!canProceed} className="btn-primary">
          Continue to Machine <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
