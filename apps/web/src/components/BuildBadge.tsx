export function BuildBadge() {
  const sha = process.env['NEXT_PUBLIC_COMMIT_SHA'] ?? 'dev'
  const short = sha.slice(0, 7)

  return (
    <div className="fixed bottom-2 right-3 text-[10px] text-muted-2 bg-card-2 px-1.5 py-0.5 rounded font-mono select-none pointer-events-none opacity-60">
      {short}
    </div>
  )
}
