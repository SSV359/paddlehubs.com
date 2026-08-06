/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check, Landmark } from 'lucide-react';

// Zelle has no universal cross-bank "pay" deep-link/QR standard the way
// Venmo does — it's an overlay each bank implements its own way. This
// QR just encodes the recipient's Zelle-registered contact as plain
// text, so scanning it hands over the exact email/phone with zero
// typos; the payer still completes the actual payment inside their own
// bank's Zelle screen.
export const ZelleQrModal: React.FC<{ name: string; contact: string; onClose: () => void }> = ({ name, contact, onClose }) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(contact, { width: 260, margin: 1, color: { dark: '#0A1220', light: '#FFFFFF' } })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [contact]);

  const copy = () => {
    navigator.clipboard.writeText(contact);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-light-border">
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4 text-court-green" />
            <h3 className="font-display font-bold text-sm text-charcoal">Pay {name} via Zelle</h3>
          </div>
          <button onClick={onClose} className="text-slate-gray hover:text-charcoal cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 flex flex-col items-center gap-4">
          {dataUrl ? (
            <img src={dataUrl} alt="Zelle QR code" className="w-56 h-56 rounded-lg border border-light-border" />
          ) : (
            <div className="w-56 h-56 rounded-lg border border-light-border bg-off-white flex items-center justify-center text-xs text-slate-gray">Generating...</div>
          )}

          <div className="w-full space-y-1.5">
            <p className="text-[9px] font-mono uppercase text-slate-gray text-center">Scan in your bank's Zelle screen, or copy directly</p>
            <button onClick={copy} className="w-full flex items-center justify-between gap-2 bg-off-white border border-light-border rounded-xl px-3 py-2.5 cursor-pointer hover:border-court-green transition-all">
              <span className="text-xs font-mono font-bold text-charcoal truncate">{contact}</span>
              {copied ? <Check className="w-4 h-4 text-court-green shrink-0" /> : <Copy className="w-4 h-4 text-slate-gray shrink-0" />}
            </button>
          </div>

          <p className="text-[9px] text-slate-gray text-center leading-relaxed">
            This isn't a one-tap payment link — Zelle doesn't support that across banks. Scan or copy the contact, then send the payment from your own bank's app.
          </p>
        </div>
      </div>
    </div>
  );
};
