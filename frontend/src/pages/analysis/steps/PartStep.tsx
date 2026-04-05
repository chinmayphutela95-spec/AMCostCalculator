import { useCallback, useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, File as FileIcon, RotateCcw, Info, ChevronRight, Loader2, HelpCircle, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
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
    // Angle α from horizontal; face needs support when its normal · build < -cos(α)
    // (surface at α from horizontal has normal·build = -cos(α); overhang when α < threshold angle)
    const threshold = -Math.cos((overhangAngle * Math.PI) / 180)

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

/**
 * Renders semi-transparent support columns below each overhang face.
 * Each column stretches from the face centroid straight down to the build plate.
 * Uses InstancedMesh so even 10k+ columns render in a single draw call.
 * The viewer always pre-rotates to Y-up, so buildAxis is always 1 here.
 */
function SupportColumns({ geometry, overhangAngle, elevationMm }: {
  geometry: THREE.BufferGeometry
  overhangAngle: number
  elevationMm: number
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)

  const columns = useMemo(() => {
    const normals = geometry.attributes.normal as THREE.BufferAttribute
    const pos    = geometry.attributes.position as THREE.BufferAttribute
    const count  = pos.count
    const threshold = -Math.sin((overhangAngle * Math.PI) / 180)

    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    const minY       = box.min.y
    const buildPlateY = minY - elevationMm
    const eps         = (box.max.y - minY) * 0.005

    const result: { cx: number; midY: number; cz: number; height: number; side: number }[] = []

    for (let i = 0; i < count; i += 3) {
      // dot product with build vec [0,1,0] — just the Y component of the normal
      const dot = normals.getY(i)
      let isOverhang = dot < threshold
      if (isOverhang && elevationMm === 0) {
        const y0 = pos.getY(i), y1 = pos.getY(i + 1), y2 = pos.getY(i + 2)
        if (Math.min(y0, y1, y2) <= minY + eps) isOverhang = false
      }
      if (!isOverhang) continue

      const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3
      const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3
      const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3
      const height = cy - buildPlateY
      if (height < 0.5) continue

      // Face area via cross product; projected area = face_area × |dot|
      const e1x = pos.getX(i+1) - pos.getX(i), e1y = pos.getY(i+1) - pos.getY(i), e1z = pos.getZ(i+1) - pos.getZ(i)
      const e2x = pos.getX(i+2) - pos.getX(i), e2y = pos.getY(i+2) - pos.getY(i), e2z = pos.getZ(i+2) - pos.getZ(i)
      const faceArea = Math.sqrt(
        (e1y*e2z - e1z*e2y) ** 2 + (e1z*e2x - e1x*e2z) ** 2 + (e1x*e2y - e1y*e2x) ** 2
      ) * 0.5
      const side = Math.sqrt(Math.max(faceArea * Math.abs(dot), 0.5))

      result.push({ cx, midY: buildPlateY + height / 2, cz, height, side })
    }
    return result
  }, [geometry, overhangAngle, elevationMm])

  useEffect(() => {
    if (!meshRef.current || columns.length === 0) return
    const dummy = new THREE.Object3D()
    columns.forEach(({ cx, midY, cz, height, side }, idx) => {
      dummy.position.set(cx, midY, cz)
      dummy.scale.set(side, height, side)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(idx, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [columns])

  if (columns.length === 0) return null

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, columns.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#f97316" opacity={0.22} transparent depthWrite={false} side={THREE.DoubleSide} />
    </instancedMesh>
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

function StlScene({ geometry, overhangAngle, elevationMm, showSupportVolume }: {
  geometry: THREE.BufferGeometry
  overhangAngle: number
  elevationMm: number
  showSupportVolume: boolean
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
      {showSupportVolume && (
        <SupportColumns geometry={geometry} overhangAngle={overhangAngle} elevationMm={elevationMm} />
      )}
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

// ─── Build direction helpers ──────────────────────────────────────────────────

/**
 * Computes the pre-rotation matrix to apply to the mesh geometry so that the
 * chosen build direction ends up pointing as screen Y (up). The viewer always
 * treats Y as up, so this keeps all downstream components direction-agnostic.
 */
function getBuildRotation(dir: string): THREE.Matrix4 {
  const m = new THREE.Matrix4()
  switch (dir.toLowerCase()) {
    case 'y':   return m                                       // Y up — already correct
    case '-y':  return m.makeRotationX(Math.PI)               // Y down → flip
    case 'z':   return m.makeRotationX(-Math.PI / 2)          // Z up → [0,0,1]→[0,1,0]
    case '-z':  return m.makeRotationX(Math.PI / 2)           // -Z up → [0,0,-1]→[0,1,0]
    case 'x':   return m.makeRotationZ(Math.PI / 2)           // X up → [1,0,0]→[0,1,0]
    case '-x':  return m.makeRotationZ(-Math.PI / 2)          // -X up → [-1,0,0]→[0,1,0]
    default: {
      // custom:nx,ny,nz — rotate build_vec to Y-up
      let bv = new THREE.Vector3(0, 1, 0)
      if (dir.startsWith('custom:')) {
        const parts = dir.slice(7).split(',').map(Number)
        if (parts.length === 3 && parts.every(p => !isNaN(p))) {
          bv = new THREE.Vector3(...(parts as [number, number, number])).normalize()
        }
      }
      const yUp = new THREE.Vector3(0, 1, 0)
      const dot  = Math.max(-1, Math.min(1, bv.dot(yUp)))
      if (Math.abs(dot - 1) < 1e-4) return new THREE.Matrix4()
      if (Math.abs(dot + 1) < 1e-4) return new THREE.Matrix4().makeRotationX(Math.PI)
      const axis  = new THREE.Vector3().crossVectors(bv, yUp).normalize()
      const angle = Math.acos(dot)
      return new THREE.Matrix4().makeRotationAxis(axis, angle)
    }
  }
}

/** Build a 'custom:nx,ny,nz' direction string from spherical angles (degrees). */
function sphericalToDir(polarDeg: number, azimuthDeg: number): string {
  const p = polarDeg   * Math.PI / 180
  const a = azimuthDeg * Math.PI / 180
  const nx = +(Math.sin(p) * Math.cos(a)).toFixed(6)
  const ny = +(Math.sin(p) * Math.sin(a)).toFixed(6)
  const nz = +(Math.cos(p)).toFixed(6)
  return `custom:${nx},${ny},${nz}`
}

// ─── Main PartStep ────────────────────────────────────────────────────────────

interface Props {
  state: AnalysisState
  update: (p: Partial<AnalysisState>) => void
  onNext: () => void
}


const SUPPORT_PRESETS = [
  { label: 'Block',       density: 0.40, tip: 'Perforated block — dense, good for critical surfaces' },
  { label: 'Serrated',    density: 0.32, tip: 'Serrated/teeth block — easier removal than solid block' },
  { label: 'Contour',     density: 0.27, tip: 'Contour-following — good for curved overhangs' },
  { label: 'Gusset/Fin',  density: 0.15, tip: 'Thin fins/walls — minimal material, moderate removal effort' },
  { label: 'Lattice',     density: 0.12, tip: 'Lattice or cone — least material, easiest removal' },
  { label: 'Custom',      density: -1,   tip: 'Enter your own fill density' },
] as const

export function PartStep({ state, update, onNext }: Props) {
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  const [threeGeo, setThreeGeo] = useState<THREE.BufferGeometry | null>(null)
  const [overhangAngle, setOverhangAngle] = useState(45)
  const [showSupportInfo, setShowSupportInfo] = useState(false)
  const [fillDensity, setFillDensity] = useState(0.3)
  const [selectedPreset, setSelectedPreset] = useState('Block')
  const [customDensity, setCustomDensity] = useState('30')
  const [showSupportVolume, setShowSupportVolume] = useState(true)
  const [showCustomDir, setShowCustomDir] = useState(false)
  const [customPolar, setCustomPolar] = useState(0)
  const [customAzimuth, setCustomAzimuth] = useState(0)

  const [analysisReady, setAnalysisReady] = useState(!!state.geometry)
  const [settingsDirty, setSettingsDirty] = useState(false)
  const [directionLoading, setDirectionLoading] = useState(false)
  const analysisReadyRef = useRef(!!state.geometry) // stable ref for use inside effects/callbacks

  const fileRef = useRef<File | null>(null)
  const loaderRef = useRef(new STLLoader())
  const loadCounterRef = useRef(0) // incremented on each load; stale completions are discarded
  // Server's estimated_support_pct (0–100, overhang only — elevation added on top)
  const serverPctRef = useRef(0)

  // ── Elevation contribution (client-side, no server needed) ────────────────
  // Elevation pillar is support structure at fillDensity, not solid — multiply by fillDensity
  // to match the same convention as estimate_support_volume on the server.
  const elevationPct = useCallback((projAreaCm2: number, volCm3: number, elevMm: number) => {
    if (volCm3 <= 0 || projAreaCm2 <= 0) return 0
    return (projAreaCm2 * (elevMm / 10) * fillDensity) / volCm3 * 100
  }, [fillDensity])

  // ── Server parse ──────────────────────────────────────────────────────────
  const parseOnServer = useCallback(async (file: File, direction: string, angle = 45, density = 0.3) => {
    setParsing(true)
    setParseError('')
    try {
      const result = await geometryApi.parse(file, direction, angle, density)
      if (!result.success) { setParseError(result.error || 'Failed to parse'); return }
      serverPctRef.current = result.estimated_support_pct
      const elevPct = elevationPct(result.projected_area_cm2, result.volume_cm3, 0)
      update({
        geometry: result,
        partFileName: result.file_name ?? file.name,
        partFilePath: result.file_path,
        partVolume: result.volume_cm3,
        partHeight: result.height_cm,
        partProjectedArea: result.projected_area_cm2,
        supportPctOfMass: Math.min((result.estimated_support_pct + elevPct) / 100, 0.80),
      })
      setAnalysisReady(true)
      analysisReadyRef.current = true
      setSettingsDirty(false)
    } catch (e: any) {
      setParseError(e.message || 'Parse error')
    } finally {
      setParsing(false)
    }
  }, [update, elevationPct])

  // ── Load geometry into Three.js viewer ────────────────────────────────────
  // Pre-rotate so the chosen build axis always points up (screen Y).
  // After this rotation all downstream components (plate, overhang, camera)
  // can unconditionally treat Y as the build direction.
  // A load counter prevents stale async loads from overwriting a newer result.
  const loadViewer = useCallback((file: File, direction: string) => {
    const thisLoad = ++loadCounterRef.current
    setDirectionLoading(true)
    const url = URL.createObjectURL(file)
    loaderRef.current.load(url, (geo: THREE.BufferGeometry) => {
      URL.revokeObjectURL(url)
      if (thisLoad !== loadCounterRef.current) return  // stale load — discard
      geo.computeVertexNormals()
      geo.center()
      geo.applyMatrix4(getBuildRotation(direction))
      geo.computeVertexNormals()
      geo.computeBoundingBox()
      setThreeGeo(geo)
      setDirectionLoading(false)
    })
  }, [])

  // ── On file drop — load viewer only; user clicks Analyze to run server parse ─
  const onDrop = useCallback((files: File[]) => {
    const file = files[0]
    if (!file) return
    fileRef.current = file
    loadViewer(file, state.buildDirection)
    setAnalysisReady(false)
    analysisReadyRef.current = false
    setSettingsDirty(false)
    update({ geometry: undefined, partVolume: 0, partHeight: 0, partProjectedArea: 0, supportPctOfMass: 0.10 })
  }, [state.buildDirection, loadViewer, update])

  // ── Re-orient viewer when build direction changes; mark dirty if already analyzed ──
  useEffect(() => {
    if (fileRef.current) {
      loadViewer(fileRef.current, state.buildDirection)
      if (analysisReadyRef.current) setSettingsDirty(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.buildDirection])

  const handleAngleChange = useCallback((angle: number) => {
    setOverhangAngle(angle)
    if (analysisReadyRef.current) setSettingsDirty(true)
  }, [])

  const handleFillDensityChange = useCallback((density: number, preset: string) => {
    setFillDensity(density)
    setSelectedPreset(preset)
    if (analysisReadyRef.current) setSettingsDirty(true)
  }, [])

  const handleElevationChange = useCallback((elevMm: number) => {
    const clamped = Math.max(0, elevMm)
    update({ elevationMm: clamped })
    if (analysisReadyRef.current) {
      setSettingsDirty(true)
      // Elevation is client-only — update support % immediately from cached server pct
      if (state.partVolume > 0 && state.partProjectedArea > 0) {
        const elevPct = elevationPct(state.partProjectedArea, state.partVolume, clamped)
        update({ supportPctOfMass: Math.min((serverPctRef.current + elevPct) / 100, 0.80) })
      }
    }
  }, [state.partVolume, state.partProjectedArea, elevationPct, update])

  const handleAnalyze = useCallback(async () => {
    if (!fileRef.current) return
    await parseOnServer(fileRef.current, state.buildDirection, overhangAngle, fillDensity)
  }, [parseOnServer, state.buildDirection, overhangAngle, fillDensity])

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
          {threeGeo && !analysisReady && !parsing && (
            <p className="text-text-muted text-xs text-center">
              Configure settings below, then click <span className="text-accent-blue font-medium">Analyze Part</span> to compute geometry.
            </p>
          )}

          {/* Build direction */}
          <div className="space-y-2">
            <label className="label">Build Direction — which axis points up during printing</label>
            {/* 6 standard presets */}
            <div className="grid grid-cols-3 gap-1.5">
              {(['+X', '+Y', '+Z', '-X', '-Y', '-Z'] as const).map(label => {
                const dir = label.replace('+', '').toLowerCase()
                const active = !showCustomDir && state.buildDirection === dir
                return (
                  <button
                    key={label}
                    onClick={() => {
                      setShowCustomDir(false)
                      update({ buildDirection: dir })
                    }}
                    className={`py-2 rounded-lg text-sm font-mono font-bold border transition-colors flex items-center justify-center gap-1 ${
                      active
                        ? 'bg-accent-blue/10 border-accent-blue text-accent-blue'
                        : 'border-bg-border text-text-secondary hover:border-accent-blue/40'
                    }`}
                  >
                    {label} up
                    {parsing && active && <Loader2 size={10} className="animate-spin" />}
                  </button>
                )
              })}
            </div>

            {/* Custom angle toggle */}
            <button
              onClick={() => setShowCustomDir(v => !v)}
              className={`w-full py-2 rounded-lg text-xs border transition-colors flex items-center justify-center gap-1.5 ${
                showCustomDir
                  ? 'bg-accent-blue/10 border-accent-blue text-accent-blue'
                  : 'border-bg-border text-text-muted hover:border-accent-blue/40'
              }`}
            >
              {showCustomDir ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Custom angle
            </button>

            {showCustomDir && (() => {
              const dir = sphericalToDir(customPolar, customAzimuth)
              const parts = dir.slice(7).split(',').map(Number)
              const applyCustom = (p: number, a: number) => {
                const d = sphericalToDir(p, a)
                update({ buildDirection: d })
              }
              return (
                <div className="p-3 rounded-lg border border-bg-border space-y-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Polar — from +Z axis</span>
                      <span className="font-mono text-accent-cyan">{customPolar}°</span>
                    </div>
                    <input type="range" min={0} max={180} step={1} value={customPolar}
                      className="w-full accent-accent-blue"
                      onChange={e => { const v = +e.target.value; setCustomPolar(v); applyCustom(v, customAzimuth) }}
                    />
                    <div className="flex justify-between text-text-muted">
                      <span>0° (+Z up)</span><span>90° (horizontal)</span><span>180° (−Z up)</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Azimuth — around Z</span>
                      <span className="font-mono text-accent-cyan">{customAzimuth}°</span>
                    </div>
                    <input type="range" min={0} max={360} step={1} value={customAzimuth}
                      className="w-full accent-accent-blue"
                      onChange={e => { const v = +e.target.value; setCustomAzimuth(v); applyCustom(customPolar, v) }}
                    />
                    <div className="flex justify-between text-text-muted">
                      <span>0° (+X)</span><span>90° (+Y)</span><span>180° (−X)</span><span>270° (−Y)</span>
                    </div>
                  </div>
                  <div className="font-mono text-text-muted bg-bg-secondary rounded px-2 py-1">
                    build vec [{parts.map(p => p.toFixed(3)).join(', ')}]
                    {parsing && <Loader2 size={10} className="animate-spin inline ml-2" />}
                  </div>
                </div>
              )
            })()}

            {state.partFileName && (
              <p className="text-text-muted text-xs flex items-center gap-1">
                <Info size={11} /> Changing orientation updates the 3D viewer. Re-analyze to update geometry stats.
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

          {/* Overhang angle & support settings — only shown after file upload */}
          {/* Locked while direction is loading to prevent computing overhang on a stale geometry */}
          {threeGeo && (
            <div className={`card border-bg-border/50 space-y-2 transition-opacity ${directionLoading ? 'opacity-40 pointer-events-none' : ''}`}>
              {directionLoading && (
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  <Loader2 size={11} className="animate-spin" />
                  Updating orientation — overhang controls locked until ready
                </div>
              )}
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

              {/* Support structure fill density */}
              <div className="space-y-2 pt-1">
                <label className="label mb-0 text-xs">Support Structure Type</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {SUPPORT_PRESETS.map(p => (
                    <button
                      key={p.label}
                      title={p.tip}
                      onClick={() => {
                        if (p.label === 'Custom') {
                          setSelectedPreset('Custom')
                        } else {
                          handleFillDensityChange(p.density, p.label)
                        }
                      }}
                      className={`py-1.5 px-2 rounded-lg text-xs border transition-colors ${
                        selectedPreset === p.label
                          ? 'bg-accent-blue/10 border-accent-blue text-accent-blue'
                          : 'border-bg-border text-text-secondary hover:border-accent-blue/40'
                      }`}
                    >
                      {p.label}
                      {p.density > 0 && (
                        <span className="ml-1 text-text-muted font-mono">
                          {Math.round(p.density * 100)}%
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {selectedPreset === 'Custom' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min={5} max={100} step={1}
                      className="w-20 input-field py-1 text-sm font-mono text-center"
                      value={customDensity}
                      onChange={e => {
                        const raw = e.target.value
                        setCustomDensity(raw)
                        const v = Math.min(100, Math.max(5, +raw))
                        if (!isNaN(v)) handleFillDensityChange(v / 100, 'Custom')
                      }}
                    />
                    <span className="text-text-secondary text-sm">% fill density</span>
                  </div>
                )}
              </div>

              {/* Info panel */}
              {showSupportInfo && (
                <div className="p-3 rounded-lg bg-bg-primary border border-bg-border text-xs text-text-muted leading-relaxed space-y-1.5">
                  <p className="font-semibold text-text-secondary">How support % is estimated</p>
                  <p>
                    Every face is tested against the overhang threshold. Flagged faces project
                    a support column straight down to the build plate — the column's cross-section
                    equals the face's projected area and its height equals the face centroid's
                    distance above the plate.
                  </p>
                  <p>
                    Support volume = Σ(projected_area × height) × fill density. The
                    <span className="text-accent-cyan"> Support Structure Type</span> sets the fill
                    density (e.g. 40% for block, 12% for lattice). A stricter angle flags more
                    faces; a lenient one flags fewer.
                  </p>
                  <p className="text-text-muted/60 text-xs">
                    This is a geometric estimate — complex internal geometries or nested overhangs
                    may differ. Drag the "Support Material" slider below to override manually.
                  </p>
                </div>
              )}

              {/* Legend + support volume toggle */}
              <div className="flex items-center gap-4 text-xs pt-1 border-t border-bg-border flex-wrap">
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
                  <span className="text-text-muted">Bounding box</span>
                </span>
                <button
                  onClick={() => setShowSupportVolume(v => !v)}
                  className={`flex items-center gap-1.5 ml-auto transition-colors ${showSupportVolume ? 'text-orange-400' : 'text-text-muted'}`}
                >
                  <span className="w-3 h-3 rounded-sm inline-block" style={{ background: showSupportVolume ? 'rgba(249,115,22,0.45)' : 'transparent', border: '1px solid #f97316' }} />
                  <span>{showSupportVolume ? 'Hide' : 'Show'} support volume</span>
                </button>
              </div>
            </div>
          )}

          {/* Analyze / Re-analyze button */}
          {threeGeo && (!analysisReady || settingsDirty) && (
            <button
              onClick={handleAnalyze}
              disabled={parsing}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {parsing
                ? <><Loader2 size={16} className="animate-spin" /> Analyzing…</>
                : <><ChevronRight size={16} /> {settingsDirty ? 'Re-analyze Part' : 'Analyze Part'}</>
              }
            </button>
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
                    showSupportVolume={showSupportVolume}
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
      {state.geometry && analysisReady && (
        <div className="card border-success/20 bg-success/5">
          {settingsDirty && (
            <div className="mb-3 flex items-center gap-1.5 text-xs text-warning">
              <AlertCircle size={12} /> Settings changed — results may be out of date. Click Re-analyze to update.
            </div>
          )}
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
              (state.elevationMm ?? 0) > 0
                ? [`Build Height (${state.buildDirection.toUpperCase()})`, `${(state.geometry.height_cm + (state.elevationMm ?? 0) / 10).toFixed(2)} cm`]
                : [`Part Height (${state.buildDirection.toUpperCase()})`,  `${state.geometry.height_cm.toFixed(2)} cm`],
              ['Projected Area', `${state.geometry.projected_area_cm2.toFixed(2)} cm²`],
              ['Surface Area', `${state.geometry.surface_area_cm2.toFixed(2)} cm²`],
              ['Fill Density', `${(state.geometry.relative_density * 100).toFixed(1)}%`],
              ['Est. Support Vol.', `${(state.geometry.support_volume_cm3 + state.partProjectedArea * (state.elevationMm ?? 0) / 10 * fillDensity).toFixed(3)} cm³`],
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
            {analysisReady
              ? 'Part Parameters — auto-filled from STL · edit to override'
              : 'Part Parameters — enter manually, or upload STL above and click Analyze'}
          </span>
          <div className="flex-1 h-px bg-bg-border" />
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Geometric inputs */}
          <div className="space-y-3">
            {([
              ['Part Volume', 'partVolume', 'cm³'],
              ['Part Height', 'partHeight', 'cm'],
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
                {key === 'partHeight' && (state.elevationMm ?? 0) > 0 && (
                  <p className="text-text-muted text-xs mt-0.5">
                    Build Height: <span className="text-accent-blue font-mono">{((state[key] as number) + (state.elevationMm ?? 0) / 10).toFixed(2)} cm</span> (part + {state.elevationMm} mm gap)
                  </p>
                )}
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
            <div>
              <label className="label">Main Parts in This Layout</label>
              <div className="relative">
                <input
                  type="number" step="1" min="1" className="input-field pr-14"
                  value={state.partsPerLayout}
                  onChange={e => update({ partsPerLayout: Math.max(1, Math.round(+e.target.value)) })}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">parts</span>
              </div>
              <p className="text-text-muted text-xs mt-1">
                If the STL contains multiple parts (e.g. main parts + test coupons), enter the number of main parts. Cost per part will be divided accordingly.
              </p>
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
