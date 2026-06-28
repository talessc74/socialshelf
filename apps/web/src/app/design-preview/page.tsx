export default function DesignPreviewPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#04081a] via-brand-500 to-white">
      <div
        aria-hidden
        className="absolute left-1/2 top-[28%] h-[28rem] w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70 blur-[100px]"
      />

      <div className="relative z-10 flex flex-col items-center px-6 pt-40 text-center">
        <h1 className="text-6xl font-bold text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.6)]">
          Build full stack
        </h1>

        <p className="mt-24 max-w-xl text-lg text-white">
          SocialShelf entrega o stack completo para publicar e medir conteúdo social.
        </p>

        <div className="mt-8 flex gap-4">
          <button className="rounded-full bg-black px-6 py-3 font-medium text-white">
            Ir para docs
          </button>
          <button className="rounded-full bg-white px-6 py-3 font-medium text-black">
            Começar agora
          </button>
        </div>
      </div>

      <div className="h-[60vh]" />
    </main>
  )
}
