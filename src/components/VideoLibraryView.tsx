/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAppState } from '../AppContext';
import { extractVideoFrames } from '../utils/videoFrames';
import type { VideoRecord } from '../types';
import { Video, Upload, Sparkles, Play, X, Trash2, Trophy, Clock, Loader2 } from 'lucide-react';

const MAX_VIDEO_BYTES = 300 * 1024 * 1024; // 300MB — generous for a match clip, keeps uploads reasonable

// The coaching prompt returns simple **bold** section headers (What's
// working / Areas to improve / One thing to work on) — this renders
// those as actual bold text instead of showing literal asterisks,
// without pulling in a full markdown library for one formatting need.
function renderCoachingNotes(text?: string) {
  if (!text) return null;
  return text.split('\n').filter((line) => line.trim()).map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    return (
      <p key={i}>
        {parts.map((part, j) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={j} className="font-display font-bold text-charcoal block mt-2 first:mt-0">{part.slice(2, -2)}</strong>
            : <span key={j}>{part}</span>
        )}
      </p>
    );
  });
}

export const VideoLibraryView: React.FC = () => {
  const { api, tournaments, currentUser, isAdmin } = useAppState();
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [playing, setPlaying] = useState<VideoRecord | null>(null);

  const load = () => {
    setLoading(true);
    api.listVideos().then((r) => setVideos(r.items)).catch(() => setVideos([])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  // Poll while any video still has AI commentary pending, so it appears
  // automatically without a manual refresh once it's ready.
  useEffect(() => {
    if (!videos.some((v) => v.aiStatus === 'pending')) return;
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [videos]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this video? This cannot be undone.')) return;
    try {
      await api.deleteVideo(id);
      setPlaying(null);
      load();
    } catch (e: any) {
      alert(e?.message || 'Failed to delete video.');
    }
  };

  return (
    <div className="space-y-6" id="video-library-view">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-light-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Video className="w-5 h-5 text-court-green shrink-0" />
            <span className="text-[10px] font-bold text-court-green font-mono tracking-widest uppercase leading-none">MATCH FILM</span>
          </div>
          <h1 className="text-2xl font-display font-extrabold text-charcoal tracking-tight uppercase">Virtual AI Coach</h1>
          <p className="text-slate-gray text-xs mt-1">
            Upload match footage and get AI coaching feedback — positioning, court coverage, and technique notes from a few frames. Not full swing/motion analysis, since it can't see the video move.
          </p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="px-4 py-2.5 rounded-lg bg-court-green text-white font-bold text-xs hover:bg-court-green/90 shadow-sm flex items-center gap-2 cursor-pointer transition-all shrink-0"
        >
          <Upload className="w-4 h-4" /> {showUpload ? 'Cancel' : 'Upload Video'}
        </button>
      </div>

      {showUpload && (
        <UploadForm
          api={api}
          tournaments={tournaments}
          onDone={() => { setShowUpload(false); load(); }}
        />
      )}

      {loading ? (
        <p className="text-xs text-slate-gray font-mono text-center py-10">Loading videos...</p>
      ) : videos.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-light-border rounded-2xl bg-white max-w-lg mx-auto shadow-sm">
          <Video className="w-10 h-10 text-slate-gray mx-auto mb-3" />
          <h3 className="text-sm font-bold text-charcoal">No videos yet</h3>
          <p className="text-xs text-slate-gray mt-1">Upload match footage to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {videos.map((v) => {
            const tour = tournaments.find((t) => t.id === v.tournamentId);
            return (
              <button
                key={v.id}
                onClick={() => setPlaying(v)}
                className="group bg-white border border-light-border rounded-2xl overflow-hidden shadow-sm hover:border-court-green/40 hover:shadow-md transition-all text-left cursor-pointer flex flex-col"
              >
                <div className="relative aspect-video bg-deep-navy flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Play className="w-5 h-5 text-white ml-0.5" />
                  </div>
                  {v.aiStatus === 'pending' && (
                    <span className="absolute top-2 right-2 flex items-center gap-1 text-[9px] font-mono font-bold text-soft-gold bg-deep-navy/80 border border-soft-gold/30 px-2 py-1 rounded-full">
                      <Loader2 className="w-3 h-3 animate-spin" /> AI ANALYZING
                    </span>
                  )}
                  {v.aiStatus === 'done' && (
                    <span className="absolute top-2 right-2 flex items-center gap-1 text-[9px] font-mono font-bold text-court-green bg-deep-navy/80 border border-court-green/30 px-2 py-1 rounded-full">
                      <Sparkles className="w-3 h-3" /> AI COACHING
                    </span>
                  )}
                </div>
                <div className="p-4 space-y-1.5 flex-1">
                  <h3 className="font-bold text-sm text-charcoal group-hover:text-court-green transition-colors line-clamp-1">{v.title}</h3>
                  {tour && (
                    <span className="text-[10px] font-mono text-soft-gold flex items-center gap-1"><Trophy className="w-3 h-3" /> {tour.name}</span>
                  )}
                  {v.matchLabel && <span className="text-[10px] font-mono text-slate-gray block">{v.matchLabel}</span>}
                  <div className="flex items-center justify-between pt-1.5 text-[10px] text-slate-gray font-mono">
                    <span>{v.ownerDisplayName}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(v.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {playing && (
        <PlayerModal
          video={playing}
          api={api}
          canDelete={isAdmin || playing.ownerSub === currentUser?.userSub}
          onClose={() => setPlaying(null)}
          onDelete={() => handleDelete(playing.id)}
        />
      )}
    </div>
  );
};

const UploadForm: React.FC<{ api: any; tournaments: any[]; onDone: () => void }> = ({ api, tournaments, onDone }) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [tournamentId, setTournamentId] = useState('');
  const [matchLabel, setMatchLabel] = useState('');
  const [wantAi, setWantAi] = useState(true);
  const [stage, setStage] = useState<'idle' | 'uploading' | 'analyzing' | 'saving'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (f: File | null) => {
    setError(null);
    if (!f) { setFile(null); return; }
    if (!f.type.startsWith('video/')) { setError('Please choose a video file.'); return; }
    if (f.size > MAX_VIDEO_BYTES) { setError('Video is too large — please keep it under 300MB.'); return; }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^/.]+$/, ''));
  };

  const submit = async () => {
    if (!file) { setError('Choose a video file first.'); return; }
    setError(null);
    try {
      setStage('uploading');
      setProgress(0);
      const { id, uploadUrl, s3Key } = await api.presignVideoUpload(file.type || 'video/mp4');
      await api.uploadVideoFile(uploadUrl, file, setProgress);

      let frames: string[] = [];
      if (wantAi) {
        setStage('analyzing');
        try {
          frames = await extractVideoFrames(file, 6);
        } catch {
          frames = []; // extraction failing shouldn't block the upload itself
        }
      }

      setStage('saving');
      await api.createVideoRecord({ id, title: title.trim() || file.name, s3Key, tournamentId: tournamentId || undefined, matchLabel: matchLabel.trim() || undefined, frames });
      onDone();
    } catch (e: any) {
      setError(e?.message || 'Upload failed.');
      setStage('idle');
    }
  };

  return (
    <div className="bg-white border border-light-border rounded-2xl p-5 shadow-sm space-y-4 max-w-xl">
      {error && <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 p-3 rounded-xl">{error}</p>}

      <div className="space-y-1.5">
        <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Video File (up to 300MB)</label>
        <input type="file" accept="video/*" onChange={(e) => handleFile(e.target.files?.[0] || null)} className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5" />
      </div>

      <div className="space-y-1.5">
        <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Semifinal vs Team Orange" className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Tournament (optional)</label>
          <select value={tournamentId} onChange={(e) => setTournamentId(e.target.value)} className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5">
            <option value="">None</option>
            {tournaments.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-mono uppercase text-slate-gray font-bold">Match Note (optional)</label>
          <input value={matchLabel} onChange={(e) => setMatchLabel(e.target.value)} placeholder="e.g. vs Team Orange" className="w-full text-xs bg-off-white border border-light-border rounded-lg px-3 py-2.5" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-slate-gray cursor-pointer">
        <input type="checkbox" checked={wantAi} onChange={(e) => setWantAi(e.target.checked)} />
        Get AI coaching feedback (positioning & technique notes from a few frames — not full swing analysis)
      </label>

      {stage !== 'idle' && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] font-mono font-bold text-slate-gray uppercase">
            <span>{stage === 'uploading' ? 'Uploading...' : stage === 'analyzing' ? 'Extracting frames...' : 'Saving...'}</span>
            {stage === 'uploading' && <span>{progress}%</span>}
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-court-green h-full rounded-full transition-all duration-300" style={{ width: stage === 'uploading' ? `${progress}%` : '100%' }} />
          </div>
        </div>
      )}

      <button
        onClick={submit}
        disabled={stage !== 'idle' || !file}
        className="w-full py-3 rounded-xl bg-court-green hover:bg-[#235F3A] text-white text-xs font-bold font-mono uppercase transition-all cursor-pointer disabled:opacity-60"
      >
        {stage === 'idle' ? 'Upload' : 'Working...'}
      </button>
    </div>
  );
};

const PlayerModal: React.FC<{ video: VideoRecord; api: any; canDelete: boolean; onClose: () => void; onDelete: () => void }> = ({ video, api, canDelete, onClose, onDelete }) => {
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (video.videoDeleted) return; // nothing to fetch — the file's gone by design, not a fetch failure
    api.getVideoPlayUrl(video.id).then((r: any) => setPlayUrl(r.url)).catch((e: any) => setError(e?.message || 'Could not load video.'));
  }, [video.id, video.videoDeleted]);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-light-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-light-border">
          <h3 className="font-display font-bold text-sm text-charcoal truncate pr-4">{video.title}</h3>
          <div className="flex items-center gap-2 shrink-0">
            {canDelete && (
              <button onClick={onDelete} className="text-slate-gray hover:text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
            )}
            <button onClick={onClose} className="text-slate-gray hover:text-charcoal cursor-pointer"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="overflow-y-auto">
          <div className="bg-black aspect-video flex items-center justify-center">
            {video.videoDeleted ? (
              <div className="text-center px-6">
                <Sparkles className="w-6 h-6 text-slate-500 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-mono">Video removed after analysis — see the coaching notes below.</p>
              </div>
            ) : error ? (
              <p className="text-xs text-red-400 font-mono">{error}</p>
            ) : !playUrl ? (
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            ) : (
              <video src={playUrl} controls className="w-full h-full" />
            )}
          </div>

          <div className="p-5 space-y-3">
            <div className="text-xs text-slate-gray font-mono">
              {video.ownerDisplayName} &middot; {new Date(video.createdAt).toLocaleString()}
              {video.matchLabel && <> &middot; {video.matchLabel}</>}
            </div>

            {video.aiStatus === 'pending' && (
              <div className="flex items-center gap-2 text-xs text-soft-gold bg-soft-gold/10 border border-soft-gold/20 rounded-xl p-3">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" /> Your coaching notes are still generating — check back in a moment.
              </div>
            )}
            {video.aiStatus === 'failed' && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">
                {video.aiCommentary || "Coaching notes couldn't be generated for this video."}
              </div>
            )}
            {video.aiStatus === 'done' && video.aiCommentary && (
              <div className="bg-off-white border border-light-border rounded-xl p-4 space-y-1.5">
                <span className="text-[10px] font-mono font-bold text-court-green uppercase flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> AI Coaching Notes
                </span>
                <div className="text-sm text-charcoal leading-relaxed space-y-2">{renderCoachingNotes(video.aiCommentary)}</div>
                <p className="text-[9px] text-slate-gray font-mono pt-1">General observations from a few frames — not shot-by-shot analysis.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
