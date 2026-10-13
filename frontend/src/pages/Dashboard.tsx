import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Cpu, FlaskConical, FolderOpen, Zap, Clock, ChevronRight } from 'lucide-react'
import { machinesApi, materialsApi, projectsApi } from '../lib/api'
import { formatCurrency } from '../lib/utils'
import type { Project } from '../types'

export function Dashboard() {
  const navigate = useNavigate()
  const [machines, setMachines]   = useState<any[]>([])
  const [materials, setMaterials] = useState<any[]>([])
  const [projects, setProjects]   = useState<Project[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    Promise.all([machinesApi.list(), materialsApi.list(), projectsApi.list()])
      .then(([m, mat, p]) => { setMachines(m); setMaterials(mat); setProjects(p) })
      .finally(() => setLoading(false))
  }, [])

  const recentProjects = projects.slice(0, 5)

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="hero-card">
        <div className="relative flex items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent-blue/15 border border-accent-blue/25 text-accent-blue text-xs font-semibold">
                <Zap size={11} strokeWidth={2.5} /> LPBF · SLM · Metal AM
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-text-primary tracking-tight mb-2">
              Calculate AM costs<br />
              <span className="gradient-text">with precision.</span>
            </h1>
            <p className="text-text-secondary text-sm max-w-md leading-relaxed">
              Upload a 3D file or enter part parameters to get a full cost breakdown —
              machine, material, labor, post-processing and more.
            </p>
          </div>
          <button
            onClick={() => navigate('/analysis')}
            className="btn-primary whitespace-nowrap text-base px-6 py-3 shrink-0"
          >
            New Analysis <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* ── Stats row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            icon: Cpu,
            color: 'text-accent-blue',
            bg: 'bg-accent-blue/10',
            label: 'Machines',
            value: machines.length,
            sub: 'LPBF machines configured',
          },
          {
            icon: FlaskConical,
            color: 'text-accent-green',
            bg: 'bg-accent-cyan/10',
            label: 'Materials',
            value: materials.length,
            sub: 'Metal AM powders in DB',
          },
          {
            icon: FolderOpen,
            color: 'text-accent-purple',
            bg: 'bg-accent-purple/10',
            label: 'Projects',
            value: projects.length,
            sub: 'Saved cost analyses',
          },
        ].map(({ icon: Icon, color, bg, label, value, sub }) => (
          <div key={label} className="stat-card group cursor-default">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}>
                <Icon size={17} className={color} />
              </div>
              <span className="stat-label">{label}</span>
            </div>
            <div className="stat-value">{value}</div>
            <div className="text-text-muted text-xs mt-1">{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Main content grid ─────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-6">

        {/* Recent Projects */}
        <div className="col-span-3 card">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-text-muted" />
              <h3 className="section-title mb-0">Recent Projects</h3>
            </div>
            <button
              onClick={() => navigate('/history')}
              className="text-accent-blue text-xs font-semibold hover:text-accent-green transition-colors flex items-center gap-1"
            >
              View all <ChevronRight size={12} />
            </button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-bg-subtle animate-pulse" />
              ))}
            </div>
          ) : recentProjects.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-2xl bg-bg-subtle flex items-center justify-center mx-auto mb-3">
                <FolderOpen size={22} className="text-text-muted" />
              </div>
              <p className="text-text-secondary text-sm font-medium">No analyses yet</p>
              <p className="text-text-muted text-xs mt-1">Run your first analysis to see results here</p>
              <button onClick={() => navigate('/analysis')} className="btn-primary mt-5 mx-auto">
                Start Analysis <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentProjects.map(p => {
                let results: any = {}
                try { results = JSON.parse(p.results_json) } catch {}
                const cpp = results?.cost_per_part
                return (
                  <div
                    key={p.id}
                    onClick={() => navigate('/history')}
                    className="flex items-center justify-between px-4 py-3 rounded-xl bg-bg-secondary hover:bg-bg-hover border border-transparent hover:border-bg-border cursor-pointer transition-all duration-150 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-accent-blue shrink-0" />
                      <div className="min-w-0">
                        <div className="text-text-primary text-sm font-semibold truncate">{p.name}</div>
                        <div className="text-text-muted text-xs mt-0.5">{new Date(p.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                    {cpp != null && (
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="text-accent-green font-mono font-bold text-sm">{formatCurrency(cpp, 2)}</div>
                          <div className="text-text-muted text-xs">/ part</div>
                        </div>
                        <ChevronRight size={14} className="text-text-muted group-hover:text-accent-blue transition-colors" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="col-span-2 space-y-4">

          {/* Machines list */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Cpu size={14} className="text-accent-blue" />
              <h3 className="section-title mb-0">Machines</h3>
            </div>
            {machines.length === 0 ? (
              <p className="text-text-muted text-xs">No machines configured</p>
            ) : (
              <div className="space-y-2">
                {machines.slice(0, 5).map(m => (
                  <div key={m.id} className="flex items-center justify-between">
                    <span className="text-text-secondary text-sm truncate">{m.name}</span>
                    <span className="text-text-muted text-xs ml-3 shrink-0 font-medium">{m.manufacturer}</span>
                  </div>
                ))}
                {machines.length > 5 && (
                  <button onClick={() => navigate('/machines')} className="text-accent-blue text-xs font-semibold mt-1 hover:underline">
                    +{machines.length - 5} more
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Capabilities */}
          <div className="card">
            <h3 className="section-title mb-4">Platform Features</h3>
            <ul className="space-y-2.5">
              {[
                { dot: 'bg-accent-blue', text: 'STL / STEP file parsing' },
                { dot: 'bg-accent-cyan', text: '3D build plate visualization' },
                { dot: 'bg-accent-blue', text: 'Multi-machine comparison' },
                { dot: 'bg-accent-cyan', text: 'AI-powered DfAM insights' },
                { dot: 'bg-accent-blue', text: 'PDF & Excel export with charts' },
                { dot: 'bg-accent-cyan', text: 'Support estimation from STL' },
              ].map(({ dot, text }) => (
                <li key={text} className="flex items-center gap-2.5 text-xs text-text-secondary">
                  <span className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
