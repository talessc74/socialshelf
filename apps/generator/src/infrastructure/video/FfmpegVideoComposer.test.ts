import { describe, it, expect, vi, afterEach } from 'vitest'
import { writeFileSync } from 'node:fs'
import { promisify } from 'node:util'

let narrationDurationResponse = '9.0\n'

const execFileMock = vi.fn(
  (
    file: string,
    args: string[],
    callback: (err: Error | null, stdout: string, stderr: string) => void,
  ) => {
    if (file === 'ffprobe') {
      callback(null, narrationDurationResponse, '')
      return
    }
    // Simula o ffmpeg real escrevendo o arquivo de saída esperado (último argumento) —
    // permite testar toda a orquestração (temp dir, encadeamento de segmentos, limpeza)
    // sem depender do binário ffmpeg estar instalado no ambiente de teste.
    const outputPath = args[args.length - 1]!
    writeFileSync(outputPath, 'fake-video-bytes')
    callback(null, '', '')
  },
)

// O execFile real do Node tem um util.promisify.custom que resolve para {stdout, stderr}.
// Sem replicar isso aqui, promisify(execFileMock) cairia no comportamento genérico
// (resolve um array), diferente do que FfmpegVideoComposer recebe em produção.
;(execFileMock as unknown as Record<symbol, unknown>)[promisify.custom] = (
  file: string,
  args: string[],
) =>
  new Promise((resolve, reject) => {
    execFileMock(file, args, (err: Error | null, stdout: string, stderr: string) => {
      if (err) reject(err)
      else resolve({ stdout, stderr })
    })
  })

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}))

const { FfmpegVideoComposer } = await import('./FfmpegVideoComposer.js')

