import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-800 p-4">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-4xl font-extrabold text-brand-600">404</h1>
        <h2 className="text-lg font-bold text-slate-900">Page Not Found</h2>
        <p className="text-xs text-slate-500">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 transition-all"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
