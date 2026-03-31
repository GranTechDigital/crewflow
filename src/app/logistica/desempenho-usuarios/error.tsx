"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[300px] flex items-center justify-center p-6">
      <div className="bg-white border border-red-200 rounded-lg p-5 max-w-xl w-full">
        <h2 className="text-lg font-semibold text-red-700 mb-2">
          Erro ao carregar a página de desempenho
        </h2>
        <p className="text-sm text-gray-700 mb-4">{error.message}</p>
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
