import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, X, Cpu, AlertCircle, Copy } from 'lucide-react'
import { machinesApi } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import type { Machine } from '../types'

const DEFAULT_MACHINE: Partial<Machine> = {
  name: '', manufacturer: '', process_type: 'LPBF',
  build_plate_shape: 'rectangular', build_plate_diameter: 25.0,
  build_plate_width: 25.0, build_plate_length: 25.0,
  build_height: 25.0, build_area: 625.0, num_lasers: 1,
  machine_cost: 500000, machine_lifetime: 7, cost_of_capital: 0.05,
  infrastructure_pct: 0.50, maintenance_pct: 0.05, uptime: 0.80,
  packing_policy: '2D', packing_fraction: 0.90, recycling_fraction: 0.90,
  inert_gas_cost: 20.0, consumable_cost_per_build: 75.0,
  first_build_prep_time: 3.0, subsequent_build_prep_time: 0.0,
  setup_time_per_build: 0.75, removal_time_per_build: 0.5,
  warmup_time: 0.5, cooldown_time: 1.0, support_constant: 0.11,
  hours_per_day: 18, days_per_week: 5,
  fte_supervised: 0.15, fte_build_exchange: 1.0, fte_support_removal: 1.0,
  salary_engineer: 70, salary_operator: 50, salary_technician: 30, notes: '',
}

function NumField({ label, value, onChange, pct = false, note = '' }: {
  label: string; value: any; onChange: (v: number) => void; pct?: boolean; note?: string
}) {
  return (
    <div>
      <label className="label">{label}{pct ? ' (%)' : ''}</label>
      <input
        type="number" step="any" className="input-field"
        value={pct ? +(+(value ?? 0) * 100).toFixed(4) : (value ?? '')}
        onChange={e => onChange(pct ? +e.target.value / 100 : +e.target.value)}
      />
      {note && <p className="text-text-muted text-xs mt-0.5">{note}</p>}
    </div>
  )
}

