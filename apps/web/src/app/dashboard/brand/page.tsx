'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type ApiBrandProfile } from '../../../lib/api'
import type { AutonomyLevel } from '@socialshelf/domain'
import { TagListEditor } from '../../../components/TagListEditor'
import { BrandPostPreview } from '../../../components/BrandPostPreview'

type BrandProfileForm = Omit<ApiBrandProfile, 'id' | 'userId' | 'brandId' | 'version' | 'createdAt'>

const EMPTY_FORM: BrandProfileForm = {
  business: { name: '', segment: '', description: '' },
  identity: { positioning: '', values: [] },
  visual: { primaryColor: '#9d174d', secondaryColor: '#1f2937', typography: 'Inter', logoStoragePath: null },
  voice: { tone: '', allowedVocabulary: [], prohibitedVocabulary: [] },
  narrative: { recurringThemes: [] },
  operation: { autonomyLevel: 'manual', autoPublishTopics: [], blockedTopics: [] },
}

const PALETTE_PRESETS: Array<{ label: string; description: string; primaryColor: string; secondaryColor: string }> = [
  { label: 'Mono + Azul', description: 'Clássico extremo', primaryColor: '#2563eb', secondaryColor: '#0f172a' },
  { label: 'Slate + Indigo', description: 'Tech moderno', primaryColor: '#6366f1', secondaryColor: '#1e293b' },
  { label: 'Stone + Âmbar', description: 'Warm editorial', primaryColor: '#f59e0b', secondaryColor: '#44403c' },
  { label: 'Black + Verde', description: 'Energia startup', primaryColor: '#22c55e', secondaryColor: '#171717' },
  { label: 'Off-white + Coral', description: 'Lifestyle', primaryColor: '#f43f5e', secondaryColor: '#27272a' },
  { label: 'Pastel Wellness', description: 'Wellness/coach', primaryColor: '#ec4899', secondaryColor: '#475569' },
  { label: 'Vintage Editorial', description: 'Retrô/literatura', primaryColor: '#b91c1c', secondaryColor: '#292524' },
  { label: 'Tropical Bright', description: 'Juventude/energia', primaryColor: '#fb923c', secondaryColor: '#115e59' },
]

const AUTONOMY_OPTIONS: Array<{ value: AutonomyLevel; label: string; description: string }> = [
  { value: 'manual', label: 'Manual', description: 'A IA sugere, você revisa e publica cada post manualmente.' },
  {
    value: 'semi-automatic',
    label: 'Semi-automático',
    description: 'A IA cria os rascunhos prontos; você só aprova antes de publicar.',
  },
  {
    value: 'automatic',
    label: 'Automático',
    description: 'A IA cria e publica sozinha, dentro dos tópicos liberados.',
  },
]

const TYPOGRAPHY_OPTIONS = ['Inter', 'sans-serif bold', 'serif']

