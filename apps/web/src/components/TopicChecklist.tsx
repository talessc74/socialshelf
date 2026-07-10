'use client'

import { useState } from 'react'

interface TopicChecklistProps {
  label: string
  helperText?: string
  options: string[]
  values: string[]
  onChange: (values: string[]) => void
  customLabel?: string
  customPlaceholder?: string
}

// Checkbox de opções já conhecidas primeiro, campo de texto livre só depois (escondido atrás
// de um <details>) — o campo em branco sozinho intimida quem não sabe o que digitar; quem já
// sabe exatamente o que quer ainda consegue adicionar um tópico personalizado.
export function TopicChecklist({
  label,
  helperText,
  options,
  values,
  onChange,
  customLabel,
  customPlaceholder,
}: TopicChecklistProps) {
  const [customInput, setCustomInput] = useState('')
  const customValues = values.filter((v) => !options.includes(v))

  const toggleOption = (option: string) => {
    if (values.includes(option)) onChange(values.filter((v) => v !== option))
    else onChange([...values, option])
  }

  const addCustom = () => {
    const trimmed = customInput.trim()
    if (!trimmed || values.includes(trimmed)) return
    onChange([...values, trimmed])
    setCustomInput('')
  }

  const removeCustom = (value: string) => {
    onChange(values.filter((v) => v !== value))
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-ink">{label}</label>
      {helperText && <p className="mb-2 text-xs text-muted-2">{helperText}</p>}
      <div className="grid gap-1.5 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option}
            className="flex items-center gap-2 rounded-lg border border-line bg-card-2 px-3 py-2 text-sm text-ink"
          >
            <input type="checkbox" checked={values.includes(option)} onChange={() => toggleOption(option)} />
            {option}
          </label>
        ))}
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-accent">
          {customLabel ?? 'Já sabe exatamente o que quer? Adicione um tópico personalizado'}
        </summary>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addCustom()
              }
            }}
            placeholder={customPlaceholder}
            className="flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink placeholder-muted-2 focus:border-accent focus:outline-none"
          />
          <button
            type="button"
            onClick={addCustom}
            className="shrink-0 rounded-xl border border-accent px-3 py-2 text-sm font-semibold text-accent hover:bg-accent-soft"
          >
            Adicionar
          </button>
        </div>
        {customValues.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {customValues.map((value) => (
              <li
                key={value}
                className="flex items-center gap-1.5 rounded-full bg-card-2 px-3 py-1 text-xs font-medium text-ink"
              >
                {value}
                <button
                  type="button"
                  onClick={() => removeCustom(value)}
                  className="text-muted-2 hover:text-red-600"
                  aria-label={`Remover ${value}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  )
}
