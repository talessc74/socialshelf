'use client'

// Pré-autorização explícita antes de qualquer geração de imagem por IA (_local-adr-policy-0NN)
// — o backend só sabe o número real de créditos consumidos depois de gerar, então o que
// mostramos aqui é sempre o teto do que essa ação pode custar, nunca uma estimativa que possa
// ficar pra trás do que de fato for cobrado.
export function CreditConfirmModal({
  creditsNeeded,
  onConfirm,
  onCancel,
  busy = false,
}: {
  creditsNeeded: number
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={busy ? undefined : onCancel}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-line bg-card p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Confirmar uso de créditos"
      >
        <h2 className="mb-2 text-sm font-semibold text-ink">Confirmar geração</h2>
        <p className="mb-5 text-sm text-muted">
          Isso vai consumir até <strong className="text-ink">{creditsNeeded}</strong>{' '}
          {creditsNeeded === 1 ? 'crédito' : 'créditos'} de IA.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-card-2 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent/90 disabled:opacity-50"
          >
            {busy ? 'Gerando…' : 'Gerar'}
          </button>
        </div>
      </div>
    </div>
  )
}