export default function BrandSettingsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<BrandProfileForm>(EMPTY_FORM)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [extractionNotice, setExtractionNotice] = useState('')

  const { data: brandProfile, isLoading } = useQuery({
    queryKey: ['brand-profile'],
    queryFn: () => api.getBrandProfile(),
  })

  useEffect(() => {
    if (brandProfile) {
      setForm({
        business: brandProfile.business,
        identity: brandProfile.identity,
        visual: brandProfile.visual,
        voice: brandProfile.voice,
        narrative: brandProfile.narrative,
        operation: brandProfile.operation,
      })
    }
  }, [brandProfile])

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setUploading(true)
    try {
      const path = await api.uploadImage(file)
      setForm((prev) => ({ ...prev, visual: { ...prev.visual, logoStoragePath: path } }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar o logo.')
    } finally {
      setUploading(false)
    }
  }

  const handleDocumentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setExtractionNotice('')
    setExtracting(true)
    try {
      const extraction = await api.uploadBrandDocument(file)
      const next: BrandProfileForm = {
        ...form,
        business: { ...form.business },
        identity: { ...form.identity },
        voice: { ...form.voice },
        narrative: { ...form.narrative },
      }
      let filledCount = 0
      const fillText = (current: string, incoming: string | undefined): string => {
        if (current.trim() || !incoming) return current
        filledCount++
        return incoming
      }
      const fillList = (current: string[], incoming: string[] | undefined): string[] => {
        if (current.length > 0 || !incoming?.length) return current
        filledCount++
        return incoming
      }

      if (extraction.business) {
        next.business.name = fillText(next.business.name, extraction.business.name)
        next.business.segment = fillText(next.business.segment, extraction.business.segment)
        next.business.description = fillText(next.business.description, extraction.business.description)
      }
      if (extraction.identity) {
        next.identity.positioning = fillText(next.identity.positioning, extraction.identity.positioning)
        next.identity.values = fillList(next.identity.values, extraction.identity.values)
      }
      if (extraction.voice) {
        next.voice.tone = fillText(next.voice.tone, extraction.voice.tone)
        next.voice.allowedVocabulary = fillList(next.voice.allowedVocabulary, extraction.voice.allowedVocabulary)
        next.voice.prohibitedVocabulary = fillList(next.voice.prohibitedVocabulary, extraction.voice.prohibitedVocabulary)
      }
      if (extraction.narrative) {
        next.narrative.recurringThemes = fillList(next.narrative.recurringThemes, extraction.narrative.recurringThemes)
      }

      setForm(next)
      setExtractionNotice(
        filledCount > 0
          ? `Preenchemos ${filledCount} campo(s) que estavam vazios com base no documento. Revise e salve quando estiver pronto.`
          : 'O documento não trouxe informação nova para os campos que ainda estão vazios.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar o documento.')
    } finally {
      setExtracting(false)
    }
  }

  const handleSave = async () => {
    setError('')
    setSaved(false)
    setSaving(true)
    try {
      await api.updateBrandProfile(form)
      await queryClient.invalidateQueries({ queryKey: ['brand-profile'] })
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar a marca.')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        Carregando…
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">
          ← Voltar
        </button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Painel da marca</p>
          <h1 className="text-2xl font-bold text-gray-900">Configurações da Marca</h1>
        </div>
      </div>

      {!brandProfile && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Você ainda não tem uma marca cadastrada. Preencha os campos abaixo e salve para criar a primeira versão.
        </p>
      )}

      <p className="text-xs text-gray-400">
        Cada vez que você salva, é criada uma nova versão da marca — posts já criados continuam usando a
        versão da época em que foram gerados.
      </p>

      <section className="space-y-3 rounded-2xl border border-brand-100 bg-white p-5 shadow-sm shadow-brand-100/60">
        <h2 className="text-sm font-semibold text-gray-700">Documento da marca</h2>
        <p className="text-xs text-gray-400">
          Opcional: suba um documento (PDF ou TXT) com detalhes da marca ou do produto. A IA lê e preenche
          automaticamente os campos abaixo que ainda estiverem vazios — campos já preenchidos não são alterados.
        </p>
        <input
          type="file"
          accept="application/pdf,text/plain"
          onChange={handleDocumentChange}
          disabled={extracting}
          className="block w-full text-sm text-gray-600"
        />
        {extracting && <p className="text-xs text-gray-400">Lendo documento…</p>}
        {extractionNotice && <p className="text-xs font-medium text-brand-700">{extractionNotice}</p>}
      </section>

      <section className="space-y-4 rounded-2xl border border-brand-100 bg-white p-5 shadow-sm shadow-brand-100/60">
        <h2 className="text-sm font-semibold text-gray-700">Negócio</h2>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">Nome da marca</label>
          <input
            type="text"
            value={form.business.name}
            onChange={(e) => setForm((prev) => ({ ...prev, business: { ...prev.business, name: e.target.value } }))}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">Segmento</label>
          <input
            type="text"
            value={form.business.segment}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, business: { ...prev.business, segment: e.target.value } }))
            }
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">Descrição</label>
          <textarea
            value={form.business.description}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, business: { ...prev.business, description: e.target.value } }))
            }
            rows={3}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-brand-100 bg-white p-5 shadow-sm shadow-brand-100/60">
        <h2 className="text-sm font-semibold text-gray-700">Identidade</h2>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">Posicionamento</label>
          <textarea
            value={form.identity.positioning}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, identity: { ...prev.identity, positioning: e.target.value } }))
            }
            rows={2}
            placeholder="Como a marca quer ser percebida pelo público"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          />
        </div>
        <TagListEditor
          label="Valores"
          placeholder="Ex: transparência"
          values={form.identity.values}
          onChange={(values) => setForm((prev) => ({ ...prev, identity: { ...prev.identity, values } }))}
        />
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">Logo</label>
          <p className="mb-2 text-xs text-gray-400">Aparece como ícone fixo em cada card gerado.</p>
          {form.visual.logoStoragePath && (
            <p className="mb-2 text-xs font-medium text-green-700">Logo cadastrado.</p>
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleLogoChange}
            disabled={uploading}
            className="block w-full text-sm text-gray-600"
          />
          {uploading && <p className="mt-1 text-xs text-gray-400">Enviando…</p>}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-brand-100 bg-white p-5 shadow-sm shadow-brand-100/60">
        <h2 className="text-sm font-semibold text-gray-700">Visual</h2>
        <div>
          <p className="mb-2 text-sm font-semibold text-gray-700">Paletas prontas</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {PALETTE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    visual: { ...prev.visual, primaryColor: preset.primaryColor, secondaryColor: preset.secondaryColor },
                  }))
                }
                className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5 text-left hover:border-brand-300 hover:bg-brand-50"
              >
                <span className="flex shrink-0 gap-1">
                  <span className="h-6 w-6 rounded-full" style={{ backgroundColor: preset.primaryColor }} />
                  <span className="h-6 w-6 rounded-full" style={{ backgroundColor: preset.secondaryColor }} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-gray-800">{preset.label}</span>
                  <span className="block text-xs text-gray-400">{preset.description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">Cor primária</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.visual.primaryColor}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, visual: { ...prev.visual, primaryColor: e.target.value } }))
                }
                className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-gray-200"
              />
              <input
                type="text"
                value={form.visual.primaryColor}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, visual: { ...prev.visual, primaryColor: e.target.value } }))
                }
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono focus:border-brand-400 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">Cor secundária</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.visual.secondaryColor}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, visual: { ...prev.visual, secondaryColor: e.target.value } }))
                }
                className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-gray-200"
              />
              <input
                type="text"
                value={form.visual.secondaryColor}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, visual: { ...prev.visual, secondaryColor: e.target.value } }))
                }
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono focus:border-brand-400 focus:outline-none"
              />
            </div>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">Tipografia</label>
          <select
            value={form.visual.typography}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, visual: { ...prev.visual, typography: e.target.value } }))
            }
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          >
            {TYPOGRAPHY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-gray-700">Pré-visualização</p>
          <p className="mb-3 text-xs text-gray-400">
            Como o logo e a cor primária aparecem nos cards gerados, em tempo real.
          </p>
          <BrandPostPreview
            primaryColor={form.visual.primaryColor}
            logoStoragePath={form.visual.logoStoragePath}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-brand-100 bg-white p-5 shadow-sm shadow-brand-100/60">
        <h2 className="text-sm font-semibold text-gray-700">Voz</h2>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">Tom de voz</label>
          <input
            type="text"
            value={form.voice.tone}
            onChange={(e) => setForm((prev) => ({ ...prev, voice: { ...prev.voice, tone: e.target.value } }))}
            placeholder="Ex: direto e provocativo"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          />
        </div>
        <TagListEditor
          label="Vocabulário permitido"
          placeholder="Palavra ou expressão"
          values={form.voice.allowedVocabulary}
          onChange={(allowedVocabulary) =>
            setForm((prev) => ({ ...prev, voice: { ...prev.voice, allowedVocabulary } }))
          }
        />
        <TagListEditor
          label="Termos proibidos"
          placeholder="Palavra que a marca nunca usa"
          values={form.voice.prohibitedVocabulary}
          onChange={(prohibitedVocabulary) =>
            setForm((prev) => ({ ...prev, voice: { ...prev.voice, prohibitedVocabulary } }))
          }
        />
      </section>

      <section className="space-y-4 rounded-2xl border border-brand-100 bg-white p-5 shadow-sm shadow-brand-100/60">
        <h2 className="text-sm font-semibold text-gray-700">Narrativa</h2>
        <TagListEditor
          label="Temas recorrentes"
          helperText="Assuntos que a marca sempre volta a abordar."
          placeholder="Ex: produtividade"
          values={form.narrative.recurringThemes}
          onChange={(recurringThemes) => setForm((prev) => ({ ...prev, narrative: { recurringThemes } }))}
        />
      </section>

      <section className="space-y-4 rounded-2xl border border-brand-100 bg-white p-5 shadow-sm shadow-brand-100/60">
        <h2 className="text-sm font-semibold text-gray-700">Operação</h2>
        <div>
          <p className="mb-2 text-sm font-semibold text-gray-700">Nível de autonomia da IA</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {AUTONOMY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  setForm((prev) => ({ ...prev, operation: { ...prev.operation, autonomyLevel: opt.value } }))
                }
                className={`rounded-xl border p-3 text-left ${
                  form.operation.autonomyLevel === opt.value
                    ? 'border-brand-600 bg-brand-50'
                    : 'border-gray-200 hover:border-brand-300'
                }`}
              >
                <span className="block text-sm font-semibold text-gray-800">{opt.label}</span>
                <span className="block text-xs text-gray-500">{opt.description}</span>
              </button>
            ))}
          </div>
        </div>
        <TagListEditor
          label="Tópicos com publicação automática liberada"
          placeholder="Ex: lançamento de produto"
          values={form.operation.autoPublishTopics}
          onChange={(autoPublishTopics) =>
            setForm((prev) => ({ ...prev, operation: { ...prev.operation, autoPublishTopics } }))
          }
        />
        <TagListEditor
          label="Tópicos bloqueados"
          placeholder="Ex: política"
          values={form.operation.blockedTopics}
          onChange={(blockedTopics) =>
            setForm((prev) => ({ ...prev, operation: { ...prev.operation, blockedTopics } }))
          }
        />
      </section>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {saved && (
        <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">Marca salva com sucesso.</p>
      )}

      <div className="sticky bottom-4 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || !form.business.name.trim()}
          className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-200 hover:bg-brand-700 disabled:opacity-40"
        >
          {saving ? 'Salvando…' : 'Salvar marca'}
        </button>
      </div>
    </div>
  )
}
