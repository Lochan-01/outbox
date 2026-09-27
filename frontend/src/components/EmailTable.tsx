'use client';

import { Clock, CheckCircle2, AlertCircle, RefreshCw, Trash2, Calendar, Mail, ExternalLink } from 'lucide-react';

export interface EmailJob {
  id: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RESCHEDULED';
  scheduledAt: string;
  sentAt?: string | null;
  previewUrl?: string | null;
  delayBetweenSendsMs: number;
  hourlyLimit: number;
  errorReason?: string | null;
  createdAt: string;
}

interface EmailTableProps {
  jobs: EmailJob[];
  loading: boolean;
  type: 'scheduled' | 'sent';
  onRefresh: () => void;
  onCancelJob?: (id: string) => void;
}

export default function EmailTable({ jobs, loading, type, onRefresh, onCancelJob }: EmailTableProps) {
  const getStatusBadge = (status: EmailJob['status']) => {
    switch (status) {
      case 'SENT':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
            Sent
          </span>
        );
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <Clock className="h-3 w-3 mr-1 text-blue-600" />
            Scheduled
          </span>
        );
      case 'RESCHEDULED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <RefreshCw className="h-3 w-3 mr-1 text-amber-600 animate-spin" />
            Rescheduled (Rate Limit)
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
            <RefreshCw className="h-3 w-3 mr-1 text-indigo-600 animate-spin" />
            Processing
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertCircle className="h-3 w-3 mr-1 text-rose-600" />
            Failed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Table Header Controls */}
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div>
          <h3 className="font-bold text-slate-900 text-sm capitalize">
            {type === 'scheduled' ? 'Scheduled Queue' : 'Sent Email Logs'}
          </h3>
          <p className="text-xs text-slate-500">
            Showing {jobs.length} email record(s)
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="p-2 text-slate-500 hover:text-brand-600 hover:bg-white rounded-xl border border-slate-200 shadow-sm transition-all flex items-center space-x-1.5 text-xs font-semibold"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="p-12 text-center text-slate-400">
          <RefreshCw className="h-8 w-8 mx-auto animate-spin mb-2 text-brand-500" />
          <p className="text-xs font-medium">Fetching email records...</p>
        </div>
      ) : jobs.length === 0 ? (
        /* Empty State */
        <div className="p-12 text-center text-slate-400">
          <Mail className="h-10 w-10 mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">No {type} emails found</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            {type === 'scheduled'
              ? 'Schedule a new campaign using the Compose button above.'
              : 'Sent email records will appear here as queue workers process jobs.'}
          </p>
        </div>
      ) : (
        /* Data Table */
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-6">Recipient</th>
                <th className="py-3 px-6">Subject</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6">
                  {type === 'scheduled' ? 'Scheduled Execution' : 'Sent Timestamp'}
                </th>
                <th className="py-3 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-6 font-medium text-slate-900">
                    <div className="truncate max-w-[200px]">{job.recipientEmail}</div>
                    <div className="text-[10px] text-slate-400">From: {job.senderEmail}</div>
                  </td>
                  <td className="py-3.5 px-6 text-slate-700">
                    <div className="truncate max-w-[240px] font-medium">{job.subject}</div>
                  </td>
                  <td className="py-3.5 px-6">{getStatusBadge(job.status)}</td>
                  <td className="py-3.5 px-6 text-slate-600">
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3 text-slate-400" />
                      <span>
                        {new Date(
                          type === 'scheduled' ? job.scheduledAt : job.sentAt || job.scheduledAt
                        ).toLocaleString()}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-6 text-right">
                    {type === 'scheduled' && onCancelJob && (
                      <button
                        onClick={() => onCancelJob(job.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Cancel Scheduled Job"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    {type === 'sent' && job.previewUrl && (
                      <a
                        href={job.previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1 text-xs font-semibold text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-2.5 py-1 rounded-lg transition-colors"
                        title="View Email in Ethereal Sandbox"
                      >
                        <span>View Ethereal Email</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
