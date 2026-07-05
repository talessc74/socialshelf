'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { ApiBrandProfile } from '../../lib/api'
import { LogoImage } from '../LogoImage'

type BrandDraft = Omit<ApiBrandProfile, 'id' | 'userId' | 'brandId' | 'version' | 'createdAt'>

const EMPTY_DRAFT: BrandDraft = {
  business: { name: '', segment: '', description: '' },
  identity: { positioning: '', values: [] },
  visual: { primaryColor: '#1a1a1a', secondaryColor: '#c9a84c', typography: 'Georgia, serif', logoStoragePath: null },
  voice: { tone: '', allowedVocabulary: [], prohibitedVocabulary: [] },
  narrative: { recurringThemes: [] },
  operation: { autonomyLevel: 'manual', autoPublishTopics: [], blockedTopics: [] },
}

interface MarcaBookContextValue {
  isLoading: boolean
  draft: BrandDraft
  hasProfile: boolean
  logoStoragePath: string | null
  notice: { type: 'success' | 'error'; message: string } | null
  saving: boolean
  uploadingLogo: boolean
  setBusiness: (field: keyof BrandDraft['business'], value: string) => void
  setPositioning: (value: string) => void
  setTone: (value: string) => void
  setColor: (which: 'primaryColor' | 'secondaryColor', value: string) => void
  setTypography: (value: string) => void
  addTag: (path: 'identity.values' | 'voice.allowedVocabulary' | 'voice.prohibitedVocabulary' | 'narrative.recurringThemes', value: string) => void
  removeTag: (path: 'identity.values' | 'voice.allowedVocabulary' | 'voice.prohibitedVocabulary' | 'narrative.recurringThemes', index: number) => void
  uploadLogo: (file: File) => Promise<void>
  save: () => void
}

const MarcaBookContext = createContext<MarcaBookContextValue | null>(null)

