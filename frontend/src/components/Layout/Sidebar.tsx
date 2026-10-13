import { NavLink } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, Clock, Cpu, FlaskConical, Settings, LogOut } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import tiiMark from '../../assets/tii-mark.png'

const nav = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard',    end: true },
  { to: '/analysis',  icon: PlusCircle,      label: 'New Analysis' },
  { to: '/history',   icon: Clock,           label: 'Projects' },
  { to: '/machines',  icon: Cpu,             label: 'Machines' },
  { to: '/materials', icon: FlaskConical,    label: 'Materials' },
  { to: '/settings',  icon: Settings,        label: 'Settings' },
]

export function Sidebar() {
  const { me, signOut } = useAuth()

  return (
    <aside className="w-60 shrink-0 flex flex-col h-screen sticky top-0 bg-bg-secondary border-r border-bg-border">

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-bg-border shrink-0">
        <img src={tiiMark} alt="Technology Innovation Institute" className="h-8 w-auto shrink-0" />
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
                  ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/25'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-hover border border-transparent',
              ].join(' ')}>
                <Icon size={16} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />
                {label}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Signed-in user */}
      {me?.auth_enabled && (
        <div className="px-5 py-3 border-t border-bg-border flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-text-secondary text-xs font-medium truncate" title={me.email}>{me.email}</div>
            <div className="text-text-muted text-xs">{me.is_admin ? 'Admin' : 'Member'}</div>
          </div>
          <button onClick={signOut} title="Sign out" className="text-text-muted hover:text-text-primary p-1.5 rounded transition-colors">
            <LogOut size={14} />
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-4 border-t border-bg-border">
        <div className="text-text-muted text-xs font-medium">MIT Cost Model · LPBF / SLM</div>
        <div className="text-text-muted text-xs opacity-40 mt-0.5">v1.0</div>
      </div>
    </aside>
  )
}
