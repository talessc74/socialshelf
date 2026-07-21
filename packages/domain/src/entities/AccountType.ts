// Tipo de conta de uma marca (_local-bdr-policy-009 + _local-adr-policy-030). 'personal' é
// a conta de quem cuida da própria marca — o dono é a pessoa, o texto fala em primeira
// pessoa e não há CTA de venda ("são só fotos"). 'professional' é a conta de agência/negócio,
// onde a copy cita a marca pelo nome e usa CTA. O ADR-030 previa este campo como imutável
// (proteção contra gaming de cobrança); enquanto não há billing real, ele é editável por um
// switch simples no site — a imutabilidade volta quando o billing for implementado.
export type AccountType = 'personal' | 'professional'

export const ALL_ACCOUNT_TYPES: AccountType[] = ['personal', 'professional']

// Marcas criadas antes deste campo existir, e a marca padrão de todo usuário histórico, contam
// como 'professional' — preserva o comportamento atual (que o usuário validou como bom) sem
// migração em lote (_local-adr-policy-030, ensureDefaultBrand).
export const DEFAULT_ACCOUNT_TYPE: AccountType = 'professional'

export function isAccountType(value: unknown): value is AccountType {
  return value === 'personal' || value === 'professional'
}
