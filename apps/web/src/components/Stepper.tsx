interface StepperProps {
  steps: string[]
  currentStep: number
}

export function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto py-1 sm:gap-2">
      {steps.map((step, i) => {
        const isCurrent = i === currentStep
        const isDone = i < currentStep
        return (
          <li key={step} className="flex shrink-0 items-center gap-1 sm:gap-2">
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold sm:h-7 sm:w-7 ${
                  isCurrent
                    ? 'bg-accent text-accent-ink ring-4 ring-accent-soft'
                    : isDone
                      ? 'bg-accent-soft text-accent'
                      : 'bg-card-2 text-muted-2'
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`whitespace-nowrap text-xs font-medium sm:text-sm ${
                  isCurrent ? 'text-accent' : isDone ? 'text-muted' : 'text-muted-2'
                }`}
              >
                {step}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span className={`h-px w-4 shrink-0 sm:w-8 ${isDone ? 'bg-accent-soft' : 'bg-line'}`} />
            )}
          </li>
        )
      })}
    </ol>
  )
}