export function MachinesPage() {
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Partial<Machine>>(DEFAULT_MACHINE)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const load = () => machinesApi.list().then(setMachines).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const openAdd = () => { setEditing({ ...DEFAULT_MACHINE }); setEditingId(null); setShowModal(true) }
  const openEdit = (m: Machine) => { setEditing({ ...m }); setEditingId(m.id); setShowModal(true) }
  const openDuplicate = (m: Machine) => { setEditing({ ...m, name: m.name + ' (Copy)', is_custom: true }); setEditingId(null); setShowModal(true) }

  const save = async () => {
    setSaving(true)
    try {
      if (editingId) await machinesApi.update(editingId, editing)
      else await machinesApi.create(editing)
      setShowModal(false); load()
    } finally { setSaving(false) }
  }

  const del = async (m: Machine) => {
    if (!confirm(`Delete "${m.name}"?`)) return
    await machinesApi.delete(m.id); load()
  }

  const set = (key: string, val: any) => setEditing(e => ({ ...e, [key]: val }))

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Machines</h1>
          <p className="text-text-secondary mt-1">{machines.length} LPBF machines configured</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus size={16} /> Add Machine</button>
      </div>

      {loading ? <div className="text-center py-20 text-text-muted">Loading...</div> : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bg-border bg-bg-secondary">
                {['Machine', 'Build Area', 'Height', 'Lasers', 'Machine Cost', 'Inert Gas', ''].map(h => (
                  <th key={h} className={`px-4 py-3 text-text-muted font-medium text-xs uppercase ${h === 'Machine' ? 'text-left pl-5' : h ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {machines.map((m, i) => (
                <tr key={m.id} className={`border-b border-bg-border hover:bg-bg-hover transition-colors ${i % 2 === 1 ? 'bg-bg-secondary/30' : ''}`}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Cpu size={14} className="text-accent-blue shrink-0" />
                      <div>
                        <div className="text-text-primary font-medium flex items-center gap-2">
                          {m.name}
                          {m.is_custom && <span className="badge bg-accent-purple/20 text-accent-purple">Custom</span>}
                        </div>
                        <div className="text-text-muted text-xs">{m.manufacturer} · {m.process_type}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary font-mono text-xs">
                    {m.build_area.toFixed(0)} cm²
                    {m.build_plate_shape === 'circular' && <div className="text-text-muted">⌀{m.build_plate_diameter} cm</div>}
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary font-mono text-xs">{m.build_height} cm</td>
                  <td className="px-4 py-3 text-right text-text-secondary font-mono text-xs">{m.num_lasers ?? 1}</td>
                  <td className="px-4 py-3 text-right text-text-primary font-mono text-xs">{formatCurrency(m.machine_cost)}</td>
                  <td className="px-4 py-3 text-right text-text-secondary font-mono text-xs">${m.inert_gas_cost}/hr</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openDuplicate(m)} title="Duplicate" className="text-text-muted hover:text-accent-cyan p-1.5 rounded transition-colors"><Copy size={13} /></button>
                      <button onClick={() => openEdit(m)} title="Edit" className="text-text-muted hover:text-accent-blue p-1.5 rounded transition-colors"><Pencil size={13} /></button>
                      <button onClick={() => del(m)} title="Delete" className="text-text-muted hover:text-danger p-1.5 rounded transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-bg-card border border-bg-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-bg-border sticky top-0 bg-bg-card z-10">
              <h2 className="text-text-primary font-semibold">{editingId ? 'Edit Machine' : 'Add Machine'}</h2>
              <button onClick={() => setShowModal(false)} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-6">
              {/* Basic */}
              <div>
                <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-3 border-b border-bg-border pb-2">Basic Info</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="label">Machine Name *</label>
                    <input className="input-field" value={editing.name || ''} onChange={e => set('name', e.target.value)} placeholder="e.g. EOS M290" />
                  </div>
                  <div>
                    <label className="label">Manufacturer</label>
                    <input className="input-field" value={editing.manufacturer || ''} onChange={e => set('manufacturer', e.target.value)} placeholder="e.g. EOS" />
                  </div>
                </div>
              </div>

              {/* Build Volume */}
              <div>
                <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-3 border-b border-bg-border pb-2">Build Volume</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="label">Plate Shape</label>
                    <select className="input-field" value={editing.build_plate_shape} onChange={e => set('build_plate_shape', e.target.value)}>
                      <option value="rectangular">Rectangular</option>
                      <option value="circular">Circular</option>
                    </select>
                  </div>
                  {editing.build_plate_shape === 'circular' ? (
                    <NumField label="Diameter (cm)" value={editing.build_plate_diameter} onChange={(v) => { set('build_plate_diameter', v); set('build_area', +(Math.PI * (v / 2) ** 2).toFixed(2)) }} />
                  ) : (
                    <>
                      <NumField label="Width (cm)" value={editing.build_plate_width} onChange={(v) => { set('build_plate_width', v); set('build_area', +((editing.build_plate_length || 0) * v).toFixed(2)) }} />
                      <NumField label="Length (cm)" value={editing.build_plate_length} onChange={(v) => { set('build_plate_length', v); set('build_area', +((editing.build_plate_width || 0) * v).toFixed(2)) }} />
                    </>
                  )}
                  <NumField label="Build Height (cm)" value={editing.build_height} onChange={(v) => set('build_height', v)} />
                  <div>
                    <label className="label">Build Area (cm²)</label>
                    <input className="input-field bg-bg-primary text-text-muted cursor-not-allowed" value={(editing.build_area || 0).toFixed(2)} readOnly />
                    <p className="text-text-muted text-xs mt-0.5">Auto-calculated</p>
                  </div>
                  <NumField label="Number of Lasers" value={editing.num_lasers ?? 1} onChange={(v) => set('num_lasers', Math.max(1, Math.round(v)))} note="Available laser beams (e.g. 1, 2, 4)" />
                </div>
              </div>

              {/* Economics */}
              <div>
                <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-3 border-b border-bg-border pb-2">Machine Economics</h3>
                <div className="grid grid-cols-3 gap-4">
                  <NumField label="Purchase Cost ($)" value={editing.machine_cost} onChange={(v) => set('machine_cost', v)} />
                  <NumField label="Lifetime (years)" value={editing.machine_lifetime} onChange={(v) => set('machine_lifetime', v)} />
                  <NumField label="Cost of Capital" value={editing.cost_of_capital} onChange={(v) => set('cost_of_capital', v)} pct note="Annual interest rate" />
                  <NumField label="Infrastructure" value={editing.infrastructure_pct} onChange={(v) => set('infrastructure_pct', v)} pct note="% of machine cost (upfront)" />
                  <NumField label="Maintenance" value={editing.maintenance_pct} onChange={(v) => set('maintenance_pct', v)} pct note="% of machine cost / year" />
                  <NumField label="Uptime" value={editing.uptime} onChange={(v) => set('uptime', v)} pct note="Machine availability" />
                </div>
              </div>

              {/* Packing */}
              <div>
                <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-3 border-b border-bg-border pb-2">Packing & Material</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="label">Packing Policy</label>
                    <select className="input-field" value={editing.packing_policy} onChange={e => set('packing_policy', e.target.value)}>
                      <option value="2D">2D (standard LPBF)</option>
                      <option value="3D">3D (stacked layers)</option>
                    </select>
                  </div>
                  <NumField label="Packing Fraction" value={editing.packing_fraction} onChange={(v) => set('packing_fraction', v)} pct />
                  <NumField label="Powder Recycling" value={editing.recycling_fraction} onChange={(v) => set('recycling_fraction', v)} pct note="% of unused powder reused" />
                </div>
              </div>

              {/* Consumables */}
              <div>
                <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-3 border-b border-bg-border pb-2">Consumables</h3>
                <div className="grid grid-cols-2 gap-4">
                  <NumField label="Inert Gas Cost ($/hr)" value={editing.inert_gas_cost} onChange={(v) => set('inert_gas_cost', v)} note="Argon / Nitrogen during build" />
                  <NumField label="Consumable per Build ($)" value={editing.consumable_cost_per_build} onChange={(v) => set('consumable_cost_per_build', v)} note="Build plate, filters, wiper blade" />
                </div>
              </div>

              {/* Time */}
              <div>
                <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-3 border-b border-bg-border pb-2">Build Time Parameters (hours)</h3>
                <div className="grid grid-cols-3 gap-4">
                  <NumField label="First Build Prep" value={editing.first_build_prep_time} onChange={(v) => set('first_build_prep_time', v)} />
                  <NumField label="Subsequent Build Prep" value={editing.subsequent_build_prep_time} onChange={(v) => set('subsequent_build_prep_time', v)} />
                  <NumField label="Setup per Build" value={editing.setup_time_per_build} onChange={(v) => set('setup_time_per_build', v)} />
                  <NumField label="Removal per Build" value={editing.removal_time_per_build} onChange={(v) => set('removal_time_per_build', v)} />
                  <NumField label="Warm-up" value={editing.warmup_time} onChange={(v) => set('warmup_time', v)} />
                  <NumField label="Cool-down" value={editing.cooldown_time} onChange={(v) => set('cooldown_time', v)} />
                </div>
              </div>

              {/* Labor */}
              <div>
                <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-3 border-b border-bg-border pb-2">Operations & Labor</h3>
                <div className="grid grid-cols-3 gap-4">
                  <NumField label="Hours/Day" value={editing.hours_per_day} onChange={(v) => set('hours_per_day', v)} />
                  <NumField label="Days/Week" value={editing.days_per_week} onChange={(v) => set('days_per_week', v)} />
                  <NumField label="Support Constant (c)" value={editing.support_constant} onChange={(v) => set('support_constant', v)} note="t = c × √A (support removal)" />
                  <NumField label="FTE Supervised" value={editing.fte_supervised} onChange={(v) => set('fte_supervised', v)} pct note="During build" />
                  <NumField label="FTE Build Exchange" value={editing.fte_build_exchange} onChange={(v) => set('fte_build_exchange', v)} pct />
                  <NumField label="FTE Support Removal" value={editing.fte_support_removal} onChange={(v) => set('fte_support_removal', v)} pct />
                  <NumField label="Engineer Salary ($/hr)" value={editing.salary_engineer} onChange={(v) => set('salary_engineer', v)} />
                  <NumField label="Operator Salary ($/hr)" value={editing.salary_operator} onChange={(v) => set('salary_operator', v)} />
                  <NumField label="Technician Salary ($/hr)" value={editing.salary_technician} onChange={(v) => set('salary_technician', v)} />
                </div>
              </div>

              {/* Recoater */}
              <div>
                <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-3 border-b border-bg-border pb-2">Recoater Configuration (optional)</h3>
                <p className="text-text-muted text-xs mb-3">
                  When set, recoating time is calculated from first principles: <span className="font-mono">recoat_time = distance / speed</span> per layer.
                  Leave blank to use a recoating efficiency factor in the analysis wizard instead.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <NumField
                    label="Chamber Travel Distance (mm)"
                    value={editing.recoating_distance_mm ?? ''}
                    onChange={(v) => set('recoating_distance_mm', v || null)}
                    note="Full end-to-end distance incl. margins (e.g. 250 for Aconity Midi+)"
                  />
                  <NumField
                    label="Recoater Speed (mm/s)"
                    value={editing.recoating_speed_mm_s ?? ''}
                    onChange={(v) => set('recoating_speed_mm_s', v || null)}
                    note="Average speed across the full stroke"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="label">Notes</label>
                <textarea className="input-field h-20 resize-none" value={editing.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Additional notes..." />
              </div>

              {(editing.notes || '').includes('⚠️') && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
                  <AlertCircle size={14} className="text-warning shrink-0 mt-0.5" />
                  <p className="text-warning text-xs">{editing.notes}</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-bg-border sticky bottom-0 bg-bg-card">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving || !editing.name} className="btn-primary">
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Machine'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
