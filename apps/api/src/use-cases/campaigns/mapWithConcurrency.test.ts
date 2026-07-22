import { describe, it, expect, vi } from 'vitest'
import { mapWithConcurrency } from './mapWithConcurrency.js'

describe('mapWithConcurrency', () => {
  it('preserves result order regardless of completion order', async () => {
    const delays = [30, 10, 20, 5]
    const results = await mapWithConcurrency(delays, 4, (ms) => new Promise((resolve) => setTimeout(() => resolve(ms), ms)))
    expect(results).toEqual([30, 10, 20, 5])
  })

  it('never runs more than `limit` calls at the same time', async () => {
    let active = 0
    let maxActive = 0
    const items = Array.from({ length: 10 }, (_, i) => i)

    await mapWithConcurrency(items, 3, async (item) => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active--
      return item
    })

    expect(maxActive).toBeLessThanOrEqual(3)
  })

  it('runs every item exactly once', async () => {
    const fn = vi.fn(async (item: number) => item * 2)
    const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, fn)
    expect(fn).toHaveBeenCalledTimes(5)
    expect(results).toEqual([2, 4, 6, 8, 10])
  })

  it('handles an empty list without dividing by zero or hanging', async () => {
    const fn = vi.fn()
    const results = await mapWithConcurrency([], 3, fn)
    expect(results).toEqual([])
    expect(fn).not.toHaveBeenCalled()
  })

  it('caps the worker count to the item count when limit exceeds it', async () => {
    const fn = vi.fn(async (item: number) => item)
    const results = await mapWithConcurrency([1, 2], 10, fn)
    expect(results).toEqual([1, 2])
  })

  it('propagates a rejection from fn', async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (item) => {
        if (item === 2) throw new Error('boom')
        return item
      }),
    ).rejects.toThrow('boom')
  })
})