describe('FfmpegVideoComposer', () => {
  afterEach(() => {
    execFileMock.mockClear()
    narrationDurationResponse = '9.0\n'
  })

  it('throws when given no images', async () => {
    const composer = new FfmpegVideoComposer()
    await expect(
      composer.composeSlideshow({ imageBuffers: [], narrationAudioBuffer: null, silentSlideDurationSeconds: 3 }),
    ).rejects.toThrow('composeSlideshow requires at least one image')
  })

  it('runs one ffmpeg pass per image plus one concat pass, and returns the composed buffer', async () => {
    const composer = new FfmpegVideoComposer()
    const result = await composer.composeSlideshow({
      imageBuffers: [Buffer.from('img-1'), Buffer.from('img-2')],
      narrationAudioBuffer: null,
      silentSlideDurationSeconds: 3,
    })

    // 2 images -> 2 per-slide ffmpeg passes + 1 concat pass = 3 calls
    expect(execFileMock).toHaveBeenCalledTimes(3)
    expect(result.videoBuffer.toString()).toBe('fake-video-bytes')
    expect(result.durationSeconds).toBe(6)
  })

  it('builds the zoompan filter using silentSlideDurationSeconds when there is no narration', async () => {
    const composer = new FfmpegVideoComposer()
    await composer.composeSlideshow({
      imageBuffers: [Buffer.from('img')],
      narrationAudioBuffer: null,
      silentSlideDurationSeconds: 5,
    })

    const [, firstCallArgs] = execFileMock.mock.calls[0]!
    const vf = (firstCallArgs as string[])[(firstCallArgs as string[]).indexOf('-vf') + 1]
    expect(vf).toContain('d=125') // 5s * 25fps
  })

  it('concatenates segments and mixes in a silent audio track when there is no narration', async () => {
    const composer = new FfmpegVideoComposer()
    await composer.composeSlideshow({
      imageBuffers: [Buffer.from('img-1'), Buffer.from('img-2')],
      narrationAudioBuffer: null,
      silentSlideDurationSeconds: 2,
    })

    const concatArgs = execFileMock.mock.calls[2]![1] as string[]
    expect(concatArgs).toContain('-f')
    expect(concatArgs).toContain('concat')
    expect(concatArgs.join(' ')).toContain('anullsrc')
    expect(concatArgs).toContain('-shortest')
  })

  it('derives slide duration from the narration audio length instead of silentSlideDurationSeconds', async () => {
    narrationDurationResponse = '10.0\n'
    const composer = new FfmpegVideoComposer()
    const result = await composer.composeSlideshow({
      imageBuffers: [Buffer.from('img-1'), Buffer.from('img-2')],
      narrationAudioBuffer: Buffer.from('fake-mp3-bytes'),
      silentSlideDurationSeconds: 3,
    })

    // calls[0] is the ffprobe call for narration duration; calls[1] is the first slide's ffmpeg pass.
    // 10s narration / 2 images = 5s per slide, not the silent 3s
    const [, firstSlideCallArgs] = execFileMock.mock.calls[1]!
    const vf = (firstSlideCallArgs as string[])[(firstSlideCallArgs as string[]).indexOf('-vf') + 1]
    expect(vf).toContain('d=125') // 5s * 25fps
    expect(result.durationSeconds).toBe(10)
  })

  it('uses the narration file (not anullsrc) as the audio input when narrating', async () => {
    narrationDurationResponse = '6.0\n'
    const composer = new FfmpegVideoComposer()
    await composer.composeSlideshow({
      imageBuffers: [Buffer.from('img-1')],
      narrationAudioBuffer: Buffer.from('fake-mp3-bytes'),
      silentSlideDurationSeconds: 3,
    })

    const concatCallArgs = execFileMock.mock.calls[execFileMock.mock.calls.length - 1]![1] as string[]
    expect(concatCallArgs.join(' ')).not.toContain('anullsrc')
    expect(concatCallArgs.some((a) => a.endsWith('narration.mp3'))).toBe(true)
  })

  it('enforces a minimum slide duration when narration is too short for the image count', async () => {
    narrationDurationResponse = '1.0\n'
    const composer = new FfmpegVideoComposer()
    await composer.composeSlideshow({
      imageBuffers: [Buffer.from('img-1'), Buffer.from('img-2'), Buffer.from('img-3')],
      narrationAudioBuffer: Buffer.from('fake-mp3-bytes'),
      silentSlideDurationSeconds: 3,
    })

    // calls[0] is the ffprobe call; calls[1] is the first slide's ffmpeg pass.
    // 1s / 3 images = 0.33s, below the floor -> clamped to 1.5s * 25fps = 38 frames (rounded)
    const [, firstSlideCallArgs] = execFileMock.mock.calls[1]!
    const vf = (firstSlideCallArgs as string[])[(firstSlideCallArgs as string[]).indexOf('-vf') + 1]
    expect(vf).toContain('d=38')
  })

  it('caps slide duration when narration is long relative to the image count', async () => {
    narrationDurationResponse = '90.0\n'
    const composer = new FfmpegVideoComposer()
    const result = await composer.composeSlideshow({
      imageBuffers: [Buffer.from('img-1'), Buffer.from('img-2')],
      narrationAudioBuffer: Buffer.from('fake-mp3-bytes'),
      silentSlideDurationSeconds: 3,
    })

    // 90s / 2 images = 45s, above the 8s cap -> clamped to 8s * 25fps = 200 frames
    const [, firstSlideCallArgs] = execFileMock.mock.calls[1]!
    const vf = (firstSlideCallArgs as string[])[(firstSlideCallArgs as string[]).indexOf('-vf') + 1]
    expect(vf).toContain('d=200')
    // Reported duration reflects the capped video, not the full (now-truncated) narration.
    expect(result.durationSeconds).toBe(16)
  })

  it('throws when ffprobe returns an unparseable duration', async () => {
    narrationDurationResponse = 'not-a-number\n'
    const composer = new FfmpegVideoComposer()
    await expect(
      composer.composeSlideshow({
        imageBuffers: [Buffer.from('img-1')],
        narrationAudioBuffer: Buffer.from('fake-mp3-bytes'),
        silentSlideDurationSeconds: 3,
      }),
    ).rejects.toThrow('ffprobe returned an invalid duration')
  })
})
