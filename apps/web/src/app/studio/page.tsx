/* eslint-disable @next/next/no-img-element */
'use client'

// Referência viva do novo sistema de tema — usa os tokens semânticos reais
// e a LanternToggle. Funciona em claro e escuro. Dados fictícios.

import { LanternToggle } from '../../components/LanternToggle'

const creations = [
  {
    title: 'IA não substitui advogado. Mas o advogado que usa IA substitui o que não usa.',
    platform: 'LinkedIn',
    grad: 'from-[#FF8A5B] to-[#FF5E7E]',
    reach: '2.4k',
    rate: '6.1%',
  },
  {
    title: '3 erros que escritórios cometem ao adotar IA jurídica',
    platform: 'Instagram',
    grad: 'from-[#5B8DEF] to-[#7C5BEF]',
    reach: '1.8k',
    rate: '4.7%',
  },
  {
    title: 'O futuro da advocacia é colaborativo — humano + máquina',
    platform: 'LinkedIn',
    grad: 'from-[#2CB67D] to-[#3DA9FC]',
    reach: '3.1k',
    rate: '8.0%',
  },
]

export default function StudioReference() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo-icon.png" alt="" className="h-8 w-8 rounded-lg" />
            <span className="text-lg font-bold tracking-tight">
              Social<span className="text-accent">Shelf</span>
            </span>
          </div>
          <nav className="hidden items-center gap-7 text-sm font-medium text-muted md:flex">
            <a className="text-ink">Estúdio</a>
            <a className="transition-colors hover:text-ink">Criações</a>
            <a className="transition-colors hover:text-ink">Notícias</a>
            <a className="transition-colors hover:text-ink">Desempenho</a>
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:block">talessc@gmail.com</span>
            <LanternToggle />
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#FF8A5B] to-[#FF5E7E]" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <section className="pt-14 pb-10">
          <h1 className="max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Bora criar algo que <span className="text-accent-text">valha o feed</span>, Tales?
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-2">
            Sua audiência cresceu 12% esta semana. Que tal manter o ritmo com uma ideia nova?
          </p>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          <button className="group relative col-span-2 overflow-hidden rounded-3xl bg-contrast p-8 text-left text-contrast-ink shadow-card-elev transition-transform duration-300 hover:-translate-y-1">
            <span className="inline-flex items-center gap-2 rounded-full bg-contrast-ink/15 px-3 py-1 text-xs font-semibold">
              Comece agora
            </span>
            <h2 className="mt-5 max-w-md text-3xl font-bold leading-tight">
              Transforme uma ideia em post com IA
            </h2>
            <p className="mt-2 max-w-sm text-contrast-ink/85">
              Descreva o tema. A gente escreve, ilustra e adapta para cada rede.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-contrast-ink px-5 py-2.5 text-sm font-semibold text-contrast transition-transform group-hover:gap-3">
              Criar com IA →
            </span>
          </button>

          <div className="flex flex-col gap-5">
            <button className="flex flex-1 items-start gap-3 rounded-3xl border border-line bg-card p-6 text-left shadow-card transition-all hover:-translate-y-1 hover:border-accent hover:shadow-card-elev">
              <span className="text-xl leading-none" aria-hidden>✍️</span>
              <span>
                <h3 className="font-semibold">Escrever do zero</h3>
                <p className="mt-1 text-sm text-muted">Sua voz, sua pauta.</p>
              </span>
            </button>
            <button className="flex flex-1 items-start gap-3 rounded-3xl border border-line bg-card p-6 text-left shadow-card transition-all hover:-translate-y-1 hover:border-accent hover:shadow-card-elev">
              <span className="text-xl leading-none" aria-hidden>📰</span>
              <span>
                <h3 className="font-semibold">A partir de uma notícia</h3>
                <p className="mt-1 text-sm text-muted">Surfe o que está em alta.</p>
              </span>
            </button>
          </div>
        </section>

        <section className="mt-16">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Suas criações</h2>
              <p className="mt-1 text-muted">O que sua marca tem dito ao mundo.</p>
            </div>
            <a className="text-sm font-semibold text-accent-text underline">Ver todas →</a>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {creations.map((c) => (
              <article
                key={c.title}
                className="group overflow-hidden rounded-3xl border border-line bg-card shadow-card transition-all hover:-translate-y-1 hover:border-accent hover:shadow-card-elev"
              >
                <div className={`relative flex h-44 items-end bg-gradient-to-br ${c.grad} p-5`}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <span className="absolute right-4 top-4 rounded-full bg-black/25 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
                    {c.platform}
                  </span>
                  <p className="relative text-lg font-semibold leading-snug text-white">
                    {c.title}
                  </p>
                </div>
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex gap-5 text-sm">
                    <span>
                      <span className="font-bold">{c.reach}</span>{' '}
                      <span className="text-muted">alcance</span>
                    </span>
                    <span>
                      <span className="font-bold text-positive">{c.rate}</span>{' '}
                      <span className="text-muted">engaj.</span>
                    </span>
                  </div>
                  <span className="text-muted transition-colors group-hover:text-accent">↻</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-5 md:grid-cols-3">
          <div className="rounded-3xl border border-line bg-card-2 p-7 shadow-card md:col-span-2">
            <span className="text-2xl">🎉</span>
            <h3 className="mt-3 text-xl font-bold">
              Seu melhor post da semana bombou: 8% de engajamento.
            </h3>
            <p className="mt-2 max-w-md text-muted-2">
              Posts colaborativos (humano + IA) vêm performando 40% acima. Quer fazer outro nesse tom?
            </p>
            <button className="mt-5 rounded-full bg-contrast px-5 py-2.5 text-sm font-semibold text-contrast-ink transition-transform hover:-translate-y-0.5">
              Criar parecido
            </button>
          </div>
          <div className="flex flex-col justify-center rounded-3xl bg-contrast p-7 text-contrast-ink">
            <p className="text-sm opacity-60">Ritmo da semana</p>
            <p className="mt-2 text-4xl font-bold">4 / 5</p>
            <p className="mt-1 opacity-70">posts publicados</p>
            <div className="mt-4 flex gap-1.5">
              {[1, 1, 1, 1, 0].map((on, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${on ? 'bg-accent' : 'bg-current opacity-15'}`}
                />
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
