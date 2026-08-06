/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppState } from '../AppContext';
import { defaultAvatar } from '../utils/avatar';
import type { ClubChatMessage } from '../types';
import { MessageCircle, Send } from 'lucide-react';

export const ClubChatView: React.FC = () => {
  const { currentUser, api } = useAppState();
  const [messages, setMessages] = useState<ClubChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);

  const load = useCallback(async () => {
    try {
      const r = await api.listClubChatMessages();
      setMessages(r.items);
    } catch (e: any) {
      setError(e?.message || 'Could not load messages.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (wasAtBottomRef.current) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    setError(null);
    try {
      await api.postClubChatMessage(trimmed);
      setText('');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col" id="club-chat-view">
      <div className="flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-court-green shrink-0" />
        <span className="text-[10px] font-bold text-court-green font-mono tracking-widest uppercase leading-none">CLUB LOBBY</span>
      </div>
      <h1 className="text-2xl font-display font-extrabold text-charcoal tracking-tight uppercase -mt-4">Club Chat</h1>

      <div className="flex-1 bg-white border border-light-border rounded-2xl shadow-sm flex flex-col min-h-[500px] overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading ? (
            <p className="text-xs text-slate-gray font-mono text-center py-10">Loading messages...</p>
          ) : messages.length === 0 ? (
            <div className="text-center py-16">
              <MessageCircle className="w-8 h-8 text-slate-gray mx-auto mb-2" />
              <p className="text-xs text-slate-gray">No messages yet — be the first to say hi.</p>
            </div>
          ) : messages.map((m) => {
            const mine = m.senderSub === currentUser?.userSub;
            return (
              <div key={m.id} className={`flex gap-2.5 ${mine ? 'justify-end' : 'justify-start'}`}>
                {!mine && (
                  <img src={defaultAvatar(m.senderName)} alt={m.senderName} className="w-8 h-8 rounded-lg object-cover shrink-0 mt-0.5" />
                )}
                <div className={`max-w-[70%] rounded-2xl px-3.5 py-2.5 ${mine ? 'bg-court-green text-white rounded-tr-sm' : 'bg-off-white border border-light-border text-charcoal rounded-tl-sm'}`}>
                  {!mine && <span className="text-[10px] font-mono font-bold text-court-green block mb-0.5">{m.senderName}</span>}
                  <span className="text-sm leading-snug break-words">{m.text}</span>
                  <span className={`text-[9px] font-mono block mt-1 ${mine ? 'text-white/60' : 'text-slate-gray'}`}>
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {error && <p className="text-[10px] text-red-600 font-semibold px-5 pb-1">{error}</p>}

        <div className="p-4 border-t border-light-border flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }}
            placeholder="Message the club..."
            className="flex-1 text-sm bg-off-white border border-light-border rounded-xl px-4 py-2.5 focus:outline-none focus:border-court-green"
          />
          <button
            onClick={send}
            disabled={sending || !text.trim()}
            className="w-11 h-11 rounded-xl bg-court-green hover:bg-[#235F3A] text-white flex items-center justify-center cursor-pointer disabled:opacity-50 shrink-0 transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
