import { useState, type ChangeEvent } from 'react'

// Corrige um bug real: clampar (Math.min/Math.max) direto no onChange faz o campo travar em
// min ou max sempre que o usuário limpa o campo pra digitar outro valor — limpar produz "",
// que Number("") converte pra 0, e "0 || min" cai no mínimo antes do próximo dígito ser
// digitado; o dígito seguinte então se soma ao mínimo já exibido, estourando pro máximo.
// O valor exibido (inputValue) fica livre durante a digitação; o clamp só acontece ao sair
// do campo (onBlur) ou é lido via `value`, que sempre reflete o último número válido.
export function useClampedNumberInput(initialValue: number, min: number, max: number) {
  const [value, setValue] = useState(initialValue)
  const [inputValue, setInputValue] = useState(String(initialValue))

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setInputValue(raw)
    const parsed = Number(raw)
    if (raw !== '' && !Number.isNaN(parsed)) {
      setValue(Math.min(max, Math.max(min, parsed)))
    }
  }

  const onBlur = () => {
    const clamped = Math.min(max, Math.max(min, Number(inputValue) || min))
    setValue(clamped)
    setInputValue(String(clamped))
  }

  return { value, inputValue, onChange, onBlur }
}