export function MarcaProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { data: profile, isLoading } = useQuery({
    queryKey: ['brand-profile'],
    queryFn: () => api.getBrandProfile(),
  })

  const [draft, setDraft] = useState<BrandDraft>(EMPTY_DRAFT)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current && profile) {
      setDraft({
        business: profile.business,
        identity: profile.identity,
        visual: profile.visual,
        voice: profile.voice,
        narrative: profile.narrative,
        operation: profile.operation,
      })
      initialized.current = true
    }
  }, [profile])

  const mutation = useMutation({
    mutationFn: (next: BrandDraft) => api.updateBrandProfile(next),
    onSuccess: (updated) => {
      queryClient.setQueryData(['brand-profile'], updated)
      setNotice({ type: 'success', message: 'Marca atualizada.' })
    },
    onError: () => setNotice({ type: 'error', message: 'Não foi possível salvar as mudanças.' }),
  })

  const setBusiness: MarcaBookContextValue['setBusiness'] = (field, value) => {
    setDraft((d) => ({ ...d, business: { ...d.business, [field]: value } }))
  }

  const setPositioning = (value: string) => {
    setDraft((d) => ({ ...d, identity: { ...d.identity, positioning: value } }))
  }

  const setTone = (value: string) => {
    setDraft((d) => ({ ...d, voice: { ...d.voice, tone: value } }))
  }

  const setColor: MarcaBookContextValue['setColor'] = (which, value) => {
    setDraft((d) => ({ ...d, visual: { ...d.visual, [which]: value } }))
  }

  const setTypography = (value: string) => {
    setDraft((d) => ({ ...d, visual: { ...d.visual, typography: value } }))
  }

  const addTag: MarcaBookContextValue['addTag'] = (path, value) => {
    if (!value.trim()) return
    setDraft((d) => {
      if (path === 'identity.values') return { ...d, identity: { ...d.identity, values: [...d.identity.values, value.trim()] } }
      if (path === 'voice.allowedVocabulary')
        return { ...d, voice: { ...d.voice, allowedVocabulary: [...d.voice.allowedVocabulary, value.trim()] } }
      if (path === 'voice.prohibitedVocabulary')
        return { ...d, voice: { ...d.voice, prohibitedVocabulary: [...d.voice.prohibitedVocabulary, value.trim()] } }
      return { ...d, narrative: { ...d.narrative, recurringThemes: [...d.narrative.recurringThemes, value.trim()] } }
    })
  }

  const removeTag: MarcaBookContextValue['removeTag'] = (path, index) => {
    setDraft((d) => {
      if (path === 'identity.values')
        return { ...d, identity: { ...d.identity, values: d.identity.values.filter((_, i) => i !== index) } }
      if (path === 'voice.allowedVocabulary')
        return { ...d, voice: { ...d.voice, allowedVocabulary: d.voice.allowedVocabulary.filter((_, i) => i !== index) } }
      if (path === 'voice.prohibitedVocabulary')
        return { ...d, voice: { ...d.voice, prohibitedVocabulary: d.voice.prohibitedVocabulary.filter((_, i) => i !== index) } }
      return { ...d, narrative: { ...d.narrative, recurringThemes: d.narrative.recurringThemes.filter((_, i) => i !== index) } }
    })
  }

  const uploadLogo = async (file: File) => {
    setUploadingLogo(true)
    try {
      const path = await api.uploadImage(file)
      const next = { ...draft, visual: { ...draft.visual, logoStoragePath: path } }
      setDraft(next)
      await mutation.mutateAsync(next)
    } catch {
      setNotice({ type: 'error', message: 'Não foi possível enviar a imagem.' })
    } finally {
      setUploadingLogo(false)
    }
  }

  const save = () => mutation.mutate(draft)

  const value: MarcaBookContextValue = {
    isLoading,
    draft,
    hasProfile: !!profile,
    logoStoragePath: draft.visual.logoStoragePath,
    notice,
    saving: mutation.isPending,
    uploadingLogo,
    setBusiness,
    setPositioning,
    setTone,
    setColor,
    setTypography,
    addTag,
    removeTag,
    uploadLogo,
    save,
  }

  return <MarcaBookContext.Provider value={value}>{children}</MarcaBookContext.Provider>
}

function useMarcaBook(): MarcaBookContextValue {
  const ctx = useContext(MarcaBookContext)
  if (!ctx) throw new Error('useMarcaBook deve ser usado dentro de MarcaProvider')
  return ctx
}

const SERIF = 'Georgia, "Times New Roman", serif'

function EditableText({
  value,
  onCommit,
  placeholder,
  style,
  multiline,
}: {
  value: string
  onCommit: (value: string) => void
  placeholder: string
  style?: React.CSSProperties
  multiline?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraftValue] = useState(value)

  useEffect(() => setDraftValue(value), [value])

  if (editing) {
    const commit = () => {
      setEditing(false)
      onCommit(draft)
    }
    if (multiline) {
      return (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraftValue(e.target.value)}
          onBlur={commit}
          rows={3}
          className="w-full resize-none border-none bg-black/[0.03] outline-none rounded"
          style={style}
        />
      )
    }
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraftValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        className="w-full border-none bg-black/[0.03] outline-none rounded"
        style={style}
      />
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="cursor-text hover:bg-black/[0.03] rounded transition-colors"
      style={style}
    >
      {value || <span style={{ opacity: 0.35 }}>{placeholder}</span>}
    </div>
  )
}

