import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { VideoComposerPort } from '@socialshelf/domain'

const run = promisify(execFile)

const WIDTH = 1080
const HEIGHT = 1920
const FPS = 25
// Zoom lento e contínuo (efeito Ken Burns) — mesmo espírito de "movimento leve" da
// _local-adr-policy-036, sem tentar imitar edição profissional nesta primeira fatia.
const ZOOM_PER_FRAME = 0.0015
const MAX_ZOOM = 1.2
// Piso de segurança: se a narração for muito curta para o número de imagens, cada slide
// ainda precisa de um tempo mínimo utilizável.
const MIN_SLIDE_DURATION_SECONDS = 1.5

export class FfmpegVideoComposer implements VideoComposerPort {
  async composeSlideshow(input: {
    imageBuffers: Buffer[]
    narrationAudioBuffer: Buffer | null
    silentSlideDurationSeconds: number
  }): Promise<{ videoBuffer: Buffer; durationSeconds: number }> {
    if (input.imageBuffers.length === 0) {
      throw new Error('composeSlideshow requires at least one image')
    }

    const workDir = await mkdtemp(join(tmpdir(), 'socialshelf-video-'))
    try {
      let narrationPath: string | null = null
      let slideDurationSeconds = input.silentSlideDurationSeconds

      if (input.narrationAudioBuffer) {
        narrationPath = join(workDir, 'narration.mp3')
        await writeFile(narrationPath, input.narrationAudioBuffer)
        const narrationDuration = await this.probeDuration(narrationPath)
        slideDurationSeconds = Math.max(
          MIN_SLIDE_DURATION_SECONDS,
          narrationDuration / input.imageBuffers.length,
        )
      }

      const segmentPaths: string[] = []
      for (let i = 0; i < input.imageBuffers.length; i++) {
        const imagePath = join(workDir, `slide-${i}.jpg`)
        await writeFile(imagePath, input.imageBuffers[i]!)

        const segmentPath = join(workDir, `segment-${i}.mp4`)
        const frames = Math.max(1, Math.round(slideDurationSeconds * FPS))
        await run('ffmpeg', [
          '-y',
          '-loop', '1',
          '-i', imagePath,
          '-vf',
          // Pré-escala antes do zoompan evita pixelização durante o zoom (técnica padrão),
          // mas 8000px era exagero — 2x a largura final já é suficiente e bem mais rápido.
          // Em produção, 8000px por imagem deixava a composição lenta o bastante para
          // esbarrar em timeout de rede no celular ("Load failed") antes de terminar.
          `scale=${WIDTH * 2}:-1,zoompan=z='min(zoom+${ZOOM_PER_FRAME},${MAX_ZOOM})':d=${frames}:s=${WIDTH}x${HEIGHT}:fps=${FPS}`,
          '-t', String(slideDurationSeconds),
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-pix_fmt', 'yuv420p',
          '-r', String(FPS),
          segmentPath,
        ])
        segmentPaths.push(segmentPath)
      }

      const listPath = join(workDir, 'list.txt')
      await writeFile(listPath, segmentPaths.map((p) => `file '${p}'`).join('\n'))

      const outputPath = join(workDir, 'output.mp4')
      await run('ffmpeg', [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', listPath,
        ...(narrationPath ? ['-i', narrationPath] : ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100']),
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-shortest',
        outputPath,
      ])

      const videoBuffer = await readFile(outputPath)
      const durationSeconds = slideDurationSeconds * input.imageBuffers.length
      return { videoBuffer, durationSeconds }
    } finally {
      await rm(workDir, { recursive: true, force: true })
    }
  }

  private async probeDuration(filePath: string): Promise<number> {
    const { stdout } = await run('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'csv=p=0',
      filePath,
    ])
    const seconds = Number.parseFloat(stdout.trim())
    if (Number.isNaN(seconds) || seconds <= 0) {
      throw new Error(`ffprobe returned an invalid duration for ${filePath}: "${stdout}"`)
    }
    return seconds
  }
}
