'use client'

import { useState } from 'react'

interface TagListEditorProps {
  label: string
  helperText?: string
  placeholder?: string
  values: string[]
  onChange: (values: string[]) => void
  suggestions?: string[]
}

export function TagListEditor({ label, helperText, placeholder, values, onChange, suggestions }: TagListEditorProps) {
  const [input, setInput] = useState('')

  const addValue = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed || values.includes(trimmed)) return
    onChange([...values, trimmed])
    setInput('')
  }

  const removeValue = (index: number) => {
    onChange(values.filter((_, i) => i !== index))
  }

  const availableSuggestions = suggestions?.filter((s) => !values.includes(s)) ?? []

  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-ink">{label}</label>
      {helperText && <p className="mb-2 text-xs text-muted-2">{helperText}</p>}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addValue(input)
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink placeholder-muted-2 focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => addValue(input)}
          className="shrink-0 rounded-xl border border-accent px-3 py-2 text-sm font-semibold text-accent hover:bg-accent-soft"
        >
          Adicionar
        </button>
      </div>
      {values.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {values.map((value, i) => (
            <li
              key={`${value}-${i}`}
              className="flex items-center gap-1.5 rounded-full bg-card-2 px-3 py-1 text-xs font-medium text-ink"
            >
              {value}
              <button
                type="button"
                onClick={() => removeValue(i)}
                className="text-muted-2 hover:text-red-600"
                aria-label={`Remover ${value}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {availableSuggestions.length > 0 && (
        <div className="mt-2">
          <p className="mb-1 text-xs uppercase tracking-wide text-muted-2">Sugestões — clique pra adicionar</p>
          <div className="flex flex-wrap gap-1.5">
            {availableSuggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addValue(s)}
                className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent hover:opacity-80"
              >
                + {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
