'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Mail, ShieldCheck, Zap, Server, Lock } from 'lucide-react';

export default function LoginPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) {
      router.push('/');
    }
  }, [session, router]);

  const handleGoogleSignIn = () => {
    setLoading(true);
    signIn('google', { callbackUrl: '/' });
  };

  const handleDemoSignIn = () => {
    setLoading(true);
    signIn('credentials', {
      email: 'demo-recruiter@company.com',
      name: 'Hiring Manager',
      callbackUrl: '/',
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white">
      <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-xl p-8 rounded-3xl border border-slate-700/50 shadow-2xl space-y-8">
        {/* Branding Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex p-3 bg-brand-600/20 text-brand-400 rounded-2xl ring-1 ring-brand-500/30">
            <Mail className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Outbox Scheduler</h1>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
            Production-grade distributed email scheduler with BullMQ delayed queues, Redis rate-limiting, and Elasticsearch.
          </p>
        </div>

        {/* Features Checklist */}
        <div className="space-y-2.5 bg-slate-800/40 p-4 rounded-2xl border border-slate-700/30 text-xs text-slate-300">
          <div className="flex items-center space-x-2">
            <Zap className="h-4 w-4 text-brand-400" />
            <span>BullMQ Delayed Queue (Zero Cron Dependencies)</span>
          </div>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Server Restart Persistence & Idempotency</span>
          </div>
          <div className="flex items-center space-x-2">
            <Server className="h-4 w-4 text-amber-400" />
            <span>Per-Sender Redis Hourly Rate Limiting</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Real Google OAuth Login */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center space-x-3 bg-white hover:bg-slate-100 text-slate-900 font-bold py-3.5 px-4 rounded-2xl transition-all shadow-lg hover:shadow-white/10 text-xs"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign In with Google OAuth</span>
          </button>

          {/* Instant Test Credentials Login */}
          <button
            onClick={handleDemoSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-3 px-4 rounded-2xl border border-slate-700 transition-all text-xs"
          >
            <Lock className="h-3.5 w-3.5 text-brand-400" />
            <span>Instant Demo Sign In (Quick Testing)</span>
          </button>
        </div>

        <p className="text-[11px] text-center text-slate-500">
          Built for hiring technical evaluation • TypeScript, Express, BullMQ, Redis, Postgres, ES
        </p>
      </div>
    </div>
  );
}
