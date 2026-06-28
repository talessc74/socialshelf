/* eslint-disable @next/next/no-img-element */
'use client'

// Protótipo isolado — direção "Vibrante & Expressivo".
// Dados fictícios. Não substitui nenhuma tela real.

const creations = [
  {
    title: 'IA não substitui advogado. Mas o advogado que usa IA substitui o que não usa.',
    platform: 'LinkedIn',
    grad: 'from-[#FF3D9A] to-[#7C3AED]',
    reach: '2.4k',
    rate: '6.1%',
  },
  {
    title: '3 erros que escritórios cometem ao adotar IA jurídica',
    platform: 'Instagram',
    grad: 'from-[#06B6D4] to-[#3B82F6]',
    reach: '1.8k',
    rate: '4.7%',
  },
  {
    title: 'O futuro da advocacia é colaborativo — humano + máquina',
    platform: 'LinkedIn',
    grad: 'from-[#FACC15] to-[#FB923C]',
    reach: '3.1k',
    rate: '8.0%',
  },
]

export default function StudioPreviewVibrant() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0F0A1F] text-white">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#FF3D9A]/30 blur-[100px]" />
      <div className="pointer-events-none absolute -right-20 top-40 h-[28rem] w-[28rem] rounded-full bg-[#7C3AED]/30 blur-[120px]" />
      <div className="pointer-events-none absolute left-1/3 top-[60rem] h-96 w-96 rounded-full bg-[#06B6D4]/20 blur-[110px]" />

      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0F0A1F]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo-icon.png" alt="" className="h-8 w-8 rounded-lg" />
            <span className="text-lg font-bold tracking-tight">
              Social<span className="bg-gradient-to-r from-[#FF3D9A] to-[#7C3AED] bg-clip-text text-transparent">Shelf</span>
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
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#FF3D9A] to-[#7C3AED]" />
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 pb-24">
        <section className="pt-14 pb-10">
          <p className="mb-3 inline-block rounded-full bg-white/10 px-3 py-1 text-sm font-semibold uppercase tracking-[0.18em] text-[#FF3D9A]">
            Quinta-feira · seu estúdio
          </p>
          <h1 className="max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Bora criar algo que{' '}
            <span className="bg-gradient-to-r from-[#FF3D9A] via-[#7C3AED] to-[#06B6D4] bg-clip-text text-transparent">
              valha o feed
            </span>
            , Tales?
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/60">
            Sua audiência cresceu 12% esta semana. Que tal manter o ritmo com uma ideia nova?
          </p>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          <button className="group relative col-span-2 overflow-hidden rounded-3xl bg-gradient-to-br from-[#FF3D9A] via-[#A23BF0] to-[#3B82F6] p-8 text-left shadow-2xl shadow-[#7C3AED]/30 transition-transform duration-300 hover:-translate-y-1 hover:rotate-[0.3deg]">
            <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/15 blur-2xl" />
            <div className="absolute -bottom-16 left-1/3 h-44 w-44 rounded-full bg-[#FACC15]/20 blur-2xl" />
            <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
              ✦ Comece agora
            </span>
            <h2 className="mt-5 max-w-md text-3xl font-bold leading-tight">
              Transforme uma ideia em post com IA
            </h2>
            <p className="mt-2 max-w-sm text-white/85">
              Descreva o tema. A gente escreve, ilustra e adapta para cada rede.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#0F0A1F] transition-transform group-hover:gap-3">
              Criar com IA →
            </span>
          </button>

          <div className="flex flex-col gap-5">
            <button className="flex-1 rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-left transition-all hover:-translate-y-1 hover:border-[#FF3D9A]/40 hover:bg-white/[0.08]">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF3D9A]/30 to-[#7C3AED]/30 text-xl">✍️</div>
              <h3 className="font-semibold text-white">Escrever do zero</h3>
              <p className="mt-1 text-sm text-white/50">Sua voz, sua pauta.</p>
            </button>
            <button className="flex-1 rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-left transition-all hover:-translate-y-1 hover:border-[#06B6D4]/40 hover:bg-white/[0.08]">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#06B6D4]/30 to-[#3B82F6]/30 text-xl">📰</div>
              <h3 className="font-semibold text-white">A partir de uma notícia</h3>
              <p className="mt-1 text-sm text-white/50">Surfe o que está em alta.</p>
            </button>
          </div>
        </section>

        <section className="mt-16">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Suas criações</h2>
              <p className="mt-1 text-white/50">O que sua marca tem dito ao mundo.</p>
            </div>
            <a className="text-sm font-semibold text-[#FF3D9A] hover:underline">Ver todas →</a>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {creations.map((c) => (
              <article
                key={c.title}
                className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.05] transition-all hover:-translate-y-1.5 hover:border-white/25"
              >
                <div className={`relative flex h-44 items-end bg-gradient-to-br ${c.grad} p-5`}>
                  <span className="absolute right-4 top-4 rounded-full bg-black/25 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
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
                      <span className="text-white/50">alcance</span>
                    </span>
                    <span>
                      <span className="font-bold text-[#4ADE80]">{c.rate}</span>{' '}
                      <span className="text-white/50">engaj.</span>
                    </span>
                  </div>
                  <span className="text-white/30 transition-colors group-hover:text-[#FF3D9A]">↻</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-5 md:grid-cols-3">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#2A1B4D] to-[#1A1030] p-7 md:col-span-2">
            <div className="pointer-events-none absolute -right-16 -bottom-16 h-56 w-56 rounded-full bg-[#FF3D9A]/15 blur-3xl" />
            <span className="text-2xl">🎉</span>
            <h3 className="mt-3 text-xl font-bold text-white">
              Seu melhor post da semana bombou: 8% de engajamento.
            </h3>
            <p className="mt-2 max-w-md text-white/60">
              Posts colaborativos (humano + IA) vêm performando 40% acima. Quer fazer outro nesse tom?
            </p>
            <button className="mt-5 rounded-full bg-gradient-to-r from-[#FF3D9A] to-[#7C3AED] px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5">
              Criar parecido
            </button>
          </div>
          <div className="flex flex-col justify-center rounded-3xl border border-white/10 bg-white/[0.05] p-7">
            <p className="text-sm text-white/50">Ritmo da semana</p>
            <p className="mt-2 text-4xl font-bold text-white">4 / 5</p>
            <p className="mt-1 text-white/60">posts publicados</p>
            <div className="mt-4 flex gap-1.5">
              {[1, 1, 1, 1, 0].map((on, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${on ? 'bg-gradient-to-r from-[#FF3D9A] to-[#7C3AED]' : 'bg-white/10'}`}
                />
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
