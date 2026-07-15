import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useClampedNumberInput } from './useClampedNumberInput'

function change(value: string) {
  return { target: { value } } as React.ChangeEvent<HTMLInputElement>
}

describe('useClampedNumberInput', () => {
  it('starts with the initial value both as number and as displayed string', () => {
    const { result } = renderHook(() => useClampedNumberInput(2, 1, 10))
    expect(result.current.value).toBe(2)
    expect(result.current.inputValue).toBe('2')
  })

  it('lets the field go empty while typing, without snapping to min on every keystroke', () => {
    const { result } = renderHook(() => useClampedNumberInput(2, 1, 10))

    act(() => result.current.onChange(change('')))

    // Achado real em produção: clampar direto no onChange fazia o campo virar "1" assim que
    // limpo, impedindo o próximo dígito de formar outro número que não 1 ou 10.
    expect(result.current.inputValue).toBe('')
  })

  it('lets the user clear the field and type a full new value (e.g. 5) without snapping to 1 or 10', () => {
    const { result } = renderHook(() => useClampedNumberInput(2, 1, 10))

    act(() => result.current.onChange(change('')))
    act(() => result.current.onChange(change('5')))

    expect(result.current.inputValue).toBe('5')
    expect(result.current.value).toBe(5)
  })

  it('clamps the committed value to the max while typing, without touching the displayed digits', () => {
    const { result } = renderHook(() => useClampedNumberInput(2, 1, 10))

    act(() => result.current.onChange(change('15')))

    expect(result.current.inputValue).toBe('15')
    expect(result.current.value).toBe(10)
  })

  it('clamps the displayed value to min on blur when left empty', () => {
    const { result } = renderHook(() => useClampedNumberInput(2, 1, 10))

    act(() => result.current.onChange(change('')))
    act(() => result.current.onBlur())

    expect(result.current.inputValue).toBe('1')
    expect(result.current.value).toBe(1)
  })

  it('clamps the displayed value to max on blur when left above the range', () => {
    const { result } = renderHook(() => useClampedNumberInput(2, 1, 10))

    act(() => result.current.onChange(change('15')))
    act(() => result.current.onBlur())

    expect(result.current.inputValue).toBe('10')
  })
})
