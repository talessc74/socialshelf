interface StepperProps {
  steps: string[]
  currentStep: number
}

export function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((step, i) => {
        const isCurrent = i === currentStep
        const isDone = i < currentStep
        return (
          <li key={step} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  isCurrent
                    ? 'bg-brand-500 text-white ring-4 ring-brand-100'
                    : isDone
                      ? 'bg-brand-200 text-brand-700'
                      : 'bg-gray-100 text-gray-400'
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`text-sm font-medium ${
                  isCurrent ? 'text-brand-700' : isDone ? 'text-gray-600' : 'text-gray-400'
                }`}
              >
                {step}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span className={`h-px w-8 ${isDone ? 'bg-brand-200' : 'bg-gray-200'}`} />
            )}
          </li>
        )
      })}
    </ol>
  )
}
