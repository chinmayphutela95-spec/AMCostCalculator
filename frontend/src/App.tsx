import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Sidebar } from './components/Layout/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { AnalysisWizard } from './pages/analysis/AnalysisWizard'
import { MachinesPage } from './pages/Machines'
import { MaterialsPage } from './pages/Materials'
import { HistoryPage } from './pages/History'
import { SettingsPage } from './pages/Settings'
import { LoginPage } from './pages/Login'
import { AuthProvider, useAuth } from './lib/auth'

function Shell() {
  const { ready, signedIn } = useAuth()

  if (!ready) {
    return (
      <div className="h-screen bg-bg-primary flex items-center justify-center">
        <Loader2 size={24} className="text-accent-blue animate-spin" />
      </div>
    )
  }
  if (!signedIn) return <LoginPage />

  return (
    <BrowserRouter>
      <div className="flex h-screen bg-bg-primary overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/analysis" element={<AnalysisWizard />} />
            <Route path="/machines" element={<MachinesPage />} />
            <Route path="/materials" element={<MaterialsPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
