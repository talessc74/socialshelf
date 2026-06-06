export interface TokenVaultPort {
  store(ref: string, token: string): Promise<void>
  retrieve(ref: string): Promise<string>
  delete(ref: string): Promise<void>
}
