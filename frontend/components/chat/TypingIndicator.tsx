'use client';
import { motion } from 'framer-motion';

export default function TypingIndicator({ username }: { username: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex items-end gap-2 px-4 mb-1"
    >
      {/* avatar placeholder */}
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0">
        {username[0]?.toUpperCase()}
      </div>

      <div className="bg-gray-800 border border-gray-700/40 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2 shadow-sm">
        {/* username label */}
        <span className="text-gray-400 text-xs font-medium">{username}</span>
        {/* animated dots */}
        <div className="flex items-center gap-1">
          {[0, 0.16, 0.32].map((delay, i) => (
            <motion.span
              key={i}
              className="w-1.5 h-1.5 bg-indigo-400 rounded-full"
              animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }}
              transition={{
                duration: 0.7,
                repeat: Infinity,
                delay,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
