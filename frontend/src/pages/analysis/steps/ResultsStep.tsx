import { useEffect, useState } from 'react'
import { ChevronLeft, Download, Save, Brain, RefreshCcw, Loader2, AlertCircle, CheckCircle2, TrendingDown } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell, ReferenceLine
} from 'recharts'
import { analysisApi, aiApi, projectsApi, exportApi } from '../../../lib/api'
import { formatCurrency, formatNumber, CATEGORY_COLORS } from '../../../lib/utils'
import type { AnalysisState } from '../../../types'

interface Props {
  state: AnalysisState
  update: (p: Partial<AnalysisState>) => void
  onBack: () => void
  onReset: () => void
}

const DARK_TOOLTIP = {
  contentStyle: { backgroundColor: '#141928', border: '1px solid #1e2a45', borderRadius: 8 },
  labelStyle: { color: '#e2e8f0' },
  itemStyle: { color: '#94a3b8' },
}

type CompareEntry = { machineName: string; costPerPart: number; totalCost: number; partsPerBuild: number; numBuilds: number }

export function ResultsStep({ state, update, onBack, onReset }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [compareResults, setCompareResults] = useState<CompareEntry[]>([])
  const [compareLoading, setCompareLoading] = useState(false)

  useEffect(() => {
    if (!state.result) runCalc()
    if (state.compareMachines && state.compareMachines.length > 0) runComparison()
  }, [])

  const m = state.selectedMachine!
  const mat = state.selectedMaterial!

  const runCalc = async () => {
    if (!state.selectedMachineId) return
    setLoading(true); setError('')
    try {
      const payload = {
        part_mass: state.partVolume * state.materialDensity / 1000,
        part_volume: state.partVolume,
        part_height: state.partHeight,
        elevation_mm: state.elevationMm ?? 0,
        part_projected_area: state.partProjectedArea,
        support_pct_of_mass: state.supportPctOfMass,
        production_run: state.productionRun,
        machine_id: state.selectedMachineId,
        material_id: state.selectedMaterialId,
        material_cost_per_kg: state.materialCostPerKg,
        material_density: state.materialDensity,
        inert_gas_cost: state.inertGasCost,
        consumable_cost_per_build: state.consumableCostPerBuild,
        hours_per_day: state.hoursPerDay,
        days_per_week: state.daysPerWeek,
        salary_engineer: state.salaryEngineer,
        salary_operator: state.salaryOperator,
        salary_technician: state.salaryTechnician,
        heat_treatment_enabled: state.heatTreatmentEnabled,
        heat_treatment_cost_per_build: state.heatTreatmentCostPerBuild,
        part_separation_enabled: state.partSeparationEnabled,
        part_separation_cost_per_part: state.partSeparationCostPerPart,
        hip_enabled: state.hipEnabled,
        hip_cost_per_part: state.hipCostPerPart,
        surface_treatment_enabled: state.surfaceTreatmentEnabled,
        surface_treatment_cost_per_part: state.surfaceTreatmentCostPerPart,
        ndt_enabled: state.ndtEnabled,
        ndt_cost_per_part: state.ndtCostPerPart,
        material_build_rate: state.materialBuildRate,
        layer_thickness_um: state.layerThicknessUm,
        laser_strategy: state.laserStrategy,
        lasers_per_part: state.lasersPerPart,
        recoating_efficiency: state.recoatingEfficiency ?? 1.0,
      }
      const data = await analysisApi.calculate(payload)
      update({ result: data.result, quantityCurve: data.quantity_curve })
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Calculation failed')
    } finally { setLoading(false) }
  }

  const basePayload = () => ({
    part_mass: state.partVolume * state.materialDensity / 1000,
    part_volume: state.partVolume,
    part_height: state.partHeight,
    elevation_mm: state.elevationMm ?? 0,
    part_projected_area: state.partProjectedArea,
    support_pct_of_mass: state.supportPctOfMass,
    production_run: state.productionRun,
    material_id: state.selectedMaterialId,
    material_cost_per_kg: state.materialCostPerKg,
    material_density: state.materialDensity,
    inert_gas_cost: state.inertGasCost,
    consumable_cost_per_build: state.consumableCostPerBuild,
    hours_per_day: state.hoursPerDay,
    days_per_week: state.daysPerWeek,
    salary_engineer: state.salaryEngineer,
    salary_operator: state.salaryOperator,
    salary_technician: state.salaryTechnician,
    heat_treatment_enabled: state.heatTreatmentEnabled,
    heat_treatment_cost_per_build: state.heatTreatmentCostPerBuild,
    part_separation_enabled: state.partSeparationEnabled,
    part_separation_cost_per_part: state.partSeparationCostPerPart,
    hip_enabled: state.hipEnabled,
    hip_cost_per_part: state.hipCostPerPart,
    surface_treatment_enabled: state.surfaceTreatmentEnabled,
    surface_treatment_cost_per_part: state.surfaceTreatmentCostPerPart,
    ndt_enabled: state.ndtEnabled,
    ndt_cost_per_part: state.ndtCostPerPart,
    material_build_rate: state.materialBuildRate,
    layer_thickness_um: state.layerThicknessUm,
    laser_strategy: state.laserStrategy,
    lasers_per_part: state.lasersPerPart,
    recoating_efficiency: state.recoatingEfficiency ?? 1.0,
    parts_per_build_override: state.partsPerBuildOverride ?? null,
  })

  const runComparison = async () => {
    const machines = state.compareMachines
    if (!machines || machines.length === 0) return
    setCompareLoading(true)
    try {
      const entries = await Promise.all(
        machines.map(async machine => {
          const data = await analysisApi.calculate({ ...basePayload(), machine_id: machine.id })
          const res = data.result
          return {
            machineName: machine.name,
            costPerPart: res.cost_per_part,
            totalCost: res.total_cost,
            partsPerBuild: res.parts_per_build,
            numBuilds: res.num_builds,
          } as CompareEntry
        })
      )
      setCompareResults(entries)
    } catch (e) {
      console.error('Comparison failed', e)
    } finally {
      setCompareLoading(false)
    }
  }

  const runAI = async () => {
    if (!state.result) return
    setAiLoading(true)
    try {
      const data = await aiApi.analyze({
        part_info: {
          volume_cm3: state.partVolume,
          mass_kg: state.partVolume * state.materialDensity / 1000,
          height_cm: state.partHeight,
          projected_area_cm2: state.partProjectedArea,
          surface_area_cm2: state.geometry?.surface_area_cm2,
          relative_density: state.geometry?.relative_density,
          support_volume_cm3: state.geometry?.support_volume_cm3,
          production_run: state.productionRun,
        },
        cost_breakdown: state.result,
        material_name: mat?.name || 'Unknown',
        machine_name: m?.name || 'Unknown',
      })
      update({ aiInsights: data })
    } finally { setAiLoading(false) }
  }

  const buildInputsPayload = () => {
    const buildPlate = m?.build_plate_shape === 'circular'
      ? `⌀${(m.build_plate_diameter || 0) * 10}mm`
      : `${(m?.build_plate_width || 0) * 10}×${(m?.build_plate_length || 0) * 10}mm`
    return {
      // Machine
      machine_name: m?.name,
      machine_manufacturer: m?.manufacturer,
      machine_build_plate: buildPlate,
      machine_build_height_mm: (m?.build_height || 0) * 10,
      machine_build_area_cm2: m?.build_area,
      machine_cost_usd: m?.machine_cost,
      machine_num_lasers: m?.num_lasers ?? 1,
      machine_packing_policy: m?.packing_policy,
      machine_packing_fraction: m?.packing_fraction,
      machine_uptime: m?.uptime,
      machine_recycling_fraction: m?.recycling_fraction,
      // Material
      material_name: mat?.name,
      material_alloy: mat?.alloy_designation,
      material_category: mat?.category,
      material_cost_per_kg: state.materialCostPerKg,
      material_density_g_cm3: state.materialDensity,
      layer_thickness_um: state.layerThicknessUm,
      material_build_rate_cm3_hr: state.materialBuildRate,
      // Part geometry
      part_file_name: state.partFileName,
      part_volume_cm3: state.partVolume,
      part_height_cm: state.partHeight,
      part_projected_area_cm2: state.partProjectedArea,
      part_mass_kg: state.partVolume * state.materialDensity / 1000,
      support_pct_of_mass: state.supportPctOfMass,
      build_direction: state.buildDirection,
      elevation_mm: state.elevationMm ?? 0,
      // Production & process
      production_run: state.productionRun,
      laser_strategy: state.laserStrategy,
      lasers_per_part: state.lasersPerPart,
      recoating_efficiency: state.recoatingEfficiency ?? 0.75,
      parts_per_build_override: state.partsPerBuildOverride ?? null,
      // Post-processing
      heat_treatment_enabled: state.heatTreatmentEnabled,
      heat_treatment_cost_per_build: state.heatTreatmentCostPerBuild,
      part_separation_enabled: state.partSeparationEnabled,
      part_separation_cost_per_part: state.partSeparationCostPerPart,
      hip_enabled: state.hipEnabled,
      hip_cost_per_part: state.hipCostPerPart,
      surface_treatment_enabled: state.surfaceTreatmentEnabled,
      surface_treatment_cost_per_part: state.surfaceTreatmentCostPerPart,
      ndt_enabled: state.ndtEnabled,
      ndt_cost_per_part: state.ndtCostPerPart,
    }
  }

  const saveProject = async () => {
    if (!state.result || !projectName) return
    setSaving(true)
    try {
      await projectsApi.save({
        name: projectName,
        part_file_name: state.partFileName,
        inputs_json: JSON.stringify({
          ...buildInputsPayload(),
          quantity_curve: state.quantityCurve,
        }),
        results_json: JSON.stringify(state.result),
        ai_insights_json: JSON.stringify(state.aiInsights || {}),
        part_snapshot: state.partSnapshot,
      })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } finally { setSaving(false) }
  }

  const doExport = async (format: 'excel' | 'pdf') => {
    if (!state.result) return
    try {
      const resp = await exportApi.export({
        project_name: projectName || 'cost_analysis',
        inputs: { ...buildInputsPayload(), part_snapshot: state.partSnapshot },
        results: state.result,
        format,
        quantity_curve: state.quantityCurve,
      })
      const blob = new Blob([resp.data], { type: resp.headers['content-type'] })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cost_analysis.${format === 'excel' ? 'xlsx' : 'pdf'}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) { console.error(e) }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <Loader2 size={40} className="text-accent-blue animate-spin" />
      <p className="text-text-secondary">Calculating costs...</p>
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <AlertCircle size={40} className="text-danger" />
      <p className="text-danger">{error}</p>
      <button onClick={runCalc} className="btn-primary"><RefreshCcw size={16} /> Retry</button>
    </div>
  )

  if (!state.result) return null

  const r = state.result
  const total = r.total_cost

  // Cost breakdown bar data
  const categories = [
    { key: 'material', label: 'Material', cost: r.material.cost },
    { key: 'machine', label: 'Machine', cost: r.machine.cost },
    { key: 'labor', label: 'Labor', cost: r.labor.cost },
    { key: 'consumables', label: 'Consumables', cost: r.consumables.cost },
    { key: 'build_prep', label: 'Build Prep', cost: r.build_prep.cost },
    { key: 'post_process', label: 'Post-Process', cost: r.post_process.cost },
    ...(r.metal_am_extensions.heat_treatment_cost > 0 ? [{ key: 'heat_treatment', label: 'Heat Treatment', cost: r.metal_am_extensions.heat_treatment_cost }] : []),
    ...(r.metal_am_extensions.part_separation_cost > 0 ? [{ key: 'part_separation', label: 'Part Separation', cost: r.metal_am_extensions.part_separation_cost }] : []),
    ...(r.metal_am_extensions.hip_cost > 0 ? [{ key: 'hip', label: 'HIP', cost: r.metal_am_extensions.hip_cost }] : []),
    ...(r.metal_am_extensions.surface_treatment_cost > 0 ? [{ key: 'surface_treatment', label: 'Surface Treatment', cost: r.metal_am_extensions.surface_treatment_cost }] : []),
    ...(r.metal_am_extensions.ndt_cost > 0 ? [{ key: 'ndt', label: 'NDT', cost: r.metal_am_extensions.ndt_cost }] : []),
  ].filter(c => c.cost > 0).sort((a, b) => b.cost - a.cost)

  return (
    <div className="space-y-6">
      {/* Top summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card col-span-1 border-accent-cyan/30 bg-accent-cyan/5">
          <div className="stat-label text-accent-cyan">
            {state.partsPerLayout > 1 ? 'Cost per Main Part' : 'Cost per Part'}
          </div>
          <div className="stat-value text-accent-cyan font-mono">
            {formatCurrency(r.cost_per_part / (state.partsPerLayout || 1), 2)}
          </div>
          <div className="text-text-muted text-xs mt-1">
            {state.partsPerLayout > 1
              ? `${state.partsPerLayout} main parts/layout · ${formatCurrency(r.cost_per_part, 2)} per layout`
              : `@ ${state.productionRun} parts`}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Run Cost</div>
          <div className="stat-value font-mono">{formatCurrency(total)}</div>
          <div className="text-text-muted text-xs mt-1">{state.productionRun} parts</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Parts per Build</div>
          <div className="stat-value">{r.parts_per_build}</div>
          <div className="text-text-muted text-xs mt-1">{r.num_builds} builds total</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Machine: {m?.name}</div>
          <div className="text-text-primary font-semibold text-sm mt-1">{mat?.name}</div>
          <div className="text-text-muted text-xs mt-1">${state.materialCostPerKg}/kg · {state.materialDensity} g/cm³</div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-5">
        {/* Cost Breakdown Waterfall */}
        <div className="card">
          <h3 className="section-title">Cost Breakdown</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={categories} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a45" />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip {...DARK_TOOLTIP} formatter={(v: number) => [formatCurrency(v), 'Cost']} />
              <Bar dataKey="cost" radius={[3, 3, 0, 0]}>
                {categories.map((c) => <Cell key={c.key} fill={CATEGORY_COLORS[c.key] || '#64748b'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="card">
          <h3 className="section-title">Cost Distribution</h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={200}>
              <PieChart>
                <Pie data={categories} dataKey="cost" cx="50%" cy="50%" outerRadius={80} strokeWidth={0}>
                  {categories.map((c) => <Cell key={c.key} fill={CATEGORY_COLORS[c.key] || '#64748b'} />)}
                </Pie>
                <Tooltip {...DARK_TOOLTIP} formatter={(v: number) => [formatCurrency(v), '']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5">
              {categories.map(c => (
                <div key={c.key} className="flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CATEGORY_COLORS[c.key] }} />
                    <span className="text-text-muted truncate">{c.label}</span>
                  </div>
                  <span className="text-text-secondary font-mono shrink-0">{(c.cost / total * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Cost vs Quantity Curve */}
      {state.quantityCurve && state.quantityCurve.length > 0 && (
        <div className="card">
          <h3 className="section-title">Cost per Part vs Production Quantity</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={state.quantityCurve} margin={{ left: 0, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a45" />
              <XAxis dataKey="quantity" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${v / 1000}k` : v} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => `$${v.toFixed(0)}`} />
              <Tooltip {...DARK_TOOLTIP} formatter={(v: number, name: string) => [formatCurrency(v, 2), name]} />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
              <ReferenceLine x={state.productionRun} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Current', fill: '#f59e0b', fontSize: 10 }} />
              <Line type="monotone" dataKey="cost_per_part" name="Total $/part" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="material_cost" name="Material $/part" stroke="#06b6d4" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
              <Line type="monotone" dataKey="machine_cost" name="Machine $/part" stroke="#8b5cf6" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Machine Comparison */}
      {(state.compareMachines && state.compareMachines.length > 0) && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title mb-0">Machine Comparison</h3>
            <button
              onClick={runComparison}
              disabled={compareLoading}
              className="btn-secondary text-sm"
            >
              {compareLoading ? <><Loader2 size={13} className="animate-spin" /> Calculating…</> : <><RefreshCcw size={13} /> Refresh</>}
            </button>
          </div>

          {compareLoading && compareResults.length === 0 ? (
            <div className="flex items-center justify-center py-8 gap-2 text-text-muted text-sm">
              <Loader2 size={18} className="animate-spin" /> Calculating comparison…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-bg-border text-xs uppercase text-text-muted">
                    <th className="text-left py-2 pr-4">Machine</th>
                    <th className="text-right py-2 pr-4">Cost / Part</th>
                    <th className="text-right py-2 pr-4">Total Cost</th>
                    <th className="text-right py-2 pr-4">Parts / Build</th>
                    <th className="text-right py-2">Builds</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Primary machine row */}
                  <tr className="border-b border-accent-blue/20 bg-accent-blue/5">
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-accent-blue shrink-0" />
                        <span className="text-text-primary font-semibold">{m?.name}</span>
                        <span className="badge bg-accent-blue/20 text-accent-blue text-xs">Selected</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-right text-accent-cyan font-mono font-semibold">{formatCurrency(r.cost_per_part, 2)}</td>
                    <td className="py-2.5 pr-4 text-right text-text-primary font-mono">{formatCurrency(r.total_cost)}</td>
                    <td className="py-2.5 pr-4 text-right text-text-secondary">{r.parts_per_build}</td>
                    <td className="py-2.5 text-right text-text-secondary">{r.num_builds}</td>
                  </tr>
                  {/* Comparison machine rows */}
                  {compareResults.map((entry, i) => {
                    const diff = entry.costPerPart - r.cost_per_part
                    const pctDiff = r.cost_per_part > 0 ? (diff / r.cost_per_part) * 100 : 0
                    return (
                      <tr key={i} className="border-b border-bg-border/50 hover:bg-bg-secondary/30">
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-text-muted shrink-0" />
                            <span className="text-text-secondary">{entry.machineName}</span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 text-right">
                          <span className="font-mono text-text-primary">{formatCurrency(entry.costPerPart, 2)}</span>
                          <span className={`ml-2 text-xs font-mono ${diff > 0 ? 'text-danger' : diff < 0 ? 'text-success' : 'text-text-muted'}`}>
                            {diff > 0 ? '+' : ''}{pctDiff.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono text-text-secondary">{formatCurrency(entry.totalCost)}</td>
                        <td className="py-2.5 pr-4 text-right text-text-secondary">{entry.partsPerBuild}</td>
                        <td className="py-2.5 text-right text-text-secondary">{entry.numBuilds}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {compareResults.length === 0 && !compareLoading && (
                <p className="text-text-muted text-xs text-center py-4">
                  Click Refresh to calculate comparison costs.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Detail breakdown table */}
      <div className="card">
        <h3 className="section-title">Detailed Cost Breakdown</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-bg-border">
              <th className="text-left py-2 text-text-muted font-medium text-xs uppercase">Category</th>
              <th className="text-right py-2 text-text-muted font-medium text-xs uppercase">Total ($)</th>
              <th className="text-right py-2 text-text-muted font-medium text-xs uppercase">Per Part ($)</th>
              <th className="text-right py-2 text-text-muted font-medium text-xs uppercase">Share</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(c => (
              <tr key={c.key} className="border-b border-bg-border/50 hover:bg-bg-secondary/50">
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: CATEGORY_COLORS[c.key] }} />
                    <span className="text-text-primary">{c.label}</span>
                  </div>
                </td>
                <td className="py-2 text-right text-text-primary font-mono">{formatCurrency(c.cost)}</td>
                <td className="py-2 text-right text-text-secondary font-mono">{formatCurrency(c.cost / state.productionRun, 2)}</td>
                <td className="py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-20 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${c.cost / total * 100}%`, background: CATEGORY_COLORS[c.key] }} />
                    </div>
                    <span className="text-text-muted text-xs w-10 text-right">{(c.cost / total * 100).toFixed(1)}%</span>
                  </div>
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-accent-blue/30 font-semibold">
              <td className="py-2 text-text-primary">TOTAL</td>
              <td className="py-2 text-right text-accent-cyan font-mono">{formatCurrency(total)}</td>
              <td className="py-2 text-right text-accent-cyan font-mono">{formatCurrency(r.cost_per_part, 2)}</td>
              <td className="py-2 text-right text-text-muted">100%</td>
            </tr>
          </tbody>
        </table>

        {/* Key stats */}
        <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-bg-border text-xs">
          <div><span className="text-text-muted">Material required: </span><span className="text-text-primary font-mono">{formatNumber(r.material.material_required_kg, 2)} kg</span></div>
          <div><span className="text-text-muted">Powder recycled: </span><span className="text-text-primary font-mono">{formatNumber(r.material.recycled_material_kg, 2)} kg</span></div>
          <div><span className="text-text-muted">Total print time: </span><span className="text-text-primary font-mono">{formatNumber(r.machine.total_print_hr, 1)} hr</span></div>
          <div><span className="text-text-muted">Machine $/hr: </span><span className="text-text-primary font-mono">{formatCurrency(r.machine.machine_cost_per_hour, 2)}</span></div>
        </div>
      </div>

      {/* AI Insights */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Brain size={18} className="text-accent-purple" />
            <h3 className="section-title mb-0">AI Insights</h3>
          </div>
          <button onClick={runAI} disabled={aiLoading} className="btn-secondary text-sm">
            {aiLoading ? <><Loader2 size={14} className="animate-spin" /> Analyzing...</> : <><Brain size={14} /> Get AI Analysis</>}
          </button>
        </div>

        {!state.aiInsights && !aiLoading && (
          <div className="text-center py-8 text-text-muted text-sm">
            <Brain size={32} className="mx-auto mb-3 opacity-40" />
            Click "Get AI Analysis" for manufacturing insights, DfAM recommendations, and AM vs conventional comparison.
            <p className="text-xs mt-1">Requires the Anthropic API key to be configured on the server.</p>
          </div>
        )}

        {state.aiInsights?.error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
            <AlertCircle size={14} />
            {state.aiInsights.error}
          </div>
        )}

        {state.aiInsights?.insights && (() => {
          const ins = state.aiInsights.insights
          return (
            <div className="space-y-5">
              {/* AM vs Conventional */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-2">AM Advantages</h4>
                  <ul className="space-y-1.5">
                    {(ins.am_vs_conventional?.am_advantages || []).map((a: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 size={13} className="text-success shrink-0 mt-0.5" />
                        <span className="text-text-secondary">{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-2">Limitations</h4>
                  <ul className="space-y-1.5">
                    {(ins.am_vs_conventional?.am_disadvantages || []).map((d: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <AlertCircle size={13} className="text-warning shrink-0 mt-0.5" />
                        <span className="text-text-secondary">{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {ins.am_vs_conventional?.recommended_approach && (
                <div className="p-3 rounded-lg bg-accent-blue/10 border border-accent-blue/20 text-sm">
                  <span className="text-accent-blue font-semibold">Recommendation: </span>
                  <span className="text-text-secondary">{ins.am_vs_conventional.recommended_approach}</span>
                </div>
              )}

              {/* Cost reduction */}
              {ins.cost_reduction_opportunities?.length > 0 && (
                <div>
                  <h4 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1"><TrendingDown size={12} /> Cost Reduction Opportunities</h4>
                  <div className="space-y-2">
                    {ins.cost_reduction_opportunities.map((o: any, i: number) => (
                      <div key={i} className="flex gap-3 p-3 rounded-lg bg-bg-secondary border border-bg-border text-sm">
                        <span className="badge bg-accent-cyan/10 text-accent-cyan shrink-0">{o.area}</span>
                        <div className="flex-1">
                          <span className="text-text-secondary">{o.suggestion}</span>
                          {o.potential_savings && <span className="text-success ml-2 text-xs">· {o.potential_savings}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DfAM */}
              {ins.dfam_recommendations?.length > 0 && (
                <div>
                  <h4 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-2">Design for AM (DfAM) Tips</h4>
                  <ul className="space-y-1.5">
                    {ins.dfam_recommendations.map((tip: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                        <span className="text-accent-blue shrink-0 font-mono text-xs mt-0.5">{i + 1}.</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Key metrics */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                {ins.geometric_complexity && (
                  <div className="p-2.5 rounded-lg bg-bg-secondary border border-bg-border">
                    <div className="text-text-muted mb-1">Geometric Complexity</div>
                    <div className="text-text-primary font-semibold">{ins.geometric_complexity.score}</div>
                    {ins.geometric_complexity.justification && <div className="text-text-muted text-xs mt-0.5">{ins.geometric_complexity.justification}</div>}
                  </div>
                )}
                {ins.key_cost_driver && (
                  <div className="p-2.5 rounded-lg bg-bg-secondary border border-bg-border">
                    <div className="text-text-muted mb-1">Key Cost Driver</div>
                    <div className="text-text-primary font-semibold">{ins.key_cost_driver}</div>
                  </div>
                )}
                {ins.breakeven_quantity && (
                  <div className="p-2.5 rounded-lg bg-bg-secondary border border-bg-border">
                    <div className="text-text-muted mb-1">AM Break-even Quantity</div>
                    <div className="text-text-primary font-semibold">{ins.breakeven_quantity}</div>
                  </div>
                )}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Save & Export */}
      <div className="card">
        <h3 className="section-title">Save & Export</h3>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-48">
            <label className="label">Project Name</label>
            <input className="input-field" placeholder="e.g. Bracket_v1_316L" value={projectName} onChange={e => setProjectName(e.target.value)} />
          </div>
          <button onClick={saveProject} disabled={saving || !projectName || !state.result} className="btn-primary">
            {saveSuccess ? <><CheckCircle2 size={16} className="text-success" /> Saved!</> : saving ? 'Saving...' : <><Save size={16} /> Save Project</>}
          </button>
          <button onClick={() => doExport('excel')} className="btn-secondary">
            <Download size={16} /> Excel
          </button>
          <button onClick={() => doExport('pdf')} className="btn-secondary">
            <Download size={16} /> PDF
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-bg-border">
        <button onClick={onBack} className="btn-secondary"><ChevronLeft size={16} /> Back</button>
        <div className="flex gap-3">
          <button onClick={runCalc} className="btn-secondary"><RefreshCcw size={16} /> Recalculate</button>
          <button onClick={onReset} className="btn-secondary">New Analysis</button>
        </div>
      </div>
    </div>
  )
}
