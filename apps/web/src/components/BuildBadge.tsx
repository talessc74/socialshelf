export function BuildBadge() {
  const sha = process.env['NEXT_PUBLIC_COMMIT_SHA'] ?? 'dev'
  const short = sha.slice(0, 7)

  return (
    <div className="fixed bottom-2 right-3 text-[10px] text-gray-300 font-mono select-none pointer-events-none">
      {short}
    </div>
  )
}
