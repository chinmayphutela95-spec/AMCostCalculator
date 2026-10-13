import { useState } from 'react'
import { Zap, LogIn, Loader2, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setError(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message)
    setBusy(false)
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      <form onSubmit={signIn} className="card w-full max-w-sm space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-blue to-accent-cyan flex items-center justify-center shadow-glow-blue shrink-0">
            <Zap size={18} className="text-white" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <div className="text-text-primary font-bold">Metal AM Cost Analyzer</div>
            <div className="text-text-muted text-xs">Sign in to continue</div>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email" type="email" autoComplete="email" required autoFocus
            className="input-field" value={email} onChange={e => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password" type="password" autoComplete="current-password" required
            className="input-field" value={password} onChange={e => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <p className="text-danger text-sm flex items-center gap-1.5"><AlertCircle size={14} />{error}</p>
        )}

        <button type="submit" disabled={busy} className="btn-primary w-full justify-center">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
          Sign in
        </button>

        <p className="text-text-muted text-xs leading-relaxed">
          Accounts are created by an admin. If you need access or forgot your password, ask an admin.
        </p>
      </form>
    </div>
  )
}
