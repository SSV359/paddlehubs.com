/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAppState } from '../AppContext';
import { compressImageFile } from '../utils/imageCompress';
import { ZelleQrModal } from './ZelleQrModal';
import type { MarketplaceListing, PaddleCondition } from '../types';
import { ShoppingBag, Plus, X, Mail, Landmark, Trash2, Check, RotateCcw, Camera } from 'lucide-react';

const CONDITIONS: { id: PaddleCondition; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'like_new', label: 'Like New' },
  { id: 'good', label: 'Good' },
  { id: 'fair', label: 'Fair' },
  { id: 'well_loved', label: 'Well-Loved' },
];
const conditionLabel = (id: PaddleCondition) => CONDITIONS.find((c) => c.id === id)?.label || id;

export const MarketplaceView: React.FC = () => {
  const { api, currentUser, isAuthenticated, isAdmin } = useAppState();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'available' | 'all'>('available');
  const [selected, setSelected] = useState<MarketplaceListing | null>(null);

  const load = () => {
    setLoading(true);
    api.listMarketplace().then((r: any) => setListings(r.items)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const visible = listings.filter((l) => filter === 'all' || l.status === 'available');

  return (
    <div className="space-y-6" id="marketplace-view">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <ShoppingBag className="w-5 h-5 text-court-green shrink-0" />
            <span className="text-[10px] font-bold text-court-green font-mono tracking-widest uppercase leading-none">GEAR EXCHANGE</span>
          </div>
          <h1 className="text-2xl font-display font-extrabold text-charcoal tracking-tight uppercase">Paddle Marketplace</h1>
          <p className="text-slate-gray text-xs mt-1">Buy and sell used paddles within the club.</p>
        </div>
        {isAuthenticated && (
          <button onClick={() => setShowForm(true)} className="px-4 py-2.5 rounded-lg bg-court-green hover:bg-[#235F3A] text-white font-bold text-xs cursor-pointer shadow-sm flex items-center gap-2 transition-all shrink-0">
            <Plus className="w-4 h-4" /> List a Paddle
          </button>
        )}
      </div>

      <div className="flex bg-white p-1 rounded-xl border border-light-border shadow-sm w-fit">
        {(['available', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 text-[10px] font-bold font-mono uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
              filter === f ? 'bg-deep-navy text-white' : 'text-slate-gray hover:text-charcoal'
            }`}
          >
            {f === 'available' ? 'Available' : 'All Listings'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-xs text-slate-gray font-mono">Loading listings...</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-light-border rounded-2xl bg-white shadow-sm">
          <ShoppingBag className="w-10 h-10 text-slate-gray mx-auto mb-3" />
          <h3 className="text-sm font-bold text-charcoal">No paddles listed yet</h3>
          <p className="text-xs text-slate-gray mt-1">Be the first to list one for sale.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {visible.map((l) => (
            <button key={l.id} onClick={() => setSelected(l)} className="text-left bg-white border border-light-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-court-green/30 transition-all cursor-pointer group">
              <div className="aspect-square bg-off-white relative overflow-hidden">
                {l.photoDataUrl ? (
                  <img src={l.photoDataUrl} alt={l.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-gray/40"><ShoppingBag className="w-10 h-10" /></div>
                )}
                {l.status === 'sold' && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-white font-display font-black text-sm uppercase tracking-wider border-2 border-white px-3 py-1 rotate-[-8deg]">Sold</span>
                  </div>
                )}
              </div>
              <div className="p-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-charcoal truncate">{l.title}</span>
                  <span className="text-sm font-mono font-black text-court-green shrink-0">${l.price.toFixed(0)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono font-bold text-slate-gray uppercase bg-off-white border border-light-border px-1.5 py-0.5 rounded">{conditionLabel(l.condition)}</span>
                </div>
                <p className="text-[9px] text-slate-gray font-mono truncate">{l.sellerName}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {showForm && (
        <ListPaddleForm
          api={api}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); load(); }}
        />
      )}

      {selected && (
        <ListingModal
          listing={selected}
          currentUser={currentUser}
          isAdmin={isAdmin}
          api={api}
          onClose={() => setSelected(null)}
          onChanged={() => { setSelected(null); load(); }}
        />
      )}
    </div>
  );
};

const ListPaddleForm: React.FC<{ api: any; onClose: () => void; onCreated: () => void }> = ({ api, onClose, onCreated }) => {
  const [title, setTitle] = useState('');
  const [brand, setBrand] = useState('');
  const [condition, setCondition] = useState<PaddleCondition>('good');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [compressing, setCompressing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    setError(null);
    try {
      setPhotoDataUrl(await compressImageFile(file));
    } catch (err: any) {
      setError(err?.message || 'Could not process that photo.');
    } finally {
      setCompressing(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const priceNum = Number(price);
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!Number.isFinite(priceNum) || priceNum < 0) { setError('Enter a valid price.'); return; }

    setSubmitting(true);
    try {
      await api.createMarketplaceListing({
        title: title.trim(),
        brand: brand.trim(),
        condition,
        price: priceNum,
        description: description.trim(),
        photoDataUrl,
      });
      onCreated();
    } catch (err: any) {
      setError(err?.message || 'Failed to list paddle.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <form onSubmit={submit} className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-light-border shrink-0">
          <h3 className="font-display font-bold text-sm text-charcoal">List a Paddle</h3>
          <button type="button" onClick={onClose} className="text-slate-gray hover:text-charcoal cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {error && <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 p-2.5 rounded-lg">{error}</p>}

          <div className="space-y-1.5">
            <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Photo</label>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-light-border rounded-xl h-32 cursor-pointer hover:border-court-green transition-all overflow-hidden bg-off-white">
              {compressing ? (
                <span className="text-xs text-slate-gray font-mono">Compressing...</span>
              ) : photoDataUrl ? (
                <img src={photoDataUrl} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-1 text-slate-gray"><Camera className="w-5 h-5" /><span className="text-[10px] font-mono">Add a photo (up to 1MB)</span></span>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Selkirk Vanguard Power Air" className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Brand</label>
              <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Selkirk" className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Price ($)</label>
              <input type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Condition</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value as PaddleCondition)} className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5">
                {CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Any scratches, how long you've had it, reason for selling..." className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5 resize-none" />
          </div>
        </div>

        <div className="p-4 border-t border-light-border shrink-0">
          <button type="submit" disabled={submitting || compressing} className="w-full py-2.5 rounded-xl bg-court-green hover:bg-[#235F3A] text-white text-xs font-bold font-mono uppercase transition-all cursor-pointer disabled:opacity-60">
            {submitting ? 'Listing...' : 'List Paddle'}
          </button>
        </div>
      </form>
    </div>
  );
};

const ListingModal: React.FC<{ listing: MarketplaceListing; currentUser: any; isAdmin: boolean; api: any; onClose: () => void; onChanged: () => void }> = ({ listing, currentUser, isAdmin, api, onClose, onChanged }) => {
  const [showZelle, setShowZelle] = useState(false);
  const [zelleContact, setZelleContact] = useState<string | null>(null);
  const [zelleChecked, setZelleChecked] = useState(false);
  const isOwner = isAdmin || listing.sellerSub === currentUser?.userSub;

  const openZelle = async () => {
    if (!zelleChecked) {
      try {
        const profile = await api.getPlayerProfileByEmail(listing.sellerEmail);
        setZelleContact(profile?.zelleContact || null);
      } catch {
        setZelleContact(null);
      }
      setZelleChecked(true);
    }
    setShowZelle(true);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-light-border shrink-0">
          <h3 className="font-display font-bold text-sm text-charcoal truncate">{listing.title}</h3>
          <button onClick={onClose} className="text-slate-gray hover:text-charcoal cursor-pointer shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto">
          <div className="aspect-video bg-off-white relative">
            {listing.photoDataUrl ? (
              <img src={listing.photoDataUrl} alt={listing.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-gray/40"><ShoppingBag className="w-10 h-10" /></div>
            )}
            {listing.status === 'sold' && (
              <div className="absolute top-3 right-3 bg-black/70 text-white text-[10px] font-bold font-mono uppercase px-2.5 py-1 rounded">Sold</div>
            )}
          </div>

          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-gray font-mono uppercase">{listing.brand || 'Unbranded'} &middot; {conditionLabel(listing.condition)}</p>
                <p className="text-2xl font-display font-black text-court-green">${listing.price.toFixed(2)}</p>
              </div>
              <p className="text-[10px] text-slate-gray font-mono text-right">Listed by<br /><span className="font-bold text-charcoal">{listing.sellerName}</span></p>
            </div>

            {listing.description && <p className="text-xs text-charcoal leading-relaxed">{listing.description}</p>}

            {!isOwner && listing.status === 'available' && (
              <div className="space-y-2 pt-2">
                {listing.sellerEmail && (
                  <a href={`mailto:${listing.sellerEmail}?subject=${encodeURIComponent(`Interested in your ${listing.title}`)}`} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-light-border text-xs font-bold font-mono uppercase text-charcoal hover:border-court-green hover:text-court-green transition-all">
                    <Mail className="w-4 h-4" /> Email Seller
                  </a>
                )}
                <button onClick={openZelle} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-court-green hover:bg-[#235F3A] text-white text-xs font-bold font-mono uppercase transition-all cursor-pointer">
                  <Landmark className="w-4 h-4" /> Pay via Zelle
                </button>
              </div>
            )}

            {isOwner && (
              <div className="flex gap-2 pt-2 border-t border-light-border">
                {listing.status === 'available' ? (
                  <button
                    onClick={async () => { await api.updateMarketplaceListing(listing.id, { status: 'sold' }); onChanged(); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-court-green/10 text-court-green text-xs font-bold font-mono uppercase cursor-pointer"
                  >
                    <Check className="w-4 h-4" /> Mark Sold
                  </button>
                ) : (
                  <button
                    onClick={async () => { await api.updateMarketplaceListing(listing.id, { status: 'available' }); onChanged(); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-off-white text-slate-gray text-xs font-bold font-mono uppercase cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" /> Relist
                  </button>
                )}
                <button
                  onClick={async () => { if (confirm('Delete this listing?')) { await api.deleteMarketplaceListing(listing.id); onChanged(); } }}
                  className="px-4 flex items-center justify-center rounded-xl border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showZelle && (
        zelleContact ? (
          <ZelleQrModal name={listing.sellerName} contact={zelleContact} onClose={() => setShowZelle(false)} />
        ) : zelleChecked ? (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={() => setShowZelle(false)}>
            <div className="bg-white rounded-2xl p-6 max-w-xs text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <p className="text-xs text-slate-gray">{listing.sellerName} hasn't set up Zelle info on their profile — try emailing them instead.</p>
            </div>
          </div>
        ) : null
      )}
    </div>
  );
};
