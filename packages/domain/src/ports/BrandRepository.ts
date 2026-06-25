import type { Brand } from '../entities/Brand.js'

export interface BrandRepository {
  save(brand: Brand): Promise<void>
  findById(userId: string, brandId: string): Promise<Brand | null>
  findByUserId(userId: string): Promise<Brand[]>
  delete(userId: string, brandId: string): Promise<void>
}
