import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { DEFAULT_ACCOUNT_TYPE, Platform } from '@socialshelf/domain'
import type { Brand } from '@socialshelf/domain'
import { FirestoreBrandRepository } from '../infrastructure/firestore/FirestoreBrandRepository.js'
import { FirestoreBrandProfileRepository } from '../infrastructure/firestore/FirestoreBrandProfileRepository.js'

const platformEnum = z.enum([
  Platform.LINKEDIN,
  Platform.FACEBOOK,
  Platform.INSTAGRAM,
  Platform.TWITTER,
])

const accountTypeEnum = z.enum(['personal', 'professional'])

const createBrandSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  accountType: accountTypeEnum.default(DEFAULT_ACCOUNT_TYPE),
})

// accountType é editável aqui por ora — o switch pessoal/profissional do site. O ADR-030 o
// previa imutável (proteção contra gaming de cobrança); como billing ainda não existe, o switch
// vale para o piloto e a imutabilidade volta quando o billing for implementado (emenda pendente).
const updateBrandSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  platforms: z.array(platformEnum).optional(),
  accountType: accountTypeEnum.optional(),
})

function toPublicBrand(brand: Brand) {
  return { id: brand.id, name: brand.name, slug: brand.slug, platforms: brand.platforms, accountType: brand.accountType }
}

export async function brandsRoutes(app: FastifyInstance) {
  const brandRepo = new FirestoreBrandRepository()
  const brandProfileRepo = new FirestoreBrandProfileRepository()

  // Cobre todo usuário existente sem migração em lote: como brandId === userId
  // hoje, dados já existentes (conexões, posts, brand profiles) já estão no
  // caminho certo — só nunca tiveram um documento de Brand correspondente.
  async function ensureDefaultBrand(userId: string): Promise<Brand[]> {
    const existing = await brandRepo.findByUserId(userId)
    if (existing.length > 0) return existing

    const profile = await brandProfileRepo.findLatestByBrand(userId, userId)
    const now = new Date()
    const defaultBrand: Brand = {
      id: userId,
      userId,
      name: profile?.business.name ?? 'Minha Marca',
      slug: 'default',
      platforms: [],
      // Marca padrão histórica é profissional — preserva o comportamento atual (_local-adr-policy-030).
      accountType: DEFAULT_ACCOUNT_TYPE,
      createdAt: now,
      updatedAt: now,
    }
    await brandRepo.save(defaultBrand)
    return [defaultBrand]
  }

  app.get(
    '/brands',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const brands = await ensureDefaultBrand(request.userId)
      return reply.send({ brands: brands.map(toPublicBrand) })
    },
  )

  app.post(
    '/brands',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = createBrandSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.flatten() })
      }

      const now = new Date()
      const brand: Brand = {
        id: randomUUID(),
        userId: request.userId,
        name: parsed.data.name,
        slug: parsed.data.slug,
        platforms: [],
        accountType: parsed.data.accountType,
        createdAt: now,
        updatedAt: now,
      }
      await brandRepo.save(brand)
      return reply.status(201).send({ brand: toPublicBrand(brand) })
    },
  )

  app.patch(
    '/brands/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const parsed = updateBrandSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.flatten() })
      }

      const existing = await brandRepo.findById(request.userId, id)
      if (!existing) return reply.status(404).send({ error: 'Brand not found' })

      const updated: Brand = {
        ...existing,
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.slug !== undefined && { slug: parsed.data.slug }),
        ...(parsed.data.platforms !== undefined && { platforms: parsed.data.platforms }),
        ...(parsed.data.accountType !== undefined && { accountType: parsed.data.accountType }),
        updatedAt: new Date(),
      }
      await brandRepo.save(updated)
      return reply.send({ brand: toPublicBrand(updated) })
    },
  )
}
