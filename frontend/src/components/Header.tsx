'use client';

import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Mail, LogOut, Slack, ExternalLink, Activity } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export default function Header({ activeTab, setActiveTab }: { activeTab: string; setActiveTab: (tab: string) => void }) {
  const { data: session } = useSession();
  const [slackStatus, setSlackStatus] = useState<{ connected: boolean; hasWebhook: boolean }>({
    connected: false,
    hasWebhook: false,
  });
  const [showSlackModal, setShowSlackModal] = useState(false);
  const [webhookInput, setWebhookInput] = useState('');
  const [connectingSlack, setConnectingSlack] = useState(false);

  useEffect(() => {
    checkSlackStatus();
  }, [session]);

  const checkSlackStatus = async () => {
    try {
      const userEmail = session?.user?.email;
      const res = await axios.get(`${BACKEND_URL}/api/slack/status`, {
        params: { userEmail },
      });
      setSlackStatus(res.data);
    } catch (e) {
      console.warn('Failed to fetch Slack connection status');
    }
  };

  const handleSaveWebhook = async () => {
    if (!webhookInput) return;
    setConnectingSlack(true);
    try {
      await axios.post(`${BACKEND_URL}/api/slack/webhook`, {
        userEmail: session?.user?.email || 'admin@system.local',
        webhookUrl: webhookInput,
      });
      await checkSlackStatus();
      setShowSlackModal(false);
      setWebhookInput('');
      alert('Slack Webhook connected successfully! Rate-limit alerts will trigger live messages.');
    } catch (e: any) {
      alert(`Failed to save Slack webhook: ${e.message}`);
    } finally {
      setConnectingSlack(false);
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="bg-brand-600 text-white p-2 rounded-xl shadow-md">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-lg leading-tight">Outbox Pro</h1>
              <p className="text-xs text-slate-500 font-medium">Scalable Email Job Scheduler</p>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="hidden md:flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'scheduled' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Scheduled Jobs
            </button>
            <button
              onClick={() => setActiveTab('sent')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'sent' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sent History
            </button>
            <a
              href={`${BACKEND_URL}/admin/queues`}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-brand-600 rounded-lg flex items-center space-x-1 transition-all"
            >
              <Activity className="h-3.5 w-3.5" />
              <span>Bull Board</span>
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          </div>

          {/* User & Slack Actions */}
          <div className="flex items-center space-x-4">
            {/* Slack Connection Badge */}
            {slackStatus.connected ? (
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                <Slack className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                Slack Connected
              </span>
            ) : (
              <button
                onClick={() => setShowSlackModal(true)}
                className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
              >
                <Slack className="h-3.5 w-3.5 mr-1.5" />
                Connect Slack
              </button>
            )}

            {/* User Profile */}
            {session?.user && (
              <div className="flex items-center space-x-3 border-l border-slate-200 pl-4">
                <img
                  src={session.user.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.email}`}
                  alt={session.user.name || 'User Avatar'}
                  className="h-8 w-8 rounded-full ring-2 ring-brand-500/20"
                />
                <div className="hidden lg:block text-left">
                  <p className="text-xs font-bold text-slate-900 leading-tight">{session.user.name}</p>
                  <p className="text-[10px] text-slate-500 truncate max-w-[120px]">{session.user.email}</p>
                </div>
                <button
                  onClick={() => signOut()}
                  title="Logout"
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Slack Connection Modal */}
      {showSlackModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-emerald-100 text-emerald-700 p-2.5 rounded-xl">
                <Slack className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Connect Slack Notifications</h3>
                <p className="text-xs text-slate-500">Get live alerts when sender hourly limits are reached.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Option 1: Real OAuth Authorize Flow
                </label>
                <a
                  href={`${BACKEND_URL}/api/slack/auth?userId=${session?.user?.email}`}
                  className="w-full inline-flex justify-center items-center px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm"
                >
                  Authorize Slack OAuth App
                  <ExternalLink className="h-3.5 w-3.5 ml-2" />
                </a>
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-2 text-[10px] uppercase font-bold text-slate-400">Or Local Webhook</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Option 2: Incoming Webhook URL
                </label>
                <input
                  type="url"
                  placeholder="https://hooks.slack.com/services/T00/B00/XXX"
                  value={webhookInput}
                  onChange={(e) => setWebhookInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-2">
              <button
                onClick={() => setShowSlackModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveWebhook}
                disabled={connectingSlack || !webhookInput}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 rounded-xl disabled:opacity-50"
              >
                {connectingSlack ? 'Connecting...' : 'Save Webhook'}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
