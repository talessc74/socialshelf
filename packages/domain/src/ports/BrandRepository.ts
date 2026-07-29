import type { Brand } from '../entities/Brand.js'

export interface BrandRepository {
  save(brand: Brand): Promise<void>
  findById(userId: string, brandId: string): Promise<Brand | null>
  findByUserId(userId: string): Promise<Brand[]>
  delete(userId: string, brandId: string): Promise<void>
  // Lista todas as marcas de todas as contas — só para a tela de admin de gastos
  // (_local-edr-policy-072). Nunca usar em um caminho acessível a um usuário comum.
  findAll(): Promise<Brand[]>
}
