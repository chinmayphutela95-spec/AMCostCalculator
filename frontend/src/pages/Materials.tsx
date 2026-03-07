import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, X, FlaskConical, Copy } from 'lucide-react'
import { materialsApi } from '../lib/api'
import type { Material } from '../types'

const CATEGORY_COLORS: Record<string, string> = {
  Steel: 'bg-slate-700/60 text-slate-300',
  Titanium: 'bg-blue-900/50 text-blue-300',
  Aluminum: 'bg-yellow-900/50 text-yellow-300',
  Nickel: 'bg-green-900/50 text-green-300',
  Cobalt: 'bg-purple-900/50 text-purple-300',
  Copper: 'bg-orange-900/50 text-orange-300',
}

const DEFAULT: Partial<Material> = {
  name: '', alloy_designation: '', category: 'Steel',
  process_compatibility: 'LPBF', cost_per_kg: 50, density: 8.0,
  layer_thickness_um: 40, build_rate_cm3_hr: 15,
  yield_strength: undefined, tensile_strength: undefined,
  elongation: undefined, hardness: undefined, max_service_temp: undefined, notes: '',
}

function Field({ label, value, onChange, type = 'text', placeholder = '', note = '' }: {
  label: string; value: any; onChange: (v: any) => void;
  type?: string; placeholder?: string; note?: string
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type={type} step="any" className="input-field"
        value={value ?? ''}
        onChange={e => onChange(type === 'number' ? (e.target.value === '' ? undefined : +e.target.value) : e.target.value)}
        placeholder={placeholder}
      />
      {note && <p className="text-text-muted text-xs mt-0.5">{note}</p>}
    </div>
  )
}

