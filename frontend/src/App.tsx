import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/Layout/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { AnalysisWizard } from './pages/analysis/AnalysisWizard'
import { MachinesPage } from './pages/Machines'
import { MaterialsPage } from './pages/Materials'
import { HistoryPage } from './pages/History'
import { SettingsPage } from './pages/Settings'

export default function App() {
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
