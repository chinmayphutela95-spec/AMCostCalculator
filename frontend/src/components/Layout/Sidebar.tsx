import { NavLink } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, Clock, Cpu, FlaskConical, Settings, Zap } from 'lucide-react'
import { cn } from '../../lib/utils'

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/analysis', icon: PlusCircle, label: 'New Analysis' },
  { to: '/history', icon: Clock, label: 'Projects' },
  { to: '/machines', icon: Cpu, label: 'Machines' },
  { to: '/materials', icon: FlaskConical, label: 'Materials' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  return (
    <aside className="w-56 shrink-0 flex flex-col bg-bg-secondary border-r border-bg-border h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-bg-border">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-blue to-accent-cyan flex items-center justify-center">
          <Zap size={16} className="text-white" />
        </div>
        <div>
          <div className="text-text-primary font-semibold text-sm leading-tight">Metal AM</div>
          <div className="text-text-muted text-xs">Cost Analyzer</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150',
                isActive
                  ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              )
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-bg-border">
        <p className="text-text-muted text-xs">Inspired by MIT Cost Model</p>
        <p className="text-text-muted text-xs">LPBF / SLM v1.0</p>
      </div>
    </aside>
  )
}
