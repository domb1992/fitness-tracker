import { useRegisterSW } from 'virtual:pwa-register/react';

export function PWAUpdatePrompt() {
  const {
    needRefresh:        [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      // Poll for updates every hour so long-running sessions still get prompted
      if (registration) {
        setInterval(() => registration.update(), 60 * 60 * 1000);
      }
    },
    onRegisterError(err) {
      console.warn('[PWA] Service worker registration failed:', err);
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position:       'fixed',
        bottom:         76,      // above the bottom nav bar (~60 px)
        left:           0,
        right:          0,
        display:        'flex',
        justifyContent: 'center',
        padding:        '0 16px',
        zIndex:         9999,
        pointerEvents:  'none',
      }}
    >
      <div
        className="surface"
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          10,
          padding:      '10px 12px 10px 16px',
          borderRadius: 10,
          border:       '1px solid var(--hair)',
          boxShadow:    '0 4px 24px rgba(0,0,0,0.18)',
          pointerEvents: 'auto',
          maxWidth:     360,
          width:        '100%',
        }}
      >
        {/* Update icon */}
        <svg
          width={14} height={14} viewBox="0 0 24 24"
          fill="none" stroke="var(--ink-3)" strokeWidth={2.2}
          strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>

        <span style={{
          flex:          1,
          fontFamily:    'var(--mono)',
          fontSize:      10,
          letterSpacing: '0.05em',
          color:         'var(--ink)',
          whiteSpace:    'nowrap',
        }}>
          UPDATE AVAILABLE
        </span>

        <button
          onClick={() => updateServiceWorker(true)}
          style={{
            fontFamily:    'var(--mono)',
            fontSize:      10,
            letterSpacing: '0.06em',
            fontWeight:    700,
            padding:       '5px 14px',
            borderRadius:  6,
            background:    'var(--ink)',
            color:         'var(--paper)',
            border:        'none',
            cursor:        'pointer',
            whiteSpace:    'nowrap',
          }}
        >
          RELOAD
        </button>

        <button
          onClick={() => setNeedRefresh(false)}
          aria-label="Dismiss update notification"
          style={{
            fontFamily: 'var(--mono)',
            fontSize:   16,
            lineHeight: 1,
            color:      'var(--ink-4)',
            background: 'none',
            border:     'none',
            cursor:     'pointer',
            padding:    '2px 4px',
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
