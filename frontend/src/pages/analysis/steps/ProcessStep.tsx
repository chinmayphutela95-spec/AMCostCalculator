import { ChevronLeft, ChevronRight, Info } from 'lucide-react'
import type { AnalysisState } from '../../../types'

interface Props {
  state: AnalysisState
  update: (p: Partial<AnalysisState>) => void
  onNext: () => void
  onBack: () => void
}

function Toggle({ label, checked, onChange, note }: { label: string; checked: boolean; onChange: (v: boolean) => void; note?: string }) {
  return (
    <div className="flex items-start gap-3">
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 mt-0.5 ${checked ? 'bg-accent-blue' : 'bg-bg-border'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
      <div>
        <div className="text-text-primary text-sm font-medium">{label}</div>
        {note && <p className="text-text-muted text-xs mt-0.5">{note}</p>}
      </div>
    </div>
  )
}

function NumInput({ label, value, onChange, unit, note }: { label: string; value: number; onChange: (v: number) => void; unit: string; note?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <input type="number" step="any" className="input-field pr-16" value={value} onChange={e => onChange(+e.target.value)} />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">{unit}</span>
      </div>
      {note && <p className="text-text-muted text-xs mt-0.5">{note}</p>}
    </div>
  )
}

export function ProcessStep({ state, update, onNext, onBack }: Props) {
  const m = state.selectedMachine

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-text-primary font-semibold mb-1">Process & Operations Parameters</h2>
        <p className="text-text-muted text-sm">Review machine defaults and configure Metal AM-specific post-processing costs.</p>
      </div>

      {/* Machine defaults preview */}
      {m && (
        <div className="card border-accent-blue/20">
          <div className="flex items-center gap-2 mb-3">
            <Info size={14} className="text-accent-blue" />
            <span className="text-accent-blue text-xs font-semibold uppercase tracking-wide">Machine Defaults: {m.name}</span>
          </div>
          <div className="grid grid-cols-4 gap-3 text-xs">
            {[
              ['Inert Gas', `$${m.inert_gas_cost}/hr`],
              ['Consumable/build', `$${m.consumable_cost_per_build}`],
              ['Hours/day', `${m.hours_per_day} hr`],
              ['Uptime', `${(m.uptime * 100).toFixed(0)}%`],
              ['Packing', m.packing_policy],
              ['Recycling', `${(m.recycling_fraction * 100).toFixed(0)}%`],
              ['Engineer', `$${m.salary_engineer}/hr`],
              ['Operator', `$${m.salary_operator}/hr`],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5">
                <span className="text-text-muted">{k}</span>
                <span className="text-text-primary font-medium">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Multi-laser configuration */}
      {m && m.num_lasers > 1 && (
        <div>
          <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-3 border-b border-bg-border pb-2">
            Multi-Laser Configuration — {m.name} has {m.num_lasers} lasers
          </h3>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {([
              { value: 'single', label: 'Single Laser', desc: 'One laser active per build. Standard throughput.' },
              { value: 'multi_per_part', label: 'Multi-Laser Per Part', desc: 'Multiple lasers work simultaneously on each part, reducing per-part print time.' },
              { value: 'multi_zones', label: 'Parallel Zones', desc: 'Build plate divided into zones; each laser handles a zone in parallel for higher throughput.' },
            ] as const).map(opt => (
              <button
                key={opt.value}
                onClick={() => update({ laserStrategy: opt.value, lasersPerPart: opt.value === 'single' ? 1 : Math.min(state.lasersPerPart || 2, m.num_lasers) })}
                className={`card text-left transition-all hover:border-accent-purple/50 ${state.laserStrategy === opt.value ? 'border-accent-purple bg-accent-purple/5' : ''}`}
              >
                <div className={`text-sm font-semibold mb-1 ${state.laserStrategy === opt.value ? 'text-accent-purple' : 'text-text-primary'}`}>{opt.label}</div>
                <p className="text-text-muted text-xs leading-relaxed">{opt.desc}</p>
              </button>
            ))}
          </div>

          {state.laserStrategy !== 'single' && (
            <div className="card border-accent-purple/20 bg-accent-purple/5">
              <div className="flex items-end gap-6">
                <div className="flex-1">
                  <label className="label">Lasers engaged ({state.laserStrategy === 'multi_per_part' ? 'per part' : 'total zones'})</label>
                  <div className="flex items-center gap-3 mt-1">
                    <input
                      type="range"
                      min={1}
                      max={m.num_lasers}
                      value={state.lasersPerPart}
                      onChange={e => update({ lasersPerPart: +e.target.value })}
                      className="flex-1"
                    />
                    <span className="text-accent-purple font-bold text-lg w-8 text-center">{state.lasersPerPart}</span>
                    <span className="text-text-muted text-xs">/ {m.num_lasers}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-text-muted text-xs mb-0.5">Effective build rate</div>
                  <div className="text-accent-cyan font-mono font-bold text-lg">
                    {(state.materialBuildRate * state.lasersPerPart).toFixed(1)} cm³/hr
                  </div>
                  <div className="text-text-muted text-xs">{state.lasersPerPart}× speedup vs single</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recoating */}
      <div>
        <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-3 border-b border-bg-border pb-2">Recoating Time</h3>
        {m && m.recoating_distance_mm && m.recoating_speed_mm_s ? (
          // First-principles: machine has distance + speed configured
          <div className="card border-accent-cyan/20 bg-accent-cyan/5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-accent-cyan text-xs font-semibold uppercase tracking-wide">First-Principles Calculation Active</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <div className="text-text-muted">Chamber travel</div>
                <div className="text-text-primary font-mono font-medium">{m.recoating_distance_mm} mm</div>
              </div>
              <div>
                <div className="text-text-muted">Recoater speed</div>
                <div className="text-text-primary font-mono font-medium">{m.recoating_speed_mm_s} mm/s</div>
              </div>
              <div>
                <div className="text-text-muted">Time per layer</div>
                <div className="text-accent-cyan font-mono font-medium">
                  {((m.recoating_distance_mm / m.recoating_speed_mm_s)).toFixed(1)} s
                </div>
              </div>
            </div>
            <p className="text-text-muted text-xs mt-2">
              Recoating overhead is computed per build from layer count × time per layer.
              To override, update the machine's recoater configuration.
            </p>
          </div>
        ) : (
          // Fallback: efficiency factor slider
          <div className="card border-bg-border/50">
            <div className="flex items-start justify-between mb-3">
              <p className="text-text-muted text-xs">
                No recoater parameters set for this machine. Use an efficiency factor to account for recoating overhead
                (recoating = scan time × (1/efficiency − 1)).
              </p>
              {Math.round((state.recoatingEfficiency ?? 0.75) * 100) !== 75 && (
                <button
                  onClick={() => update({ recoatingEfficiency: 0.75 })}
                  className="ml-3 shrink-0 text-xs text-accent-cyan border border-accent-cyan/30 rounded px-2 py-0.5 hover:bg-accent-cyan/10 transition-colors"
                >
                  Reset to 75%
                </button>
              )}
            </div>
            <div className="flex items-end gap-6">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Recoating Efficiency</label>
                  <span className="text-xs text-text-muted">
                    Recommended: <span className="text-accent-cyan font-medium">75%</span>
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <input
                    type="range" min={50} max={100} step={1}
                    value={Math.round((state.recoatingEfficiency ?? 0.75) * 100)}
                    onChange={e => update({ recoatingEfficiency: +e.target.value / 100 })}
                    className="flex-1"
                  />
                  <span className="text-accent-cyan font-mono font-bold text-lg w-12 text-center">
                    {Math.round((state.recoatingEfficiency ?? 0.75) * 100)}%
                  </span>
                </div>
                <div className="flex justify-between text-text-muted text-xs mt-0.5">
                  <span>50% (heavy overhead)</span>
                  <span>100% (no overhead)</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-text-muted text-xs mb-0.5">Recoating adds</div>
                <div className="text-accent-cyan font-mono font-bold text-lg">
                  {(state.recoatingEfficiency ?? 0.75) < 1.0
                    ? `+${((1 / (state.recoatingEfficiency ?? 0.75) - 1) * 100).toFixed(0)}%`
                    : 'None'}
                </div>
                <div className="text-text-muted text-xs">to print time</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Overrides */}
      <div>
        <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-3 border-b border-bg-border pb-2">Override Machine Defaults (optional)</h3>
        <div className="grid grid-cols-3 gap-4">
          <NumInput label="Inert Gas Cost" value={state.inertGasCost ?? m?.inert_gas_cost ?? 20} onChange={v => update({ inertGasCost: v })} unit="$/hr" note="Argon / Nitrogen" />
          <NumInput label="Consumable / Build" value={state.consumableCostPerBuild ?? m?.consumable_cost_per_build ?? 75} onChange={v => update({ consumableCostPerBuild: v })} unit="$" note="Build plate, filters" />
          <NumInput label="Hours / Day" value={state.hoursPerDay ?? m?.hours_per_day ?? 18} onChange={v => update({ hoursPerDay: v })} unit="hr" />
          <NumInput label="Engineer Salary" value={state.salaryEngineer ?? m?.salary_engineer ?? 70} onChange={v => update({ salaryEngineer: v })} unit="$/hr" />
          <NumInput label="Operator Salary" value={state.salaryOperator ?? m?.salary_operator ?? 50} onChange={v => update({ salaryOperator: v })} unit="$/hr" />
          <NumInput label="Technician Salary" value={state.salaryTechnician ?? m?.salary_technician ?? 30} onChange={v => update({ salaryTechnician: v })} unit="$/hr" />
        </div>
      </div>

      {/* Metal AM extensions */}
      <div>
        <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-4 border-b border-bg-border pb-2">Metal AM Post-Processing Costs</h3>
        <div className="space-y-5">

          {/* Heat Treatment */}
          <div className="card border-bg-border/50">
            <div className="flex items-start justify-between gap-4 mb-3">
              <Toggle
                label="Heat Treatment (Stress Relief)"
                checked={state.heatTreatmentEnabled}
                onChange={v => update({ heatTreatmentEnabled: v })}
                note="Mandatory for most LPBF metal parts to relieve residual stresses before removal from build plate"
              />
            </div>
            {state.heatTreatmentEnabled && (
              <NumInput label="Cost per Build" value={state.heatTreatmentCostPerBuild} onChange={v => update({ heatTreatmentCostPerBuild: v })} unit="$" note="Typically $200–$800 per furnace run" />
            )}
          </div>

          {/* Part Separation */}
          <div className="card border-bg-border/50">
            <div className="mb-3">
              <Toggle
                label="Part Separation (from Build Plate)"
                checked={state.partSeparationEnabled}
                onChange={v => update({ partSeparationEnabled: v })}
                note="Wire EDM, band saw, or CNC machining to remove parts from the build plate"
              />
            </div>
            {state.partSeparationEnabled && (
              <NumInput label="Cost per Part" value={state.partSeparationCostPerPart} onChange={v => update({ partSeparationCostPerPart: v })} unit="$" note="Wire EDM: $50–$500 · Band saw: $10–$50" />
            )}
          </div>

          {/* HIP */}
          <div className="card border-bg-border/50">
            <div className="mb-3">
              <Toggle
                label="HIP (Hot Isostatic Pressing)"
                checked={state.hipEnabled}
                onChange={v => update({ hipEnabled: v })}
                note="Reduces internal porosity — required for fatigue-critical aerospace/medical components"
              />
            </div>
            {state.hipEnabled && (
              <NumInput label="Cost per Part" value={state.hipCostPerPart} onChange={v => update({ hipCostPerPart: v })} unit="$" note="Typically $50–$500/part depending on size" />
            )}
          </div>

          {/* Surface Treatment */}
          <div className="card border-bg-border/50">
            <div className="mb-3">
              <Toggle
                label="Surface Treatment"
                checked={state.surfaceTreatmentEnabled}
                onChange={v => update({ surfaceTreatmentEnabled: v })}
                note="Shot peening, electropolishing, tumbling, or CNC finish machining"
              />
            </div>
            {state.surfaceTreatmentEnabled && (
              <NumInput label="Cost per Part" value={state.surfaceTreatmentCostPerPart} onChange={v => update({ surfaceTreatmentCostPerPart: v })} unit="$" note="Shot peening: $5–$50 · Electropolishing: $20–$200" />
            )}
          </div>

          {/* NDT */}
          <div className="card border-bg-border/50">
            <div className="mb-3">
              <Toggle
                label="NDT / Quality Inspection"
                checked={state.ndtEnabled}
                onChange={v => update({ ndtEnabled: v })}
                note="CT scanning, CMM measurement, visual/dimensional inspection"
              />
            </div>
            {state.ndtEnabled && (
              <NumInput label="Cost per Part" value={state.ndtCostPerPart} onChange={v => update({ ndtCostPerPart: v })} unit="$" note="CT scan: $100–$500 · CMM: $50–$200" />
            )}
          </div>
        </div>
      </div>

      {/* Build Packing */}
      {m && (() => {
        const partFits = state.partHeight <= 0 || state.partHeight <= m.build_height
        const suggestedLayers = m.packing_policy === '3D' && state.partHeight > 0
          ? Math.floor(m.build_height / state.partHeight)
          : 1
        const perLayer = state.partProjectedArea > 0
          ? Math.floor(m.build_area / state.partProjectedArea * m.packing_fraction)
          : 1
        const suggestedPpb = Math.max(1, perLayer * suggestedLayers)
        const effective = state.partsPerBuildOverride ?? suggestedPpb

        return (
          <div>
            <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-3 border-b border-bg-border pb-2">Build Packing</h3>
            {!partFits && (
              <div className="card border-danger/40 bg-danger/5 mb-3 text-sm text-danger">
                ⚠ Part height ({(state.partHeight * 10).toFixed(1)} mm) exceeds machine build height ({(m.build_height * 10).toFixed(0)} mm) — the part does not fit in this machine.
              </div>
            )}
            <div className="card border-bg-border/50">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-text-primary text-sm font-medium">Suggested Parts per Build</div>
                  <div className="text-text-muted text-xs mt-0.5">
                    {m.packing_policy === '3D'
                      ? `${suggestedLayers} layer${suggestedLayers !== 1 ? 's' : ''} × ${perLayer} per layer`
                      : `${perLayer} per layer`}
                    {' · '}{m.packing_policy} packing at {(m.packing_fraction * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-text-muted text-xs mb-0.5">{state.partsPerBuildOverride ? 'Overridden' : 'Auto'}</div>
                  <div className={`font-mono font-bold text-2xl ${state.partsPerBuildOverride ? 'text-accent-purple' : 'text-accent-cyan'}`}>
                    {effective}
                  </div>
                  {state.partsPerBuildOverride && (
                    <div className="text-text-muted text-xs">auto: {suggestedPpb}</div>
                  )}
                </div>
              </div>
              <div>
                <label className="label">Override parts per build (optional)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" step="1" min="1"
                    className="input-field flex-1"
                    placeholder={`Auto: ${suggestedPpb}`}
                    value={state.partsPerBuildOverride ?? ''}
                    onChange={e => update({ partsPerBuildOverride: e.target.value === '' ? undefined : Math.max(1, +e.target.value) })}
                  />
                  {state.partsPerBuildOverride && (
                    <button onClick={() => update({ partsPerBuildOverride: undefined })} className="btn-secondary text-xs px-3">Reset</button>
                  )}
                </div>
                <p className="text-text-muted text-xs mt-1">
                  Override if you can achieve better nesting by reorienting or manually arranging parts on the build plate.
                </p>
              </div>
            </div>
          </div>
        )
      })()}

      <div className="flex items-center justify-between pt-4 border-t border-bg-border">
        <button onClick={onBack} className="btn-secondary"><ChevronLeft size={16} /> Back</button>
        <button onClick={onNext} className="btn-primary">
          Calculate Cost <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
