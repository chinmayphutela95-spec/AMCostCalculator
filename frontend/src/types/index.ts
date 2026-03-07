export interface Machine {
  id: number
  name: string
  manufacturer: string
  process_type: string
  build_plate_shape: string
  build_plate_diameter?: number
  build_plate_width?: number
  build_plate_length?: number
  build_height: number
  build_area: number
  build_rate: number
  num_lasers: number
  recoating_distance_mm?: number
  recoating_speed_mm_s?: number
  machine_cost: number
  machine_lifetime: number
  cost_of_capital: number
  infrastructure_pct: number
  maintenance_pct: number
  uptime: number
  packing_policy: string
  packing_fraction: number
  recycling_fraction: number
  inert_gas_cost: number
  consumable_cost_per_build: number
  first_build_prep_time: number
  subsequent_build_prep_time: number
  setup_time_per_build: number
  removal_time_per_build: number
  warmup_time: number
  cooldown_time: number
  support_constant: number
  hours_per_day: number
  days_per_week: number
  fte_supervised: number
  fte_build_exchange: number
  fte_support_removal: number
  salary_engineer: number
  salary_operator: number
  salary_technician: number
  is_custom: boolean
  notes: string
  created_at: string
}

export interface Material {
  id: number
  name: string
  alloy_designation: string
  category: string
  process_compatibility: string
  cost_per_kg: number
  density: number
  layer_thickness_um: number
  build_rate_cm3_hr: number
  yield_strength?: number
  tensile_strength?: number
  elongation?: number
  hardness?: number
  max_service_temp?: number
  is_custom: boolean
  notes: string
  created_at: string
}

export interface PartGeometry {
  success: boolean
  error?: string
  file_id?: string
  file_name?: string
  file_path?: string
  volume_cm3: number
  height_cm: number
  projected_area_cm2: number
  surface_area_cm2: number
  bounding_box_mm: { x: number; y: number; z: number }
  relative_density: number
  support_volume_cm3: number
  support_area_cm2: number
  estimated_support_pct: number
  face_count: number
  vertex_count: number
  build_direction: string
  is_watertight: boolean
}

export interface CostResult {
  parts_per_build: number
  num_builds: number
  support_mass_per_part: number
  material: {
    total_part_material_kg: number
    total_support_material_kg: number
    total_build_material_kg: number
    recycled_material_kg: number
    material_waste_kg: number
    material_required_kg: number
    cost: number
  }
  build_prep: { total_time_hr: number; cost: number }
  machine: {
    annual_depreciation: number
    annual_maintenance: number
    machine_cost_per_hour: number
    total_warmup_hr: number
    total_scan_hr: number
    total_recoating_hr: number
    total_print_hr: number
    total_cooldown_hr: number
    total_build_exchange_hr: number
    total_machine_time_hr: number
    cost: number
  }
  consumables: { inert_gas_cost: number; per_build_consumables: number; cost: number }
  labor: { labor_during_build_hr: number; labor_build_exchange_hr: number; total_labor_hr: number; cost: number }
  post_process: { support_removal_time_hr: number; cost: number }
  metal_am_extensions: {
    heat_treatment_cost: number
    part_separation_cost: number
    hip_cost: number
    surface_treatment_cost: number
    ndt_cost: number
  }
  total_cost: number
  cost_per_part: number
}

export interface QuantityPoint {
  quantity: number
  cost_per_part: number
  total_cost: number
  material_cost: number
  machine_cost: number
  labor_cost: number
  consumables_cost: number
  build_prep_cost: number
  post_process_cost: number
  parts_per_build: number
  num_builds: number
}

export interface Project {
  id: number
  name: string
  description: string
  created_at: string
  updated_at: string
  part_file_name?: string
  inputs_json: string
  results_json: string
  ai_insights_json: string
}

export interface AnalysisState {
  // Part
  partMass: number
  partVolume: number
  partHeight: number
  partProjectedArea: number
  supportPctOfMass: number
  buildDirection: 'x' | 'y' | 'z'
  partFilePath?: string
  partFileName?: string
  geometry?: PartGeometry

  // Production
  productionRun: number

  // Machine
  selectedMachineId?: number
  selectedMachine?: Machine

  // Material
  selectedMaterialId?: number
  selectedMaterial?: Material
  materialCostPerKg: number
  materialDensity: number

  // Process overrides
  inertGasCost?: number
  consumableCostPerBuild?: number
  hoursPerDay?: number
  daysPerWeek?: number
  salaryEngineer?: number
  salaryOperator?: number
  salaryTechnician?: number

  // Metal AM extensions
  heatTreatmentEnabled: boolean
  heatTreatmentCostPerBuild: number
  partSeparationEnabled: boolean
  partSeparationCostPerPart: number
  hipEnabled: boolean
  hipCostPerPart: number
  surfaceTreatmentEnabled: boolean
  surfaceTreatmentCostPerPart: number
  ndtEnabled: boolean
  ndtCostPerPart: number

  // Part setup
  elevationMm: number  // height of part bottom above build plate (0 = fused to plate)

  // Material process params
  materialBuildRate: number
  layerThicknessUm: number

  // Laser configuration
  laserStrategy: 'single' | 'multi_per_part' | 'multi_zones'
  lasersPerPart: number

  // Recoating
  recoatingEfficiency: number  // 0.5–1.0; ignored when machine has distance+speed

  // Packing override
  partsPerBuildOverride?: number

  // Machine comparison
  compareIds?: number[]
  compareMachines?: Machine[]

  // Results
  result?: CostResult
  quantityCurve?: QuantityPoint[]
  aiInsights?: any
}
