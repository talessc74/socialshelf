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
      <label className="mb-1.5 block text-sm font-semibold text-gray-700">{label}</label>
      {helperText && <p className="mb-2 text-xs text-gray-400">{helperText}</p>}
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
          className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => addValue(input)}
          className="shrink-0 rounded-xl border border-brand-600 px-3 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50"
        >
          Adicionar
        </button>
      </div>
      {values.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {values.map((value, i) => (
            <li
              key={`${value}-${i}`}
              className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
            >
              {value}
              <button
                type="button"
                onClick={() => removeValue(i)}
                className="text-gray-400 hover:text-red-600"
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
          <p className="mb-1 text-xs uppercase tracking-wide text-gray-400">Sugestões — clique pra adicionar</p>
          <div className="flex flex-wrap gap-1.5">
            {availableSuggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addValue(s)}
                className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-600 hover:bg-brand-100"
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
