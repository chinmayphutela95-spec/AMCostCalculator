import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Cpu, Check, AlertCircle } from 'lucide-react'
import { machinesApi } from '../../../lib/api'
import { formatCurrency } from '../../../lib/utils'
import type { AnalysisState, Machine } from '../../../types'

interface Props {
  state: AnalysisState
  update: (p: Partial<AnalysisState>) => void
  onNext: () => void
  onBack: () => void
}

export function MachineStep({ state, update, onNext, onBack }: Props) {
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [compare, setCompare] = useState<Set<number>>(new Set(state.compareIds ?? []))
  const machinesRef = useRef<Machine[]>([])

  useEffect(() => {
    machinesApi.list().then(data => {
      setMachines(data)
      machinesRef.current = data
    }).finally(() => setLoading(false))
  }, [])

  const select = (m: Machine) => {
    update({ selectedMachineId: m.id, selectedMachine: m })
  }

  const toggleCompare = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const ns = new Set(compare)
    if (ns.has(id)) ns.delete(id)
    else if (ns.size < 3) ns.add(id)
    setCompare(ns)
    update({
      compareIds: [...ns],
      compareMachines: machinesRef.current.filter((m: Machine) => ns.has(m.id)),
    })
  }

  const grouped = machines.reduce((acc, m) => {
    const key = m.manufacturer || 'Other'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {} as Record<string, Machine[]>)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-text-primary font-semibold mb-1">Select Machine</h2>
        <p className="text-text-muted text-sm">Choose the LPBF machine for cost calculation. Tip: you can also select multiple for comparison.</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-text-muted">Loading machines...</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([mfr, mfr_machines]) => (
            <div key={mfr}>
              <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-blue" />
                {mfr}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {mfr_machines.map(m => {
                  const isSelected = state.selectedMachineId === m.id
                  const isCompare = compare.has(m.id)
                  const buildVol = ((m.build_area * m.build_height) / 1000).toFixed(1)
                  const hasWarning = m.notes?.includes('⚠️')

                  return (
                    <div
                      key={m.id}
                      onClick={() => select(m)}
                      className={`card cursor-pointer transition-all hover:border-accent-blue/50 relative ${
                        isSelected ? 'border-accent-blue bg-accent-blue/5 glow-blue' : ''
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-accent-blue flex items-center justify-center">
                          <Check size={12} className="text-white" />
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-accent-blue/20' : 'bg-bg-secondary'}`}>
                          <Cpu size={16} className={isSelected ? 'text-accent-blue' : 'text-text-muted'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-text-primary font-semibold text-sm">{m.name}</h4>
                            {hasWarning && <AlertCircle size={13} className="text-warning shrink-0" />}
                            {m.is_custom && <span className="badge bg-accent-purple/20 text-accent-purple text-xs">Custom</span>}
                          </div>

                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs">
                            <div>
                              <span className="text-text-muted">Build plate: </span>
                              <span className="text-text-secondary">
                                {m.build_plate_shape === 'circular'
                                  ? `⌀${(m.build_plate_diameter || 0) * 10}mm`
                                  : `${(m.build_plate_width || 0) * 10}×${(m.build_plate_length || 0) * 10}mm`}
                              </span>
                            </div>
                            <div>
                              <span className="text-text-muted">Height: </span>
                              <span className="text-text-secondary">{m.build_height * 10}mm</span>
                            </div>
                            <div>
                              <span className="text-text-muted">Volume: </span>
                              <span className="text-text-secondary">{buildVol}L</span>
                            </div>
                            <div>
                              <span className="text-text-muted">Lasers: </span>
                              <span className={`font-medium ${(m.num_lasers ?? 1) > 1 ? 'text-accent-purple' : 'text-text-secondary'}`}>
                                {m.num_lasers ?? 1}{(m.num_lasers ?? 1) > 1 ? ' ✦' : ''}
                              </span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-text-muted">Cost: </span>
                              <span className="text-text-primary font-medium">{formatCurrency(m.machine_cost)}</span>
                            </div>
                          </div>

                          <button
                            onClick={(e) => toggleCompare(m.id, e)}
                            className={`mt-2 text-xs px-2.5 py-0.5 rounded border transition-colors ${
                              isCompare ? 'border-accent-cyan/50 text-accent-cyan bg-accent-cyan/10' : 'border-bg-border text-text-muted hover:border-accent-cyan/50'
                            }`}
                          >
                            {isCompare ? '✓ In comparison' : 'Add to compare'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {compare.size > 0 && (
        <div className="p-3 rounded-lg bg-accent-cyan/10 border border-accent-cyan/30 text-xs text-accent-cyan">
          {compare.size} machine{compare.size > 1 ? 's' : ''} selected for comparison. Results will show a side-by-side cost breakdown.
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-bg-border">
        <button onClick={onBack} className="btn-secondary"><ChevronLeft size={16} /> Back</button>
        <button onClick={onNext} disabled={!state.selectedMachineId} className="btn-primary">
          Continue to Material <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
