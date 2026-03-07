import { useState } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import { PartStep } from './steps/PartStep'
import { MachineStep } from './steps/MachineStep'
import { MaterialStep } from './steps/MaterialStep'
import { ProcessStep } from './steps/ProcessStep'
import { ResultsStep } from './steps/ResultsStep'
import type { AnalysisState } from '../../types'

const STEPS = [
  { id: 1, label: 'Part' },
  { id: 2, label: 'Machine' },
  { id: 3, label: 'Material' },
  { id: 4, label: 'Process' },
  { id: 5, label: 'Results' },
]

const INITIAL: AnalysisState = {
  partMass: 0.179,
  partVolume: 22.4,
  partHeight: 8.76,
  partProjectedArea: 25.6,
  supportPctOfMass: 0.15,
  buildDirection: 'z',
  productionRun: 100,
  materialCostPerKg: 40,
  materialDensity: 7.99,
  heatTreatmentEnabled: false,
  heatTreatmentCostPerBuild: 300,
  partSeparationEnabled: true,
  partSeparationCostPerPart: 50,
  hipEnabled: false,
  hipCostPerPart: 100,
  surfaceTreatmentEnabled: false,
  surfaceTreatmentCostPerPart: 30,
  ndtEnabled: false,
  ndtCostPerPart: 50,
  materialBuildRate: 15,
  layerThicknessUm: 40,
  laserStrategy: 'single' as const,
  lasersPerPart: 1,
}

export function AnalysisWizard() {
  const [step, setStep] = useState(1)
  const [state, setState] = useState<AnalysisState>(INITIAL)

  const update = (partial: Partial<AnalysisState>) =>
    setState(s => ({ ...s, ...partial }))

  const next = () => setStep(s => Math.min(s + 1, STEPS.length))
  const prev = () => setStep(s => Math.max(s - 1, 1))
  const goTo = (s: number) => { if (s < step) setStep(s) }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">New Cost Analysis</h1>
        <p className="text-text-secondary mt-1">LPBF / SLM — Metal Additive Manufacturing</p>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-0 mb-8 relative">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1 last:flex-none">
            <button
              onClick={() => goTo(s.id)}
              className={`flex items-center gap-2 shrink-0 z-10 transition-colors ${
                s.id < step ? 'cursor-pointer' : s.id === step ? 'cursor-default' : 'cursor-not-allowed'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                s.id < step
                  ? 'bg-accent-blue border-accent-blue text-white'
                  : s.id === step
                  ? 'bg-accent-blue/10 border-accent-blue text-accent-blue'
                  : 'bg-bg-secondary border-bg-border text-text-muted'
              }`}>
                {s.id < step ? <Check size={14} /> : s.id}
              </div>
              <span className={`text-sm font-medium hidden sm:block ${
                s.id === step ? 'text-accent-blue' : s.id < step ? 'text-text-secondary' : 'text-text-muted'
              }`}>{s.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-3 transition-colors ${s.id < step ? 'bg-accent-blue' : 'bg-bg-border'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="min-h-96">
        {step === 1 && <PartStep state={state} update={update} onNext={next} />}
        {step === 2 && <MachineStep state={state} update={update} onNext={next} onBack={prev} />}
        {step === 3 && <MaterialStep state={state} update={update} onNext={next} onBack={prev} />}
        {step === 4 && <ProcessStep state={state} update={update} onNext={next} onBack={prev} />}
        {step === 5 && <ResultsStep state={state} update={update} onBack={prev} onReset={() => { setState(INITIAL); setStep(1) }} />}
      </div>
    </div>
  )
}
