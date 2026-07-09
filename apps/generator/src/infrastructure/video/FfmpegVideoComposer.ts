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

export class FfmpegVideoComposer implements VideoComposerPort {
  async composeSlideshow(input: {
    slides: { imageBuffer: Buffer; durationSeconds: number }[]
  }): Promise<{ videoBuffer: Buffer; durationSeconds: number }> {
    if (input.slides.length === 0) {
      throw new Error('composeSlideshow requires at least one slide')
    }

    const workDir = await mkdtemp(join(tmpdir(), 'socialshelf-video-'))
    try {
      const segmentPaths: string[] = []
      for (let i = 0; i < input.slides.length; i++) {
        const slide = input.slides[i]!
        const imagePath = join(workDir, `slide-${i}.jpg`)
        await writeFile(imagePath, slide.imageBuffer)

        const segmentPath = join(workDir, `segment-${i}.mp4`)
        const frames = Math.max(1, Math.round(slide.durationSeconds * FPS))
        await run('ffmpeg', [
          '-y',
          '-loop', '1',
          '-i', imagePath,
          '-vf',
          `scale=8000:-1,zoompan=z='min(zoom+${ZOOM_PER_FRAME},${MAX_ZOOM})':d=${frames}:s=${WIDTH}x${HEIGHT}:fps=${FPS}`,
          '-t', String(slide.durationSeconds),
          '-c:v', 'libx264',
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
        '-f', 'lavfi',
        '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-shortest',
        outputPath,
      ])

      const videoBuffer = await readFile(outputPath)
      const durationSeconds = input.slides.reduce((sum, s) => sum + s.durationSeconds, 0)
      return { videoBuffer, durationSeconds }
    } finally {
      await rm(workDir, { recursive: true, force: true })
    }
  }
}
