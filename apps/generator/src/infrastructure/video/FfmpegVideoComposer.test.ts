import { describe, it, expect, vi, afterEach } from 'vitest'
import { writeFileSync } from 'node:fs'

const execFileMock = vi.fn(
  (
    _file: string,
    args: string[],
    callback: (err: Error | null, stdout: string, stderr: string) => void,
  ) => {
    // Simula o ffmpeg real escrevendo o arquivo de saída esperado (último argumento) —
    // permite testar toda a orquestração (temp dir, encadeamento de segmentos, limpeza)
    // sem depender do binário ffmpeg estar instalado no ambiente de teste.
    const outputPath = args[args.length - 1]!
    writeFileSync(outputPath, 'fake-video-bytes')
    callback(null, '', '')
  },
)

vi.mock('node:child_process', () => ({
  execFile: (...args: unknown[]) => (execFileMock as (...a: unknown[]) => void)(...args),
}))

const { FfmpegVideoComposer } = await import('./FfmpegVideoComposer.js')

describe('FfmpegVideoComposer', () => {
  afterEach(() => {
    execFileMock.mockClear()
  })

  it('throws when given no slides', async () => {
    const composer = new FfmpegVideoComposer()
    await expect(composer.composeSlideshow({ slides: [] })).rejects.toThrow(
      'composeSlideshow requires at least one slide',
    )
  })

  it('runs one ffmpeg pass per slide plus one concat pass, and returns the composed buffer', async () => {
    const composer = new FfmpegVideoComposer()
    const result = await composer.composeSlideshow({
      slides: [
        { imageBuffer: Buffer.from('img-1'), durationSeconds: 3 },
        { imageBuffer: Buffer.from('img-2'), durationSeconds: 4 },
      ],
    })

    // 2 slides -> 2 per-slide ffmpeg passes + 1 concat pass = 3 calls
    expect(execFileMock).toHaveBeenCalledTimes(3)
    expect(result.videoBuffer.toString()).toBe('fake-video-bytes')
    expect(result.durationSeconds).toBe(7)
  })

  it('builds the zoompan filter with the requested frame count for the slide duration', async () => {
    const composer = new FfmpegVideoComposer()
    await composer.composeSlideshow({ slides: [{ imageBuffer: Buffer.from('img'), durationSeconds: 5 }] })

    const [, firstCallArgs] = execFileMock.mock.calls[0]!
    const vf = (firstCallArgs as string[])[(firstCallArgs as string[]).indexOf('-vf') + 1]
    expect(vf).toContain('d=125') // 5s * 25fps
  })

  it('concatenates segments and mixes in a silent audio track', async () => {
    const composer = new FfmpegVideoComposer()
    await composer.composeSlideshow({
      slides: [
        { imageBuffer: Buffer.from('img-1'), durationSeconds: 2 },
        { imageBuffer: Buffer.from('img-2'), durationSeconds: 2 },
      ],
    })

    const concatArgs = execFileMock.mock.calls[2]![1] as string[]
    expect(concatArgs).toContain('-f')
    expect(concatArgs).toContain('concat')
    expect(concatArgs.join(' ')).toContain('anullsrc')
    expect(concatArgs).toContain('-shortest')
  })
})