export function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Partial<Material>>(DEFAULT)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('')

  const load = () => materialsApi.list().then(setMaterials).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const openAdd = () => { setEditing({ ...DEFAULT }); setEditingId(null); setShowModal(true) }
  const openEdit = (m: Material) => { setEditing({ ...m }); setEditingId(m.id); setShowModal(true) }
  const openDuplicate = (m: Material) => { setEditing({ ...m, name: m.name + ' (Copy)', is_custom: true }); setEditingId(null); setShowModal(true) }

  const save = async () => {
    setSaving(true)
    try {
      if (editingId) await materialsApi.update(editingId, editing)
      else await materialsApi.create(editing)
      setShowModal(false); load()
    } finally { setSaving(false) }
  }

  const del = async (m: Material) => {
    if (!confirm(`Delete "${m.name}"?`)) return
    await materialsApi.delete(m.id); load()
  }

  const set = (k: string, v: any) => setEditing(e => ({ ...e, [k]: v }))

  const filtered = materials.filter(m =>
    !filter || m.name.toLowerCase().includes(filter.toLowerCase()) ||
    m.category.toLowerCase().includes(filter.toLowerCase()) ||
    m.alloy_designation.toLowerCase().includes(filter.toLowerCase())
  )

  const categories = [...new Set(materials.map(m => m.category))]

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Materials</h1>
          <p className="text-text-secondary mt-1">{materials.length} metal AM materials in database</p>
        </div>
        <div className="flex gap-3">
          <input className="input-field w-48" placeholder="Search..." value={filter} onChange={e => setFilter(e.target.value)} />
          <button onClick={openAdd} className="btn-primary"><Plus size={16} /> Add Material</button>
        </div>
      </div>

      {/* Category filter chips */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <button onClick={() => setFilter('')} className={`badge px-3 py-1 text-xs font-medium rounded-full transition-colors ${!filter ? 'bg-accent-blue text-white' : 'bg-bg-card border border-bg-border text-text-secondary hover:border-accent-blue/50'}`}>
          All ({materials.length})
        </button>
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)} className={`badge px-3 py-1 text-xs font-medium rounded-full transition-colors ${CATEGORY_COLORS[cat] || ''} border border-transparent`}>
            {cat} ({materials.filter(m => m.category === cat).length})
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-20 text-text-muted">Loading...</div> : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bg-border bg-bg-secondary">
                {['Material', 'Category', 'Cost ($/kg)', 'Density', 'Layer (µm)', 'Build Rate', 'Yield (MPa)', 'UTS (MPa)', ''].map(h => (
                  <th key={h} className={`px-4 py-3 text-text-muted font-medium text-xs uppercase ${h === 'Material' ? 'text-left pl-5' : h === 'Category' ? 'text-left' : h ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr key={m.id} className={`border-b border-bg-border hover:bg-bg-hover transition-colors ${i % 2 === 1 ? 'bg-bg-secondary/30' : ''}`}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <FlaskConical size={13} className="text-accent-cyan shrink-0" />
                      <div>
                        <div className="text-text-primary font-medium flex items-center gap-2">
                          {m.name}
                          {m.is_custom && <span className="badge bg-accent-purple/20 text-accent-purple">Custom</span>}
                        </div>
                        {m.alloy_designation && <div className="text-text-muted text-xs">{m.alloy_designation}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${CATEGORY_COLORS[m.category] || 'bg-bg-hover text-text-secondary'}`}>{m.category}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-text-primary font-mono">${m.cost_per_kg}</td>
                  <td className="px-4 py-3 text-right text-text-secondary font-mono">{m.density}</td>
                  <td className="px-4 py-3 text-right text-accent-cyan font-mono">{m.layer_thickness_um ?? 40}</td>
                  <td className="px-4 py-3 text-right text-accent-cyan font-mono">{m.build_rate_cm3_hr ?? 10} cm³/hr</td>
                  <td className="px-4 py-3 text-right text-text-secondary font-mono">{m.yield_strength ?? '–'}</td>
                  <td className="px-4 py-3 text-right text-text-secondary font-mono">{m.tensile_strength ?? '–'}</td>
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
          <div className="bg-bg-card border border-bg-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-bg-border sticky top-0 bg-bg-card z-10">
              <h2 className="text-text-primary font-semibold">{editingId ? 'Edit Material' : 'Add Material'}</h2>
              <button onClick={() => setShowModal(false)}><X size={18} className="text-text-muted" /></button>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Material Name *" value={editing.name} onChange={(v: string) => set('name', v)} placeholder="e.g. 316L Stainless Steel" />
                <Field label="Alloy Designation" value={editing.alloy_designation} onChange={(v: string) => set('alloy_designation', v)} placeholder="e.g. 1.4404" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Category</label>
                  <select className="input-field" value={editing.category} onChange={e => set('category', e.target.value)}>
                    {['Steel', 'Titanium', 'Aluminum', 'Nickel', 'Cobalt', 'Copper'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Process Compatibility</label>
                  <select className="input-field" value={editing.process_compatibility} onChange={e => set('process_compatibility', e.target.value)}>
                    <option value="LPBF">LPBF only</option>
                    <option value="LPBF,EBPBF">LPBF + EB-PBF</option>
                    <option value="EBPBF">EB-PBF only</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Cost ($/kg)" value={editing.cost_per_kg} onChange={(v: number) => set('cost_per_kg', v)} type="number" />
                <Field label="Density (g/cm³)" value={editing.density} onChange={(v: number) => set('density', v)} type="number" />
              </div>
              <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide border-t border-bg-border pt-4">Process Parameters</h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Layer Thickness (µm)" value={editing.layer_thickness_um} onChange={(v: number) => set('layer_thickness_um', v)} type="number" note="Typical: 20–100 µm depending on material" />
                <Field label="Build Rate (cm³/hr)" value={editing.build_rate_cm3_hr} onChange={(v: number) => set('build_rate_cm3_hr', v)} type="number" note="Single-laser volumetric deposition rate" />
              </div>
              <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide border-t border-bg-border pt-4">Mechanical Properties (optional)</h3>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Yield Strength (MPa)" value={editing.yield_strength} onChange={(v: any) => set('yield_strength', v)} type="number" />
                <Field label="Tensile Strength (MPa)" value={editing.tensile_strength} onChange={(v: any) => set('tensile_strength', v)} type="number" />
                <Field label="Elongation (%)" value={editing.elongation} onChange={(v: any) => set('elongation', v)} type="number" />
                <Field label="Hardness (HV)" value={editing.hardness} onChange={(v: any) => set('hardness', v)} type="number" />
                <Field label="Max Service Temp (°C)" value={editing.max_service_temp} onChange={(v: any) => set('max_service_temp', v)} type="number" />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input-field h-20 resize-none" value={editing.notes || ''} onChange={e => set('notes', e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-bg-border sticky bottom-0 bg-bg-card">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving || !editing.name} className="btn-primary">
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Material'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