function TagRow({
  label,
  tags,
  onAdd,
  onRemove,
  tone = 'neutral',
}: {
  label: string
  tags: string[]
  onAdd: (value: string) => void
  onRemove: (index: number) => void
  tone?: 'neutral' | 'muted'
}) {
  const [adding, setAdding] = useState(false)
  const [value, setValue] = useState('')

  const commit = () => {
    if (value.trim()) onAdd(value)
    setValue('')
    setAdding(false)
  }

  return (
    <div className="mb-3">
      <p style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)' }} className="mb-1.5">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="group inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px]"
            style={{
              fontStyle: 'italic',
              background: tone === 'muted' ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.06)',
              color: 'rgba(0,0,0,0.65)',
            }}
          >
            {tag}
            <button onClick={() => onRemove(i)} className="opacity-0 group-hover:opacity-60 hover:!opacity-100" aria-label={`Remover ${tag}`}>
              ×
            </button>
          </span>
        ))}
        {adding ? (
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
            className="w-20 rounded-full border-none bg-black/[0.03] px-2 py-1 text-[10px] outline-none"
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="rounded-full px-2 py-1 text-[10px]"
            style={{ color: 'rgba(0,0,0,0.35)', border: '1px dashed rgba(0,0,0,0.2)' }}
          >
            + adicionar
          </button>
        )}
      </div>
    </div>
  )
}

function LogoMark() {
  const { logoStoragePath, draft, uploadLogo, uploadingLogo } = useMarcaBook()
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex justify-center mb-4">
      <button
        onClick={() => inputRef.current?.click()}
        className="relative h-20 w-20 rounded-full overflow-hidden flex items-center justify-center"
        style={{ background: draft.visual.primaryColor, boxShadow: '0 6px 20px rgba(0,0,0,0.25)' }}
        title="Clique para trocar a imagem da marca"
      >
        {logoStoragePath ? (
          <LogoImage path={logoStoragePath} className="h-full w-full" />
        ) : (
          <span style={{ fontFamily: SERIF, fontSize: '28px', color: '#fff' }}>
            {(draft.business.name || 'M')[0]?.toUpperCase()}
          </span>
        )}
        {uploadingLogo && <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-[9px] text-white">enviando…</div>}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void uploadLogo(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

export function MarcaDesktopLeft() {
  const { isLoading, draft, setBusiness, setPositioning } = useMarcaBook()

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-transparent" />
        Carregando…
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <LogoMark />

      <EditableText
        value={draft.business.name}
        onCommit={(v) => setBusiness('name', v)}
        placeholder="Nome da marca"
        style={{ fontFamily: SERIF, fontSize: '22px', textAlign: 'center', color: 'rgba(0,0,0,0.85)' }}
      />
      <EditableText
        value={draft.business.segment}
        onCommit={(v) => setBusiness('segment', v)}
        placeholder="segmento"
        style={{
          fontSize: '10px',
          textAlign: 'center',
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          color: 'rgba(0,0,0,0.4)',
          marginTop: '2px',
          marginBottom: '18px',
        }}
      />

      <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '14px' }}>
        <span style={{ fontFamily: SERIF, fontSize: '28px', color: draft.visual.primaryColor, lineHeight: 0.5 }}>“</span>
        <EditableText
          value={draft.identity.positioning}
          onCommit={setPositioning}
          placeholder="Como você quer que essa marca seja lembrada?"
          multiline
          style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: '13px', lineHeight: 1.5, color: 'rgba(0,0,0,0.72)' }}
        />
      </div>

      <div className="mt-4">
        <EditableText
          value={draft.business.description}
          onCommit={(v) => setBusiness('description', v)}
          placeholder="Conte a história desta marca — o que ela faz, para quem, e por quê."
          multiline
          style={{ fontSize: '11px', lineHeight: 1.6, color: 'rgba(0,0,0,0.65)' }}
        />
      </div>
    </div>
  )
}

