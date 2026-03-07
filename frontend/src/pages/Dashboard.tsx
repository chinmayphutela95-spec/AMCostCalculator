import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusCircle, Cpu, FlaskConical, FolderOpen, TrendingDown, Activity } from 'lucide-react'
import { machinesApi, materialsApi, projectsApi } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import type { Project } from '../types'

export function Dashboard() {
  const navigate = useNavigate()
  const [machines, setMachines] = useState<any[]>([])
  const [materials, setMaterials] = useState<any[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([machinesApi.list(), materialsApi.list(), projectsApi.list()])
      .then(([m, mat, p]) => { setMachines(m); setMaterials(mat); setProjects(p) })
      .finally(() => setLoading(false))
  }, [])

  const recentProjects = projects.slice(0, 5)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-text-secondary mt-1">Metal Additive Manufacturing Cost Analysis Platform</p>
      </div>

      {/* CTA */}
      <div className="card glow-blue mb-8 bg-gradient-to-r from-accent-blue/10 to-accent-cyan/5 border-accent-blue/30">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary mb-1">Start a New Cost Analysis</h2>
            <p className="text-text-secondary text-sm">Upload an STL file or enter part parameters manually to calculate LPBF production costs</p>
          </div>
          <button onClick={() => navigate('/analysis')} className="btn-primary whitespace-nowrap">
            <PlusCircle size={16} />
            New Analysis
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <Cpu size={16} className="text-accent-blue" />
            <span className="stat-label">Machines</span>
          </div>
          <div className="stat-value">{machines.length}</div>
          <div className="text-text-muted text-xs mt-1">LPBF machines configured</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <FlaskConical size={16} className="text-accent-cyan" />
            <span className="stat-label">Materials</span>
          </div>
          <div className="stat-value">{materials.length}</div>
          <div className="text-text-muted text-xs mt-1">Metal AM materials in database</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <FolderOpen size={16} className="text-accent-purple" />
            <span className="stat-label">Projects</span>
          </div>
          <div className="stat-value">{projects.length}</div>
          <div className="text-text-muted text-xs mt-1">Saved analyses</div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Recent Projects */}
        <div className="col-span-3 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title mb-0">Recent Projects</h3>
            <button onClick={() => navigate('/history')} className="text-accent-blue text-xs hover:underline">View all</button>
          </div>
          {loading ? (
            <div className="text-text-muted text-sm py-8 text-center">Loading...</div>
          ) : recentProjects.length === 0 ? (
            <div className="text-center py-10">
              <Activity size={32} className="text-text-muted mx-auto mb-3" />
              <p className="text-text-secondary text-sm">No analyses yet</p>
              <p className="text-text-muted text-xs mt-1">Run your first cost analysis to see results here</p>
              <button onClick={() => navigate('/analysis')} className="btn-primary mt-4 mx-auto">
                <PlusCircle size={14} /> Start Analysis
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentProjects.map(p => {
                let results: any = {}
                try { results = JSON.parse(p.results_json) } catch {}
                const cpp = results?.cost_per_part
                return (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-bg-secondary hover:bg-bg-hover cursor-pointer transition-colors border border-bg-border" onClick={() => navigate('/history')}>
                    <div>
                      <div className="text-text-primary text-sm font-medium">{p.name}</div>
                      <div className="text-text-muted text-xs mt-0.5">{new Date(p.created_at).toLocaleDateString()}</div>
                    </div>
                    {cpp != null && (
                      <div className="text-right">
                        <div className="text-accent-cyan font-mono font-semibold text-sm">{formatCurrency(cpp, 2)}<span className="text-text-muted font-normal">/part</span></div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Quick info */}
        <div className="col-span-2 space-y-4">
          <div className="card">
            <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-3">Machines Available</h3>
            <div className="space-y-1.5">
              {machines.slice(0, 5).map(m => (
                <div key={m.id} className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary truncate">{m.name}</span>
                  <span className="text-text-muted text-xs ml-2 shrink-0">{m.manufacturer}</span>
                </div>
              ))}
              {machines.length > 5 && <div className="text-text-muted text-xs mt-2">+{machines.length - 5} more</div>}
            </div>
          </div>
          <div className="card">
            <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide mb-3">Key Features</h3>
            <ul className="space-y-2 text-xs text-text-secondary">
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-accent-blue shrink-0" />STL/STEP file parsing</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-accent-cyan shrink-0" />Build plate 3D visualization</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-accent-purple shrink-0" />Multi-machine comparison</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />AI-powered AM insights</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />PDF & Excel export</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-danger shrink-0" />Support estimation from STL</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
