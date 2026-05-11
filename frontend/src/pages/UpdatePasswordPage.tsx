import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';

export default function UpdatePasswordPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [saving,    setSaving]    = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState('');

  async function handleSubmit() {
    if (!password) { setError(t('updatePassword.errors.required')); return; }
    if (password.length < 6) { setError(t('updatePassword.errors.tooShort')); return; }
    if (password !== confirm) { setError(t('updatePassword.errors.mismatch')); return; }
    setSaving(true); setError('');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--paper-2)', border: '1px solid var(--hair)',
    borderRadius: 8, padding: '10px 12px', fontSize: 14,
    fontFamily: 'var(--sans)', color: 'var(--ink)', outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div className="ft-screen" style={{ paddingBottom: 32 }}>
      <div style={{ padding: '8px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="icon-btn" onClick={() => navigate('/settings')}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M11 6l-6 6 6 6"/>
          </svg>
        </button>
        <div className="mono-tag">{t('updatePassword.label')}</div>
        <div style={{ width: 32 }} />
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {done ? (
          <div className="surface" style={{ padding: '24px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>{t('updatePassword.successTitle')}</h2>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--ink-2)' }}>{t('updatePassword.successBody')}</p>
            <button className="block-btn" onClick={() => navigate('/dashboard', { replace: true })}>
              <span>{t('updatePassword.goToDashboard')}</span>
            </button>
          </div>
        ) : (
          <div className="surface" style={{ padding: '18px 16px' }}>
            <div className="mono-tag" style={{ marginBottom: 14 }}>{t('updatePassword.heading')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="ft-label">{t('updatePassword.newPassword')}</label>
                <input
                  type="password" value={password} style={inputStyle}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder={t('updatePassword.newPasswordPlaceholder')}
                  autoFocus
                />
              </div>
              <div>
                <label className="ft-label">{t('updatePassword.confirmPassword')}</label>
                <input
                  type="password" value={confirm} style={inputStyle}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder={t('updatePassword.confirmPasswordPlaceholder')}
                />
              </div>
              {error && (
                <div style={{ background: 'oklch(0.55 0.22 25 / 0.1)', border: '1px solid oklch(0.55 0.22 25 / 0.3)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'oklch(0.55 0.22 25)' }}>
                  {error}
                </div>
              )}
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="block-btn"
                style={{ height: 48, opacity: saving ? 0.5 : 1 }}
              >
                <span>{saving ? t('updatePassword.updating') : t('updatePassword.submit')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
