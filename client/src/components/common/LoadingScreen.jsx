// ── LoadingScreen.jsx ──────────────────────────────────────────────────────────
import React from 'react';
export default function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
      <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      <p className="text-slate-400 text-sm font-medium">Loading ServiceHub…</p>
    </div>
  );
}
