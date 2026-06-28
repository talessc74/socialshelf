/* eslint-disable @next/next/no-img-element */
'use client'

// Protótipo isolado — direção "Editorial Escuro & Sofisticado".
// Dados fictícios. Não substitui nenhuma tela real.

const creations = [
  {
    title: 'IA não substitui advogado. Mas o advogado que usa IA substitui o que não usa.',
    platform: 'LinkedIn',
    grad: 'from-[#D4AF6A] to-[#8A6A3F]',
    reach: '2.4k',
    rate: '6.1%',
  },
  {
    title: '3 erros que escritórios cometem ao adotar IA jurídica',
    platform: 'Instagram',
    grad: 'from-[#4A5C8A] to-[#2B3354]',
    reach: '1.8k',
    rate: '4.7%',
  },
  {
    title: 'O futuro da advocacia é colaborativo — humano + máquina',
    platform: 'LinkedIn',
    grad: 'from-[#3E6B5C] to-[#1F3B33]',
    reach: '3.1k',
    rate: '8.0%',
  },
]

export default function StudioPreviewDark() {
  return (
    <div className="min-h-screen bg-[#0B0D12] text-[#EDEAE3]">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0B0D12]/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo-icon.png" alt="" className="h-8 w-8 rounded-lg" />
            <span className="text-lg font-bold tracking-tight">
              Social<span className="text-[#D4AF6A]">Shelf</span>
            </span>
          </div>
          <nav className="hidden items-center gap-7 text-sm font-medium text-white/50 md:flex">
            <a className="text-white">Estúdio</a>
            <a className="transition-colors hover:text-white">Criações</a>
            <a className="transition-colors hover:text-white">Notícias</a>
            <a className="transition-colors hover:text-white">Desempenho</a>
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-white/40 sm:block">talessc@gmail.com</span>
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#D4AF6A] to-[#8A6A3F]" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <section className="pt-14 pb-10">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#D4AF6A]">
            Quinta-feira · seu estúdio
          </p>
          <h1 className="max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Bora criar algo que{' '}
            <span className="bg-gradient-to-r from-[#D4AF6A] to-[#F0D9A8] bg-clip-text text-transparent">
              valha o feed
            </span>
            , Tales?
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/55">
            Sua audiência cresceu 12% esta semana. Que tal manter o ritmo com uma ideia nova?
          </p>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          <button className="group relative col-span-2 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#1A1D27] to-[#0B0D12] p-8 text-left shadow-2xl shadow-black/40 transition-transform duration-300 hover:-translate-y-1">
            <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-[#D4AF6A]/15 blur-2xl" />
            <span className="inline-flex items-center gap-2 rounded-full bg-[#D4AF6A]/15 px-3 py-1 text-xs font-semibold text-[#D4AF6A]">
              ✦ Comece agora
            </span>
            <h2 className="mt-5 max-w-md text-3xl font-bold leading-tight text-white">
              Transforme uma ideia em post com IA
            </h2>
            <p className="mt-2 max-w-sm text-white/55">
              Descreva o tema. A gente escreve, ilustra e adapta para cada rede.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#D4AF6A] px-5 py-2.5 text-sm font-semibold text-[#0B0D12] transition-transform group-hover:gap-3">
              Criar com IA →
            </span>
          </button>

          <div className="flex flex-col gap-5">
            <button className="flex-1 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-left transition-all hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06]">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-xl">✍️</div>
              <h3 className="font-semibold text-white">Escrever do zero</h3>
              <p className="mt-1 text-sm text-white/45">Sua voz, sua pauta.</p>
            </button>
            <button className="flex-1 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-left transition-all hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06]">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-xl">📰</div>
              <h3 className="font-semibold text-white">A partir de uma notícia</h3>
              <p className="mt-1 text-sm text-white/45">Surfe o que está em alta.</p>
            </button>
          </div>
        </section>

        <section className="mt-16">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Suas criações</h2>
              <p className="mt-1 text-white/45">O que sua marca tem dito ao mundo.</p>
            </div>
            <a className="text-sm font-semibold text-[#D4AF6A] hover:underline">Ver todas →</a>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {creations.map((c) => (
              <article
                key={c.title}
                className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] transition-all hover:-translate-y-1 hover:border-white/20"
              >
                <div className={`relative flex h-44 items-end bg-gradient-to-br ${c.grad} p-5`}>
                  <span className="absolute right-4 top-4 rounded-full bg-black/30 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
                    {c.platform}
                  </span>
                  <p className="text-lg font-semibold leading-snug text-white drop-shadow">
                    {c.title}
                  </p>
                </div>
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex gap-5 text-sm">
                    <span>
                      <span className="font-bold text-white">{c.reach}</span>{' '}
                      <span className="text-white/45">alcance</span>
                    </span>
                    <span>
                      <span className="font-bold text-[#7FCBA8]">{c.rate}</span>{' '}
                      <span className="text-white/45">engaj.</span>
                    </span>
                  </div>
                  <span className="text-white/30 transition-colors group-hover:text-[#D4AF6A]">↻</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-5 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#1A1D27] to-[#0B0D12] p-7 md:col-span-2">
            <span className="text-2xl">🎉</span>
            <h3 className="mt-3 text-xl font-bold text-white">
              Seu melhor post da semana bombou: 8% de engajamento.
            </h3>
            <p className="mt-2 max-w-md text-white/55">
              Posts colaborativos (humano + IA) vêm performando 40% acima. Quer fazer outro nesse tom?
            </p>
            <button className="mt-5 rounded-full bg-[#D4AF6A] px-5 py-2.5 text-sm font-semibold text-[#0B0D12] transition-transform hover:-translate-y-0.5">
              Criar parecido
            </button>
          </div>
          <div className="flex flex-col justify-center rounded-3xl border border-white/10 bg-white/[0.03] p-7">
            <p className="text-sm text-white/45">Ritmo da semana</p>
            <p className="mt-2 text-4xl font-bold text-white">4 / 5</p>
            <p className="mt-1 text-white/55">posts publicados</p>
            <div className="mt-4 flex gap-1.5">
              {[1, 1, 1, 1, 0].map((on, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${on ? 'bg-[#D4AF6A]' : 'bg-white/10'}`}
                />
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
