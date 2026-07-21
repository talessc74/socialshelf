import type { CampaignPhoto } from '@socialshelf/domain'

// Distância de Hamming abaixo da qual duas fotos são consideradas "quase-iguais" e colapsadas
// (dHash de 64 bits). 0 = idênticas; edições leves/recompressão ~1–4; a mesma cena em disparos
// consecutivos ~5–12; fotos realmente distintas > 20. 8 pega rajada/quase-repetição sem colapsar
// fotos genuinamente diferentes (ajustável numa revisão futura se o corte ficar agressivo demais).
export const NEAR_DUPLICATE_THRESHOLD = 8

const HEX_BITCOUNT: Record<string, number> = {
  '0': 0, '1': 1, '2': 1, '3': 2, '4': 1, '5': 2, '6': 2, '7': 3,
  '8': 1, '9': 2, a: 2, b: 3, c: 2, d: 3, e: 3, f: 4,
}

// Conta os bits diferentes entre dois dHash em hex do mesmo tamanho. Hashes de tamanhos
// diferentes (não deveria acontecer) retornam Infinity — nunca são tratados como quase-iguais.
export function hammingDistanceHex(a: string, b: string): number {
  if (a.length !== b.length) return Infinity
  let distance = 0
  for (let i = 0; i < a.length; i++) {
    const xor = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16)
    distance += HEX_BITCOUNT[xor.toString(16)] ?? 0
  }
  return distance
}

export interface CollapseResult {
  // Representantes na ordem original — o que de fato entra nos carrosséis.
  kept: CampaignPhoto[]
  // Fotos deixadas de fora por serem quase-iguais a um representante já mantido, com o id dele.
  extras: Array<{ photo: CampaignPhoto; representativeId: string }>
}

/**
 * Percorre as fotos na ordem dada e colapsa as quase-iguais: a primeira de cada grupo vira o
 * representante mantido; as seguintes, se estiverem a até `threshold` bits de algum representante
 * já mantido, viram "extras" apontando pra ele. Fotos sem hash perceptual nunca são tratadas como
 * duplicata (entram sempre como representantes). Nada é descartado — os extras são devolvidos pra
 * aparecerem no pool da tela de revisão.
 */
export function collapseNearDuplicates(
  photos: CampaignPhoto[],
  threshold: number = NEAR_DUPLICATE_THRESHOLD,
): CollapseResult {
  const kept: CampaignPhoto[] = []
  const extras: Array<{ photo: CampaignPhoto; representativeId: string }> = []

  for (const photo of photos) {
    if (photo.perceptualHash === null) {
      kept.push(photo)
      continue
    }
    const representative = kept.find(
      (k) => k.perceptualHash !== null && hammingDistanceHex(k.perceptualHash, photo.perceptualHash!) <= threshold,
    )
    if (representative) {
      extras.push({ photo, representativeId: representative.id })
    } else {
      kept.push(photo)
    }
  }

  return { kept, extras }
}