export function MarcaDesktopRight() {
  const { draft, notice, saving, setColor, setTypography, setTone, addTag, removeTag, save } = useMarcaBook()

  return (
    <div className="flex flex-1 flex-col">
      {notice && (
        <div
          className={`mb-3 rounded-lg px-3 py-2 text-[11px] font-medium ${
            notice.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {notice.message}
        </div>
      )}

      <p style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)' }} className="mb-1.5">
        Paleta
      </p>
      <div className="flex gap-3 mb-4">
        {(['primaryColor', 'secondaryColor'] as const).map((which) => (
          <label key={which} className="relative cursor-pointer">
            <span
              className="block h-9 w-9 rounded-full"
              style={{ background: draft.visual[which], boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)' }}
            />
            <input
              type="color"
              value={draft.visual[which]}
              onChange={(e) => setColor(which, e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </label>
        ))}
      </div>

      <p style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)' }} className="mb-1.5">
        Tipografia
      </p>
      <EditableText
        value={draft.visual.typography}
        onCommit={setTypography}
        placeholder="Georgia, serif"
        style={{ fontFamily: draft.visual.typography || SERIF, fontSize: '16px', color: 'rgba(0,0,0,0.75)', marginBottom: '16px' }}
      />

      <p style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)' }} className="mb-1.5">
        Tom de voz
      </p>
      <EditableText
        value={draft.voice.tone}
        onCommit={setTone}
        placeholder="Como essa marca fala?"
        multiline
        style={{ fontSize: '11px', lineHeight: 1.5, color: 'rgba(0,0,0,0.65)', marginBottom: '16px' }}
      />

      <TagRow label="Valores" tags={draft.identity.values} onAdd={(v) => addTag('identity.values', v)} onRemove={(i) => removeTag('identity.values', i)} />
      <TagRow
        label="Temas recorrentes"
        tags={draft.narrative.recurringThemes}
        onAdd={(v) => addTag('narrative.recurringThemes', v)}
        onRemove={(i) => removeTag('narrative.recurringThemes', i)}
      />
      <TagRow
        label="Vocabulário permitido"
        tags={draft.voice.allowedVocabulary}
        onAdd={(v) => addTag('voice.allowedVocabulary', v)}
        onRemove={(i) => removeTag('voice.allowedVocabulary', i)}
        tone="muted"
      />

      <button
        onClick={save}
        disabled={saving}
        className="mt-auto w-fit rounded px-4 py-2 text-xs font-bold tracking-wide text-white disabled:opacity-50"
        style={{ background: draft.visual.primaryColor }}
      >
        {saving ? 'Salvando…' : 'Salvar marca'}
      </button>
    </div>
  )
}

const MOBILE_PAGES = ['capa', 'historia', 'identidade', 'vocabulario'] as const

export function MarcaMobile() {
  const { isLoading, draft, notice, saving, setBusiness, setPositioning, setColor, setTypography, setTone, addTag, removeTag, save } =
    useMarcaBook()
  const [pageIndex, setPageIndex] = useState(0)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-transparent" />
        Carregando…
      </div>
    )
  }

  const page = MOBILE_PAGES[pageIndex]

  return (
    <div className="flex flex-col gap-3">
      {notice && (
        <div
          className={`rounded-lg px-3 py-2 text-[11px] font-medium ${
            notice.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {notice.message}
        </div>
      )}

      {page === 'capa' && (
        <div>
          <LogoMark />
          <EditableText
            value={draft.business.name}
            onCommit={(v) => setBusiness('name', v)}
            placeholder="Nome da marca"
            style={{ fontFamily: SERIF, fontSize: '20px', textAlign: 'center', color: 'rgba(0,0,0,0.85)' }}
          />
          <EditableText
            value={draft.business.segment}
            onCommit={(v) => setBusiness('segment', v)}
            placeholder="segmento"
            style={{
              fontSize: '10px',
              textAlign: 'center',
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              color: 'rgba(0,0,0,0.4)',
              marginTop: '2px',
            }}
          />
        </div>
      )}

      {page === 'historia' && (
        <div>
          <span style={{ fontFamily: SERIF, fontSize: '24px', color: draft.visual.primaryColor, lineHeight: 0.5 }}>“</span>
          <EditableText
            value={draft.identity.positioning}
            onCommit={setPositioning}
            placeholder="Como você quer que essa marca seja lembrada?"
            multiline
            style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: '13px', lineHeight: 1.5, color: 'rgba(0,0,0,0.72)', marginBottom: '12px' }}
          />
          <EditableText
            value={draft.business.description}
            onCommit={(v) => setBusiness('description', v)}
            placeholder="Conte a história desta marca."
            multiline
            style={{ fontSize: '11px', lineHeight: 1.6, color: 'rgba(0,0,0,0.65)' }}
          />
        </div>
      )}

      {page === 'identidade' && (
        <div>
          <p style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)' }} className="mb-1.5">
            Paleta
          </p>
          <div className="flex gap-3 mb-4">
            {(['primaryColor', 'secondaryColor'] as const).map((which) => (
              <label key={which} className="relative cursor-pointer">
                <span className="block h-9 w-9 rounded-full" style={{ background: draft.visual[which], boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)' }} />
                <input type="color" value={draft.visual[which]} onChange={(e) => setColor(which, e.target.value)} className="absolute inset-0 opacity-0" />
              </label>
            ))}
          </div>
          <p style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)' }} className="mb-1.5">
            Tipografia
          </p>
          <EditableText
            value={draft.visual.typography}
            onCommit={setTypography}
            placeholder="Georgia, serif"
            style={{ fontFamily: draft.visual.typography || SERIF, fontSize: '15px', color: 'rgba(0,0,0,0.75)', marginBottom: '14px' }}
          />
          <p style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)' }} className="mb-1.5">
            Tom de voz
          </p>
          <EditableText
            value={draft.voice.tone}
            onCommit={setTone}
            placeholder="Como essa marca fala?"
            multiline
            style={{ fontSize: '11px', lineHeight: 1.5, color: 'rgba(0,0,0,0.65)' }}
          />
        </div>
      )}

      {page === 'vocabulario' && (
        <div>
          <TagRow label="Valores" tags={draft.identity.values} onAdd={(v) => addTag('identity.values', v)} onRemove={(i) => removeTag('identity.values', i)} />
          <TagRow
            label="Temas recorrentes"
            tags={draft.narrative.recurringThemes}
            onAdd={(v) => addTag('narrative.recurringThemes', v)}
            onRemove={(i) => removeTag('narrative.recurringThemes', i)}
          />
          <TagRow
            label="Vocabulário permitido"
            tags={draft.voice.allowedVocabulary}
            onAdd={(v) => addTag('voice.allowedVocabulary', v)}
            onRemove={(i) => removeTag('voice.allowedVocabulary', i)}
            tone="muted"
          />
          <button
            onClick={save}
            disabled={saving}
            className="mt-2 w-full rounded px-4 py-2 text-xs font-bold tracking-wide text-white disabled:opacity-50"
            style={{ background: draft.visual.primaryColor }}
          >
            {saving ? 'Salvando…' : 'Salvar marca'}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <button
          disabled={pageIndex === 0}
          onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
          className="rounded-full bg-black/5 px-3 py-1 text-[10px] font-semibold disabled:opacity-30"
          style={{ color: 'rgba(0,0,0,0.6)' }}
        >
          ← Anterior
        </button>
        <span className="text-[10px]" style={{ color: 'rgba(0,0,0,0.4)' }}>
          {pageIndex + 1} / {MOBILE_PAGES.length}
        </span>
        <button
          disabled={pageIndex === MOBILE_PAGES.length - 1}
          onClick={() => setPageIndex((p) => Math.min(MOBILE_PAGES.length - 1, p + 1))}
          className="rounded-full bg-black/5 px-3 py-1 text-[10px] font-semibold disabled:opacity-30"
          style={{ color: 'rgba(0,0,0,0.6)' }}
        >
          Próxima →
        </button>
      </div>
    </div>
  )
}
