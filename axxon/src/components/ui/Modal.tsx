// Provides an accessible, viewport-bounded dialog for product forms and confirmations.
'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { buttonClassName } from '@/components/ui/Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
}

// Keeps focus, Escape, overlay dismissal, and scrolling consistent across dialogs.
export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
}: ModalProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay asChild>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
            className="fixed inset-0 z-50 bg-black/65"
          />
        </Dialog.Overlay>
        <Dialog.Content asChild aria-describedby={description ? undefined : ''}>
          <motion.div
            initial={
              shouldReduceMotion ? false : { opacity: 0, y: 12, scale: 0.985 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.22,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-foreground)] shadow-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--app-border)] px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <Dialog.Title
                  className={
                    title ? 'text-lg font-semibold tracking-tight' : 'sr-only'
                  }
                >
                  {title || 'Dialog'}
                </Dialog.Title>
                {description && (
                  <Dialog.Description className="mt-1 text-sm app-text-muted">
                    {description}
                  </Dialog.Description>
                )}
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className={buttonClassName({
                    variant: 'ghost',
                    size: 'icon',
                    className: 'shrink-0',
                  })}
                  aria-label="Close modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>
            <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
              {children}
            </div>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
