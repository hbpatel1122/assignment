'use client';
import { motion } from 'framer-motion';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

const dotSize = { sm: 'w-1.5 h-1.5', md: 'w-2 h-2', lg: 'w-2.5 h-2.5' };
const gap     = { sm: 'gap-1',       md: 'gap-1.5',  lg: 'gap-2' };

export default function Loader({ size = 'md', color = 'bg-white' }: Props) {
  return (
    <span className={`inline-flex items-center ${gap[size]}`}>
      {[0, 0.15, 0.3].map((delay, i) => (
        <motion.span
          key={i}
          className={`${dotSize[size]} ${color} rounded-full`}
          animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.6, repeat: Infinity, delay, ease: 'easeInOut' }}
        />
      ))}
    </span>
  );
}
