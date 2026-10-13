import { useEffect, useState } from 'react'
import { Trash2, FolderOpen, Clock, ChevronRight, X, Download, User } from 'lucide-react'
import { projectsApi, exportApi, apiErrorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatCurrency } from '../lib/utils'
import type { Project } from '../types'

export function HistoryPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Project | null>(null)
  const { me } = useAuth()

  const load = () => projectsApi.list().then(setProjects).finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  // The list is a summary; fetch the full record (inputs, AI insights) for the detail panel
  const select = (p: Project) => {
    setSelected(p)
    projectsApi.get(p.id).then(full => setSelected(s => (s?.id === p.id ? full : s))).catch(() => {})
  }

  // Projects are shared team-wide; only the creator or an admin may delete
  const canDelete = (p: Project) => !!me && (me.is_admin || (!!p.created_by && p.created_by === me.id))

  const del = async (id: number) => {
    if (!confirm('Delete this project?')) return
    try {
      await projectsApi.delete(id)
    } catch (e) {
      alert(apiErrorMessage(e, 'Could not delete the project'))
      return
    }
    load()
    if (selected?.id === id) setSelected(null)
  }

  const downloadExport = async (id: number, name: string, format: 'excel' | 'pdf') => {
    try {
      const resp = await exportApi.exportProject(id, format)
      const blob = new Blob([resp.data], { type: resp.headers['content-type'] })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const safe = name.replace(/[^a-zA-Z0-9_-]/g, '_')
      a.download = `${safe}.${format === 'excel' ? 'xlsx' : 'pdf'}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) { console.error(e) }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Saved Projects</h1>
        <p className="text-text-secondary mt-1">
          {projects.length} saved cost analyses{me?.auth_enabled ? ' · shared with your team' : ''}
        </p>
      </div>

      {loading ? (
        <div className="text-center py-20 text-text-muted">Loading...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <FolderOpen size={48} className="text-text-muted mx-auto mb-4" />
          <p className="text-text-secondary">No saved projects yet</p>
          <p className="text-text-muted text-sm mt-1">Run a cost analysis and save it to see it here</p>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* List */}
          <div className="flex-1 space-y-2">
            {projects.map(p => {
              let results: any = {}
              try { results = JSON.parse(p.results_json) } catch {}
              const cpp = results?.cost_per_part
              const run = results?.num_builds ? `${results.parts_per_build} parts/build` : ''
              return (
                <div
                  key={p.id}
                  onClick={() => select(p)}
                  className={`card cursor-pointer hover:border-accent-blue/50 transition-colors ${selected?.id === p.id ? 'border-accent-blue/50 bg-accent-blue/5' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-text-primary font-medium text-sm">{p.name}</h3>
                        {p.part_file_name && <span className="badge bg-accent-blue/10 text-accent-blue">{p.part_file_name.split('.').pop()?.toUpperCase()}</span>}
                      </div>
                      {p.description && <p className="text-text-muted text-xs mt-1 truncate">{p.description}</p>}
                      <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
                        <span className="flex items-center gap-1"><Clock size={11} />{new Date(p.created_at).toLocaleDateString()}</span>
                        {p.created_by_email && <span className="flex items-center gap-1 truncate"><User size={11} />{p.created_by_email}</span>}
                        {run && <span>{run}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      {cpp != null && (
                        <div className="text-right">
                          <div className="text-accent-cyan font-mono font-bold">{formatCurrency(cpp, 2)}</div>
                          <div className="text-text-muted text-xs">per part</div>
                        </div>
                      )}
                      {canDelete(p) && (
                        <button onClick={e => { e.stopPropagation(); del(p.id) }} className="text-text-muted hover:text-danger transition-colors p-1">
                          <Trash2 size={14} />
                        </button>
                      )}
                      <ChevronRight size={14} className="text-text-muted" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Detail panel */}
          {selected && (() => {
            let results: any = {}
            let inputs: any = {}
            let ai: any = {}
            try { results = JSON.parse(selected.results_json) } catch {}
            try { inputs = JSON.parse(selected.inputs_json ?? '{}') } catch {}
            try { ai = JSON.parse(selected.ai_insights_json ?? '{}') } catch {}
            return (
              <div className="w-80 card h-fit">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-text-primary text-sm">{selected.name}</h3>
                  <button onClick={() => setSelected(null)} className="text-text-muted hover:text-text-primary"><X size={16} /></button>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-text-muted">Cost/Part</span><span className="text-accent-cyan font-mono font-bold">{results.cost_per_part != null ? formatCurrency(results.cost_per_part, 2) : '–'}</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">Total Cost</span><span className="text-text-primary font-mono">{results.total_cost != null ? formatCurrency(results.total_cost) : '–'}</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">Production Run</span><span className="text-text-primary">{inputs.production_run ?? '–'} parts</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">Parts/Build</span><span className="text-text-primary">{results.parts_per_build ?? '–'}</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">Builds</span><span className="text-text-primary">{results.num_builds ?? '–'}</span></div>
                  {inputs.machine_name && <div className="flex justify-between"><span className="text-text-muted">Machine</span><span className="text-text-primary truncate ml-2">{inputs.machine_name}</span></div>}
                  {inputs.material_name && <div className="flex justify-between"><span className="text-text-muted">Material</span><span className="text-text-primary truncate ml-2">{inputs.material_name}</span></div>}
                  {selected.created_by_email && <div className="flex justify-between"><span className="text-text-muted">Created by</span><span className="text-text-primary truncate ml-2">{selected.created_by_email}</span></div>}
                </div>
                <div className="mt-4 pt-4 border-t border-bg-border flex gap-2">
                  <button
                    onClick={() => downloadExport(selected.id, selected.name, 'excel')}
                    className="btn-secondary flex-1 text-xs"
                  >
                    <Download size={13} /> Excel
                  </button>
                  <button
                    onClick={() => downloadExport(selected.id, selected.name, 'pdf')}
                    className="btn-secondary flex-1 text-xs"
                  >
                    <Download size={13} /> PDF
                  </button>
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
