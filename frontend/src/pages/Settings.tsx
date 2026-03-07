import { useEffect, useState } from 'react'
import { Settings, Key, Save, CheckCircle } from 'lucide-react'
import { settingsApi } from '../lib/api'

export function SettingsPage() {
  const [apiKey, setApiKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    settingsApi.get().then(s => {
      setApiKey(s.claude_api_key || '')
    }).finally(() => setLoading(false))
  }, [])

  const save = async () => {
    await settingsApi.set('claude_api_key', apiKey)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="text-text-secondary mt-1">Configure app preferences and API integrations</p>
      </div>

      <div className="card mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-accent-purple/20 flex items-center justify-center">
            <Key size={16} className="text-accent-purple" />
          </div>
          <div>
            <h3 className="text-text-primary font-semibold">Claude API Key</h3>
            <p className="text-text-muted text-xs">Required for AI-powered AM insights and manufacturing comparison</p>
          </div>
        </div>

        <label className="label">Anthropic API Key</label>
        <input
          type="password"
          className="input-field mb-3"
          placeholder="sk-ant-..."
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
        />
        <p className="text-text-muted text-xs mb-4">
          Get your API key at <span className="text-accent-blue">console.anthropic.com</span>. Stored locally in SQLite — never sent anywhere except Anthropic's API.
        </p>
        <button onClick={save} className="btn-primary">
          {saved ? <CheckCircle size={16} className="text-success" /> : <Save size={16} />}
          {saved ? 'Saved!' : 'Save API Key'}
        </button>
      </div>

      <div className="card">
        <h3 className="text-text-primary font-semibold mb-4">About</h3>
        <div className="space-y-2 text-sm text-text-secondary">
          <div className="flex justify-between"><span>Version</span><span className="text-text-primary font-mono">1.0.0</span></div>
          <div className="flex justify-between"><span>Cost Model</span><span className="text-text-primary">Based on MIT AM Cost Model (Hart, 2018)</span></div>
          <div className="flex justify-between"><span>Processes</span><span className="text-text-primary">LPBF / SLM</span></div>
          <div className="flex justify-between"><span>Database</span><span className="text-text-primary font-mono">SQLite (local)</span></div>
        </div>
      </div>
    </div>
  )
}
