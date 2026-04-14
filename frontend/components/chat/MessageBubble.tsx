'use client';
import { motion } from 'framer-motion';
import { Message } from '@/types';
import { formatTime } from '@/lib/dateUtils';
import { resolveMediaUrl } from '@/lib/api';

interface Props {
  message: Message;
  isOwn: boolean;
  showAvatar: boolean;
  isLastInGroup?: boolean;
}

/* ─── Status tick (WhatsApp style) ─────────────────────────── */
// viewBox "0 0 22 11": tick1 bottom=(4,10), tick2 bottom=(9,10) → 5-unit gap → no merging
const DOUBLE_VB = "0 0 22 11";
const SINGLE_VB = "0 0 14 11";
const SW        = "1.8";
const LC        = "round";

function StatusTick({ status }: { status: string }) {
  if (status === 'read') {
    return (
      <motion.svg
        key="read"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        width="17" height="10"
        viewBox={DOUBLE_VB} fill="none" className="shrink-0"
      >
        {/* tick 1 — ends at (10.5, 0.5) */}
        <path d="M0.5 6L4 10L10.5 0.5"  stroke="#53bdeb" strokeWidth={SW} strokeLinecap={LC} strokeLinejoin={LC} />
        {/* tick 2 — starts at (5.5, 6), ends at (15.5, 0.5) — clearly separated */}
        <path d="M5.5 6L9 10L15.5 0.5"  stroke="#53bdeb" strokeWidth={SW} strokeLinecap={LC} strokeLinejoin={LC} />
      </motion.svg>
    );
  }
  if (status === 'delivered') {
    return (
      <svg width="17" height="10" viewBox={DOUBLE_VB} fill="none" className="shrink-0">
        <path d="M0.5 6L4 10L10.5 0.5"  stroke="rgba(255,255,255,0.45)" strokeWidth={SW} strokeLinecap={LC} strokeLinejoin={LC} />
        <path d="M5.5 6L9 10L15.5 0.5"  stroke="rgba(255,255,255,0.45)" strokeWidth={SW} strokeLinecap={LC} strokeLinejoin={LC} />
      </svg>
    );
  }
  // sent — single tick
  return (
    <svg width="11" height="9" viewBox={SINGLE_VB} fill="none" className="shrink-0">
      <path d="M0.5 6L4 10L13.5 0.5"    stroke="rgba(255,255,255,0.4)"  strokeWidth={SW} strokeLinecap={LC} strokeLinejoin={LC} />
    </svg>
  );
}

/* ─── Bubble ────────────────────────────────────────────────── */
export default function MessageBubble({ message, isOwn, showAvatar, isLastInGroup = true }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.16, ease: [0.34, 1.2, 0.64, 1] }}
      className={`flex items-end gap-1.5 px-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'} ${
        isLastInGroup ? 'mb-1' : 'mb-0.5'
      }`}
    >
      {/* Avatar slot — always reserves space to keep bubbles aligned */}
      <div className="w-7 h-7 shrink-0 self-end">
        {!isOwn && showAvatar && (
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-[11px] font-bold shadow-sm">
            {message.sender.username[0]?.toUpperCase()}
          </div>
        )}
      </div>

      <div className={`flex flex-col max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {/* ── Bubble ── */}
        <div
          className={`
            relative text-sm leading-relaxed break-words min-w-0 shadow-sm
            transition-opacity hover:opacity-95 overflow-hidden
            ${message.mediaUrl ? 'p-0' : 'px-3.5 py-2'}
            ${isOwn
              ? `bg-gradient-to-br from-indigo-600 to-violet-600 text-white
                 ${isLastInGroup ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl'}`
              : `bg-gray-800/90 text-gray-100 border border-gray-700/30
                 ${isLastInGroup ? 'rounded-2xl rounded-bl-sm' : 'rounded-2xl'}`
            }
          `}
        >
          {/* ── Media image ── */}
          {message.mediaUrl && (
            <div className="relative">
              <img
                src={resolveMediaUrl(message.mediaUrl)}
                alt="media"
                className="max-w-[260px] w-full object-cover rounded-2xl cursor-pointer"
                onClick={() => window.open(resolveMediaUrl(message.mediaUrl), '_blank')}
              />
              {/* time overlay on image */}
              <span className={`absolute bottom-1.5 right-2 flex items-center gap-0.5 bg-black/50 backdrop-blur-sm rounded-full px-1.5 py-0.5`}>
                <span className="text-[10px] text-white/90 whitespace-nowrap">
                  {formatTime(message.createdAt)}
                </span>
                {isOwn && <StatusTick status={message.status} />}
              </span>
              {/* caption below image if present */}
              {message.content && (
                <div className={`px-3 py-2 text-sm ${isOwn ? 'text-white' : 'text-gray-100'}`}>
                  {message.content}
                </div>
              )}
            </div>
          )}

          {/* ── Text only ── */}
          {!message.mediaUrl && (
            <div className="flex flex-wrap items-end gap-x-1.5">
              <span className="break-words min-w-0 flex-shrink">{message.content}</span>
              <span className={`flex items-center gap-0.5 shrink-0 ml-auto self-end pb-px ${
                isOwn ? '' : 'opacity-70'
              }`}>
                <span className={`text-[10px] whitespace-nowrap ${
                  isOwn ? 'text-indigo-200/80' : 'text-gray-400'
                }`}>
                  {formatTime(message.createdAt)}
                </span>
                {isOwn && <StatusTick status={message.status} />}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
