import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <h1 className="text-6xl font-bold text-zinc-600 mb-4">404</h1>
      <p className="text-xl text-zinc-400 mb-8">Page not found</p>
      <Link
        href="/"
        className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors"
      >
        ← Back to Dashboard
      </Link>
    </div>
  );
}
