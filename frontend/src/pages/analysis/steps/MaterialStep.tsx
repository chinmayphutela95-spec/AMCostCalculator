import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, FlaskConical, Check } from 'lucide-react'
import { materialsApi } from '../../../lib/api'
import type { AnalysisState, Material } from '../../../types'


interface Props {
  state: AnalysisState
  update: (p: Partial<AnalysisState>) => void
  onNext: () => void
  onBack: () => void
}

export function MaterialStep({ state, update, onNext, onBack }: Props) {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [cat, setCat] = useState('')

  useEffect(() => {
    materialsApi.list().then(setMaterials).finally(() => setLoading(false))
  }, [])

  const select = (m: Material) => {
    update({
      selectedMaterialId: m.id,
      selectedMaterial: m,
      materialCostPerKg: m.cost_per_kg,
      materialDensity: m.density,
      materialBuildRate: m.build_rate_cm3_hr,
      layerThicknessUm: m.layer_thickness_um,
      // Update derived mass
      partMass: state.partVolume ? +(state.partVolume * m.density / 1000).toFixed(4) : state.partMass,
    })
  }

  const categories = [...new Set(materials.map(m => m.category))]

  const filtered = materials.filter(m => {
    const matchText = !filter || m.name.toLowerCase().includes(filter.toLowerCase()) || m.alloy_designation.toLowerCase().includes(filter.toLowerCase())
    const matchCat = !cat || m.category === cat
    return matchText && matchCat
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-text-primary font-semibold mb-1">Select Material</h2>
        <p className="text-text-muted text-sm">Choose the metal AM powder material. Cost and density will be used in calculations.</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <input className="input-field flex-1 max-w-xs" placeholder="Search materials..." value={filter} onChange={e => setFilter(e.target.value)} />
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setCat('')} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${!cat ? 'bg-accent-blue/10 border-accent-blue text-accent-blue' : 'border-bg-border text-text-muted hover:border-accent-blue/50'}`}>All</button>
          {categories.map(c => (
            <button key={c} onClick={() => setCat(c === cat ? '' : c)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${cat === c ? 'bg-accent-blue/10 border-accent-blue text-accent-blue' : 'border-bg-border text-text-muted hover:border-accent-blue/50'}`}>{c}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-text-muted">Loading materials...</div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {filtered.map(m => {
            const isSelected = state.selectedMaterialId === m.id
            return (
              <div
                key={m.id}
                onClick={() => select(m)}
                className={`card cursor-pointer transition-all hover:border-accent-blue/50 relative ${isSelected ? 'border-accent-blue bg-accent-blue/5' : ''}`}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-accent-blue flex items-center justify-center">
                    <Check size={12} className="text-white" />
                  </div>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <FlaskConical size={14} className="text-accent-green" />
                  <span className="text-xs font-medium text-text-secondary">{m.category}</span>
                </div>
                <h4 className="text-text-primary font-semibold text-sm mb-0.5">{m.name}</h4>
                {m.alloy_designation && <p className="text-text-muted text-xs mb-2">{m.alloy_designation}</p>}

                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs mt-2 border-t border-bg-border pt-2">
                  <div>
                    <span className="text-text-muted">Cost: </span>
                    <span className="text-text-primary font-medium">${m.cost_per_kg}/kg</span>
                  </div>
                  <div>
                    <span className="text-text-muted">ρ: </span>
                    <span className="text-text-secondary">{m.density} g/cm³</span>
                  </div>
                  <div>
                    <span className="text-text-muted">Layer: </span>
                    <span className="text-text-secondary">{m.layer_thickness_um}µm</span>
                  </div>
                  <div>
                    <span className="text-text-muted">Rate: </span>
                    <span className="text-text-secondary">{m.build_rate_cm3_hr} cm³/hr</span>
                  </div>
                  {m.yield_strength && (
                    <div>
                      <span className="text-text-muted">Yield: </span>
                      <span className="text-text-secondary">{m.yield_strength} MPa</span>
                    </div>
                  )}
                  {m.tensile_strength && (
                    <div>
                      <span className="text-text-muted">UTS: </span>
                      <span className="text-text-secondary">{m.tensile_strength} MPa</span>
                    </div>
                  )}
                  {m.max_service_temp && (
                    <div className="col-span-2">
                      <span className="text-text-muted">Max temp: </span>
                      <span className="text-text-secondary">{m.max_service_temp}°C</span>
                    </div>
                  )}
                </div>
                {m.notes && <p className="text-text-muted text-xs mt-2 leading-relaxed">{m.notes.replace('⚠️ ', '')}</p>}
              </div>
            )
          })}
        </div>
      )}

      {/* Manual override */}
      <div className="card border-bg-border/50">
        <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-3">Override Material Parameters</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Cost ($/kg)</label>
            <input type="number" step="any" className="input-field" value={state.materialCostPerKg}
              onChange={e => update({ materialCostPerKg: +e.target.value })} />
          </div>
          <div>
            <label className="label">Density (g/cm³)</label>
            <input type="number" step="any" className="input-field" value={state.materialDensity}
              onChange={e => update({ materialDensity: +e.target.value, partMass: state.partVolume ? +(state.partVolume * +e.target.value / 1000).toFixed(4) : state.partMass })} />
          </div>
          <div>
            <label className="label">Layer Thickness (µm)</label>
            <input type="number" step="any" className="input-field" value={state.layerThicknessUm}
              onChange={e => update({ layerThicknessUm: +e.target.value })} />
          </div>
          <div>
            <label className="label">Build Rate (cm³/hr)</label>
            <input type="number" step="any" className="input-field" value={state.materialBuildRate}
              onChange={e => update({ materialBuildRate: +e.target.value })} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-bg-border">
        <button onClick={onBack} className="btn-secondary"><ChevronLeft size={16} /> Back</button>
        <button onClick={onNext} disabled={!state.selectedMaterialId} className="btn-primary">
          Continue to Process <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
