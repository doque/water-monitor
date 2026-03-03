"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="de">
      <body>
        <div className="p-6">
          <p>Ein unerwarteter Fehler ist aufgetreten.</p>
          <button onClick={() => reset()} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm">Erneut versuchen</button>
        </div>
      </body>
    </html>
  )
}
