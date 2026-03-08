import { NavLink } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, Clock, Cpu, FlaskConical, Settings, Zap } from 'lucide-react'

const nav = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard',    end: true },
  { to: '/analysis',  icon: PlusCircle,      label: 'New Analysis' },
  { to: '/history',   icon: Clock,           label: 'Projects' },
  { to: '/machines',  icon: Cpu,             label: 'Machines' },
  { to: '/materials', icon: FlaskConical,    label: 'Materials' },
  { to: '/settings',  icon: Settings,        label: 'Settings' },
]

export function Sidebar() {
  return (
    <aside className="w-60 shrink-0 flex flex-col h-screen sticky top-0 bg-bg-secondary border-r border-bg-border">

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-bg-border shrink-0">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent-blue to-accent-cyan flex items-center justify-center shadow-glow-blue shrink-0">
          <Zap size={15} className="text-white" strokeWidth={2.5} />
        </div>
        <div className="leading-tight">
          <div className="text-text-primary font-bold text-sm tracking-tight">Metal AM</div>
          <div className="text-text-muted text-xs font-medium">Cost Analyzer</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
        {nav.map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={end}>
            {({ isActive }) => (
              <span className={[
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer select-none',
                isActive
                  ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/25 glow-blue'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-hover border border-transparent',
              ].join(' ')}>
                <Icon size={16} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />
                {label}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-bg-border">
        <div className="text-text-muted text-xs font-medium">MIT Cost Model · LPBF / SLM</div>
        <div className="text-text-muted text-xs opacity-40 mt-0.5">v1.0</div>
      </div>
    </aside>
  )
}
