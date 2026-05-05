interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  dangerous?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  dangerous = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'oklch(0.18 0.012 80 / 0.5)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      padding: 16,
    }}>
      <div className="surface" style={{ width: '100%', maxWidth: 390, padding: 24 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</h2>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, height: 48,
              background: 'transparent', color: 'var(--ink)',
              border: '1px solid var(--hair)', borderRadius: 8,
              fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500, cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, height: 48,
              background: dangerous ? 'oklch(0.55 0.22 25)' : 'var(--ink)',
              color: 'var(--paper)',
              border: 0, borderRadius: 8,
              fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
