import { useState } from 'react'
import { Sparkles, UserCircle, Save, CheckCircle, LogOut, AlertCircle } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export function SettingsPage() {
  const { me, signOut } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwStatus, setPwStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    if (password !== confirmPw) { setPwStatus({ ok: false, msg: 'Passwords do not match.' }); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    setPwStatus(error ? { ok: false, msg: error.message } : { ok: true, msg: 'Password updated.' })
    if (!error) { setPassword(''); setConfirmPw('') }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="text-text-secondary mt-1">Your account and app information</p>
      </div>

      {me?.auth_enabled && (
        <div className="card mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg bg-accent-blue/20 flex items-center justify-center">
              <UserCircle size={16} className="text-accent-blue" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-text-primary font-semibold truncate">{me.email}</h3>
              <p className="text-text-muted text-xs">
                {me.is_admin ? 'Admin — can manage the machine and material library' : 'Member'}
              </p>
            </div>
            <button onClick={signOut} className="btn-secondary text-xs"><LogOut size={13} /> Sign out</button>
          </div>

          <form onSubmit={changePassword} className="space-y-3 pt-4 border-t border-bg-border">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="new-password">New password</label>
                <input id="new-password" type="password" autoComplete="new-password" minLength={8} required
                  className="input-field" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="confirm-password">Confirm</label>
                <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required
                  className="input-field" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" disabled={saving} className="btn-primary"><Save size={16} /> Change password</button>
              {pwStatus && (
                <span className={`text-sm flex items-center gap-1.5 ${pwStatus.ok ? 'text-success' : 'text-danger'}`}>
                  {pwStatus.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}{pwStatus.msg}
                </span>
              )}
            </div>
          </form>
        </div>
      )}

      <div className="card mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent-purple/20 flex items-center justify-center">
            <Sparkles size={16} className="text-accent-purple" />
          </div>
          <div className="flex-1">
            <h3 className="text-text-primary font-semibold">AI Insights</h3>
            <p className="text-text-muted text-xs">
              {me?.ai_enabled
                ? 'Enabled — Claude-powered DfAM and cost-reduction insights are available on the Results step.'
                : 'Not configured. The Anthropic API key is set on the server (ANTHROPIC_API_KEY), not in the browser.'}
            </p>
          </div>
          <span className={`badge ${me?.ai_enabled ? 'bg-success/20 text-success' : 'bg-bg-subtle text-text-muted'}`}>
            {me?.ai_enabled ? 'On' : 'Off'}
          </span>
        </div>
      </div>

      <div className="card">
        <h3 className="text-text-primary font-semibold mb-4">About</h3>
        <div className="space-y-2 text-sm text-text-secondary">
          <div className="flex justify-between"><span>Version</span><span className="text-text-primary font-mono">1.0.0</span></div>
          <div className="flex justify-between"><span>Cost Model</span><span className="text-text-primary">Based on MIT AM Cost Model (Hart, 2018)</span></div>
          <div className="flex justify-between"><span>Processes</span><span className="text-text-primary">LPBF / SLM</span></div>
          <div className="flex justify-between">
            <span>Database</span>
            <span className="text-text-primary font-mono">{me?.database === 'postgres' ? 'Supabase (shared)' : 'SQLite (local)'}</span>
          </div>
          <div className="flex justify-between"><span>STL analysis</span><span className="text-text-primary">In your browser — part files are never uploaded</span></div>
        </div>
      </div>
    </div>
  )
}
