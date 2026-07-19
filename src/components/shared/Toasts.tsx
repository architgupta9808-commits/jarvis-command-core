import { AnimatePresence, motion } from 'framer-motion';
import { useUIStore } from '@/stores/ui';

export function Toasts() {
  const toasts = useUIStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed left-1/2 top-16 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.22 }}
            className={`glass pointer-events-auto px-4 py-2 text-xs shadow-holo-sm ${
              t.kind === 'alert' ? 'border-alert/40 text-alert' : t.kind === 'success' ? 'border-holo/40 text-holo' : 'text-ice'
            }`}
          >
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
