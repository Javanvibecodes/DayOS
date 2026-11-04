import { useToastStore, type ToastVariant } from '@/stores/toastStore';

const VARIANT_STYLES: Record<ToastVariant, { container: string; icon: string }> = {
  success: {
    container: 'bg-primary text-on-primary',
    icon: 'check_circle',
  },
  error: {
    container: 'bg-error-container text-on-error-container',
    icon: 'error',
  },
  info: {
    container: 'bg-surface-container-high text-on-surface border border-outline-variant/40',
    icon: 'info',
  },
};

export function ToastHost() {
  const message = useToastStore((s) => s.message);
  const variant = useToastStore((s) => s.variant);
  const hide = useToastStore((s) => s.hide);

  if (!message) return null;

  const style = VARIANT_STYLES[variant];

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={hide}
      className={`fixed bottom-6 right-6 z-[70] max-w-[360px] cursor-pointer font-semibold text-[13px] px-[16px] py-[12px] rounded-xl shadow-2xl flex items-center gap-[12px] animate-toast-in ${style.container}`}
    >
      <span className="material-symbols-outlined text-[18px] shrink-0">{style.icon}</span>
      <span className="leading-snug">{message}</span>
    </div>
  );
}
