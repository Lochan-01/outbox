'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import axios from 'axios';
import { X, Upload, Send, FileText, CheckCircle, AlertCircle, Clock, ShieldAlert } from 'lucide-react';
import { getBackendUrl } from '@/lib/config';

const BACKEND_URL = getBackendUrl();

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userEmail: string;
}

export default function ComposeModal({ isOpen, onClose, onSuccess, userEmail }: ComposeModalProps) {
  const [senderEmail, setSenderEmail] = useState(userEmail || 'outbox-sender@company.com');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [delayBetweenSendsMs, setDelayBetweenSendsMs] = useState(500);
  const [hourlyLimit, setHourlyLimit] = useState(20);

  const [recipients, setRecipients] = useState<string[]>([]);
  const [rawTextRecipients, setRawTextRecipients] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    Papa.parse(file, {
      complete: (results) => {
        const extracted: string[] = [];
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

        results.data.forEach((row: any) => {
          const rowStr = Array.isArray(row) ? row.join(' ') : JSON.stringify(row);
          const matches = rowStr.match(emailRegex);
          if (matches) {
            extracted.push(...matches);
          }
        });

        const uniqueEmails = Array.from(new Set(extracted));
        setRecipients(uniqueEmails);
      },
      error: (err) => {
        setError(`CSV Parse Error: ${err.message}`);
      },
    });
  };

  const handleTextRecipientsChange = (val: string) => {
    setRawTextRecipients(val);
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = val.match(emailRegex) || [];
    const unique = Array.from(new Set(matches));
    setRecipients(unique);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recipients.length === 0) {
      setError('Please upload a CSV or enter at least one valid lead email address.');
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setError('Subject and Email Body are required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await axios.post(`${BACKEND_URL}/api/emails/schedule`, {
        senderEmail,
        recipients,
        subject,
        body,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        delayBetweenSendsMs: Number(delayBetweenSendsMs),
        hourlyLimit: Number(hourlyLimit),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to schedule emails.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 my-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Schedule Email Campaign</h2>
            <p className="text-xs text-slate-500">Configure parameters, upload leads, and dispatch delayed queue.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sender & Subject */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Sender Email</label>
              <input
                type="email"
                required
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
              <input
                type="text"
                required
                placeholder="Product Announcement / Hiring Update"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
          </div>

          {/* Lead CSV Upload & Manual Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Recipients / Leads (CSV Upload or Paste)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* CSV Upload */}
              <label className="border-2 border-dashed border-slate-200 hover:border-brand-500 bg-slate-50 hover:bg-brand-50/30 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all">
                <Upload className="h-6 w-6 text-brand-600 mb-1" />
                <span className="text-xs font-semibold text-slate-700">
                  {fileName ? fileName : 'Upload CSV / Text File'}
                </span>
                <span className="text-[10px] text-slate-400">Auto-detects lead email addresses</span>
                <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
              </label>

              {/* Text Input */}
              <textarea
                placeholder="Or paste email addresses (comma or line separated)..."
                rows={3}
                value={rawTextRecipients}
                onChange={(e) => handleTextRecipientsChange(e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>

            {/* Total Detected Badge */}
            {recipients.length > 0 && (
              <div className="mt-2 flex items-center justify-between bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-xl text-xs">
                <div className="flex items-center space-x-1.5 font-semibold">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <span>Detected {recipients.length} lead email(s)</span>
                </div>
                <span className="text-[10px] text-emerald-700">
                  Preview: {recipients.slice(0, 3).join(', ')} {recipients.length > 3 ? '...' : ''}
                </span>
              </div>
            )}
          </div>

          {/* Email Body */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Body (HTML supported)</label>
            <textarea
              required
              rows={4}
              placeholder="Hi {{name}}, we are excited to share..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-mono"
            />
          </div>

          {/* Advanced Scheduling Parameters */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 flex items-center">
              <Clock className="h-3.5 w-3.5 text-brand-600 mr-1.5" />
              Scheduling & Rate Limit Controls
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Scheduled Start Time</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Send Delay (ms)</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={delayBetweenSendsMs}
                  onChange={(e) => setDelayBetweenSendsMs(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Hourly Limit / Sender</label>
                <input
                  type="number"
                  min="1"
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-md transition-all flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{loading ? 'Scheduling Queue...' : `Dispatch ${recipients.length} Email(s)`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
