'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

import Header from '@/components/Header';
import EmailTable, { EmailJob } from '@/components/EmailTable';
import ComposeModal from '@/components/ComposeModal';
import { Plus, Search, Mail, CheckCircle2, Clock, Activity, AlertTriangle } from 'lucide-react';
import { getBackendUrl } from '@/lib/config';

const BACKEND_URL = getBackendUrl();

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [jobs, setJobs] = useState<EmailJob[]>([]);
  const [queueStats, setQueueStats] = useState({ waiting: 0, active: 0, delayed: 0, completed: 0, failed: 0, total: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const fetchEmailJobs = useCallback(async () => {
    setLoading(true);
    try {
      if (searchQuery.trim() || statusFilter) {
        // Search via Elasticsearch
        const res = await axios.get(`${BACKEND_URL}/api/emails/search`, {
          params: {
            q: searchQuery.trim() || undefined,
            status: statusFilter || undefined,
          },
        });
        setJobs(res.data.hits || []);
      } else {
        // Fetch from DB
        const res = await axios.get(`${BACKEND_URL}/api/emails`);
        setJobs(res.data.jobs || []);
      }

      // Fetch queue live stats
      const statsRes = await axios.get(`${BACKEND_URL}/api/queue/stats`);
      setQueueStats(statsRes.data);
    } catch (err: any) {
      console.warn('Failed to fetch jobs:', err.message);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchEmailJobs();
      const interval = setInterval(fetchEmailJobs, 10000); // Auto refresh queue
      return () => clearInterval(interval);
    }
  }, [status, fetchEmailJobs]);

  const handleCancelJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled email job?')) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/emails/${jobId}`);
      showToast('Scheduled email job cancelled successfully.');
      fetchEmailJobs();
    } catch (err: any) {
      alert(`Failed to cancel job: ${err.message}`);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center text-slate-400">
          <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs font-semibold">Authenticating...</p>
        </div>
      </div>
    );
  }

  const scheduledJobs = jobs.filter((j) => j.status === 'SCHEDULED' || j.status === 'RESCHEDULED' || j.status === 'PROCESSING');
  const sentJobs = jobs.filter((j) => j.status === 'SENT' || j.status === 'FAILED');

  return (
    <div className="min-h-screen bg-slate-50">
      <Header activeTab={activeTab} setActiveTab={(t) => setActiveTab(t as any)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center justify-between text-xs font-semibold animate-bounce">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-white/80 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* Live Queue Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Delayed / Pending</p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-0.5">{queueStats.delayed + queueStats.waiting}</h3>
            </div>
            <div className="bg-blue-50 text-blue-600 p-3 rounded-xl">
              <Clock className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Active Workers</p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-0.5">{queueStats.active}</h3>
            </div>
            <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl">
              <Activity className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Total Completed</p>
              <h3 className="text-2xl font-extrabold text-emerald-600 mt-0.5">{queueStats.completed}</h3>
            </div>
            <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Failed / Retries</p>
              <h3 className="text-2xl font-extrabold text-rose-600 mt-0.5">{queueStats.failed}</h3>
            </div>
            <div className="bg-rose-50 text-rose-600 p-3 rounded-xl">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Toolbar: Search, Status Filter & Primary Compose Button */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          {/* Elasticsearch Search Input */}
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search via Elasticsearch (subject, lead email)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
            />
          </div>

          {/* Status Filter & Compose */}
          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700"
            >
              <option value="">All Statuses</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="RESCHEDULED">Rescheduled</option>
              <option value="SENT">Sent</option>
              <option value="FAILED">Failed</option>
            </select>

            <button
              onClick={() => setIsComposeOpen(true)}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-xs shadow-md hover:shadow-brand-500/20 transition-all flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Compose New Email</span>
            </button>
          </div>
        </div>

        {/* Main Email Tables */}
        {activeTab === 'scheduled' ? (
          <EmailTable
            jobs={searchQuery || statusFilter ? jobs : scheduledJobs}
            loading={loading}
            type="scheduled"
            onRefresh={fetchEmailJobs}
            onCancelJob={handleCancelJob}
          />
        ) : (
          <EmailTable
            jobs={searchQuery || statusFilter ? jobs : sentJobs}
            loading={loading}
            type="sent"
            onRefresh={fetchEmailJobs}
          />
        )}
      </main>

      {/* Compose Email Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={() => {
          showToast('Batch email campaign scheduled successfully!');
          fetchEmailJobs();
        }}
        userEmail={session?.user?.email || 'outbox-sender@company.com'}
      />
    </div>
  );
}
