export function ControlLoader({ message }: { message: string }) {
  return <div role="status" aria-live="polite" className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-6">
    <div className="flex w-full max-w-md flex-col items-center rounded-lg bg-white p-6 shadow-2xl sm:p-8">
      <span aria-hidden="true" className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#f1f0ff] border-b-[#ff5959]" />
      <p className="mb-3 text-center text-sm font-semibold text-gray-700 sm:text-lg">{message}</p>
      <div aria-hidden="true" className="mt-3 flex gap-2">
        {[0, 1, 2].map((dot) => <span key={dot} className="h-3 w-3 animate-bounce rounded-full bg-[#ff5959]" style={{ animationDelay: `${dot * 100}ms` }} />)}
      </div>
    </div>
  </div>;
}
