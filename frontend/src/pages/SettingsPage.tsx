import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/store';
import { useThemeStore, type ThemeChoice } from '../store/store';
import { supabase } from '../lib/supabase';

// ── helpers ──────────────────────────────────────────────────────────────────

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function passwordStrength(pw: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (pw.length === 0)  return { level: 0, label: '',       color: 'var(--paper-3)' };
  if (pw.length < 8)   return { level: 1, label: 'Weak',   color: 'var(--danger)'  };
  if (pw.length < 12)  return { level: 2, label: 'Medium', color: 'var(--warning)' };
  return                      { level: 3, label: 'Strong',  color: 'var(--success)' };
}

// ── inline components ─────────────────────────────────────────────────────────

function InfoBanner({ children }: { children: ReactNode }) {
  return (
    <div style={{
      background: 'oklch(0.55 0.15 145 / 0.08)',
      border: '1px solid oklch(0.55 0.15 145 / 0.22)',
      borderRadius: 'var(--r-1)', padding: '10px 13px',
      fontSize: 13, lineHeight: 1.45,
      color: 'var(--success)',
    }}>
      {children}
    </div>
  );
}

function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div style={{
      background: 'var(--danger-soft)',
      border: '1px solid oklch(0.54 0.22 25 / 0.22)',
      borderRadius: 'var(--r-1)', padding: '10px 13px',
      fontSize: 13, lineHeight: 1.45,
      color: 'var(--danger)',
    }}>
      {children}
    </div>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

// ── Theme icons ───────────────────────────────────────────────────────────────

function SunIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

function AutoIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  );
}

const THEME_OPTIONS: { value: ThemeChoice; label: string; Icon: () => JSX.Element }[] = [
  { value: 'light',  label: 'Light',  Icon: SunIcon  },
  { value: 'system', label: 'Auto',   Icon: AutoIcon },
  { value: 'dark',   label: 'Dark',   Icon: MoonIcon },
];

// ── page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, signOut, updateName } = useAuthStore();
  const { theme, setTheme } = useThemeStore();

  // ── profile ────────────────────────────────────────────────────────────────
  const [name,             setName]             = useState(user?.name  ?? '');
  const [email,            setEmail]            = useState(user?.email ?? '');
  const [profileSaving,    setProfileSaving]    = useState(false);
  const [profileSaved,     setProfileSaved]     = useState(false);
  const [profileError,     setProfileError]     = useState('');
  const [emailConfirmSent, setEmailConfirmSent] = useState(false);

  // ── password ────────────────────────────────────────────────────────────────
  const [newPw,         setNewPw]         = useState('');
  const [confirmPw,     setConfirmPw]     = useState('');
  const [showNewPw,     setShowNewPw]     = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwSaving,      setPwSaving]      = useState(false);
  const [pwSaved,       setPwSaved]       = useState(false);
  const [pwError,       setPwError]       = useState('');

  // ── reset via email ─────────────────────────────────────────────────────────
  const [resetSending, setResetSending] = useState(false);
  const [resetSent,    setResetSent]    = useState(false);
  const [resetError,   setResetError]   = useState('');

  // ── derived ─────────────────────────────────────────────────────────────────
  const nameChanged    = name.trim()  !== '' && name.trim()  !== (user?.name  ?? '');
  const emailChanged   = email.trim().toLowerCase() !== (user?.email ?? '').toLowerCase();
  const profileChanged = nameChanged || emailChanged;
  const strength       = passwordStrength(newPw);

  // ── handlers ────────────────────────────────────────────────────────────────

  async function handleSaveProfile() {
    const trimName  = name.trim();
    const trimEmail = email.trim().toLowerCase();
    if (!trimName)              { setProfileError('Name cannot be empty'); return; }
    if (!isValidEmail(trimEmail)) { setProfileError('Please enter a valid email address'); return; }

    setProfileSaving(true);
    setProfileError('');
    setEmailConfirmSent(false);
    try {
      if (nameChanged)  await updateName(trimName);
      if (emailChanged) {
        const { error } = await supabase.auth.updateUser({ email: trimEmail });
        if (error) throw error;
        setEmailConfirmSent(true);
      }
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleUpdatePassword() {
    setPwError('');
    if (newPw.length < 8)    { setPwError('Password must be at least 8 characters'); return; }
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return; }

    setPwSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setNewPw('');
      setConfirmPw('');
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 3000);
    } catch (err: any) {
      setPwError(err.message || 'Failed to update password');
    } finally {
      setPwSaving(false);
    }
  }

  async function handleResetPassword() {
    if (!user?.email) return;
    setResetSending(true); setResetError('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err: any) {
      setResetError(err.message || 'Failed to send reset email');
    } finally {
      setResetSending(false);
    }
  }

  async function handleLogout() {
    await signOut();
    navigate('/auth', { replace: true });
  }

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <div className="ft-screen" style={{ paddingBottom: 'var(--nav-safe)' }}>

      {/* Header */}
      <div style={{ padding: '16px 20px 8px' }}>
        <div className="mono-tag">Profile</div>
        {user?.name && (
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', marginTop: 4 }}>
            {user.name.split(' ')[0]}
          </div>
        )}
      </div>

      <div style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── Profile ─────────────────────────────────────────────────────── */}
        <div className="surface" style={{ padding: '18px 16px' }}>
          <div className="mono-tag" style={{ marginBottom: 16 }}>Account Info</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div>
              <label className="ft-label">Display Name</label>
              <input
                type="text"
                value={name}
                className="ft-input"
                onChange={(e) => { setName(e.target.value); setProfileSaved(false); }}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveProfile()}
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="ft-label">Email Address</label>
              <input
                type="email"
                value={email}
                className="ft-input"
                onChange={(e) => { setEmail(e.target.value); setProfileSaved(false); setEmailConfirmSent(false); }}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveProfile()}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>

            {emailConfirmSent && (
              <InfoBanner>
                Confirmation sent to <strong>{email.trim().toLowerCase()}</strong> — click the link to update.
              </InfoBanner>
            )}
            {profileError && <ErrorBanner>{profileError}</ErrorBanner>}

            <button
              onClick={handleSaveProfile}
              disabled={profileSaving || !profileChanged}
              className="block-btn"
              style={{ height: 48, fontSize: 14 }}
            >
              <span>{profileSaving ? 'Saving…' : profileSaved ? '✓ Saved' : 'Save Profile'}</span>
              {profileSaved && !profileSaving && (
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              )}
            </button>
          </div>
        </div>

        {/* ── Appearance / Theme ───────────────────────────────────────────── */}
        <div className="surface" style={{ padding: '18px 16px' }}>
          <div className="mono-tag" style={{ marginBottom: 16 }}>Appearance</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>Theme</div>
                <div className="mono-tag" style={{ fontSize: 9, marginTop: 3, textTransform: 'none', color: 'var(--ink-4)' }}>
                  {theme === 'system' ? 'Following device setting' : `Always ${theme} mode`}
                </div>
              </div>
              <div className="seg-ctrl" style={{ marginLeft: 12 }}>
                {THEME_OPTIONS.map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    className={`seg-btn${theme === value ? ' active' : ''}`}
                    onClick={() => setTheme(value)}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Icon />
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Change Password ──────────────────────────────────────────────── */}
        <div className="surface" style={{ padding: '18px 16px' }}>
          <div className="mono-tag" style={{ marginBottom: 16 }}>Change Password</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div>
              <label className="ft-label">New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPw}
                  className="ft-input"
                  style={{ paddingRight: 46 }}
                  onChange={(e) => { setNewPw(e.target.value); setPwError(''); setPwSaved(false); }}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw((v) => !v)}
                  style={{
                    position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--ink-3)', padding: 2, display: 'flex', alignItems: 'center',
                  }}
                >
                  <EyeIcon open={showNewPw} />
                </button>
              </div>
              {newPw.length > 0 && (
                <div style={{ marginTop: 7 }}>
                  <div style={{ height: 3, borderRadius: 2, background: 'var(--paper-3)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 2,
                      width: `${(strength.level / 3) * 100}%`,
                      background: strength.color,
                      transition: 'width 220ms ease, background 220ms ease',
                    }} />
                  </div>
                  <div style={{
                    marginTop: 4, fontFamily: 'var(--mono)', fontSize: 9,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: strength.color,
                  }}>
                    {strength.label}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="ft-label">Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmPw ? 'text' : 'password'}
                  value={confirmPw}
                  className="ft-input"
                  style={{ paddingRight: 46 }}
                  onChange={(e) => { setConfirmPw(e.target.value); setPwError(''); setPwSaved(false); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleUpdatePassword()}
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw((v) => !v)}
                  style={{
                    position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--ink-3)', padding: 2, display: 'flex', alignItems: 'center',
                  }}
                >
                  <EyeIcon open={showConfirmPw} />
                </button>
              </div>
              {confirmPw.length > 0 && newPw.length > 0 && (
                <div style={{
                  marginTop: 4, fontFamily: 'var(--mono)', fontSize: 9,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: newPw === confirmPw ? 'var(--success)' : 'var(--danger)',
                }}>
                  {newPw === confirmPw ? '✓ Passwords match' : '✕ Passwords do not match'}
                </div>
              )}
            </div>

            {pwError && <ErrorBanner>{pwError}</ErrorBanner>}
            {pwSaved && <InfoBanner>Password updated successfully.</InfoBanner>}

            <button
              onClick={handleUpdatePassword}
              disabled={pwSaving || !newPw || !confirmPw}
              className="block-btn"
              style={{ height: 48, fontSize: 14 }}
            >
              <span>{pwSaving ? 'Updating…' : 'Update Password'}</span>
              {pwSaved && !pwSaving && (
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              )}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span className="mono-tag" style={{ fontSize: 9, color: 'var(--ink-4)' }}>OR</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            {resetSent ? (
              <InfoBanner>
                Check your email — reset link sent to <strong>{user?.email}</strong>.
              </InfoBanner>
            ) : (
              <>
                {resetError && <ErrorBanner>{resetError}</ErrorBanner>}
                <button
                  onClick={handleResetPassword}
                  disabled={resetSending}
                  className="ghost-btn"
                  style={{ height: 44, fontSize: 13 }}
                >
                  {resetSending ? 'Sending…' : 'Send Reset Link via Email'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Sign Out ─────────────────────────────────────────────────────── */}
        <div className="surface" style={{ padding: '18px 16px' }}>
          <div className="mono-tag" style={{ marginBottom: 14 }}>Account</div>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', height: 48,
              background: 'var(--danger-soft)',
              color: 'var(--danger)',
              border: '1px solid oklch(0.54 0.22 25 / 0.18)',
              borderRadius: 'var(--r-2)',
              fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background var(--duration-fast) var(--ease)',
            }}
          >
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
            Sign Out
          </button>
        </div>

        {/* ── Version ──────────────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', paddingTop: 4, paddingBottom: 10 }}>
          <span className="mono-tag" style={{ color: 'var(--ink-4)', fontSize: 9 }}>
            Version {__APP_VERSION__}
          </span>
        </div>

      </div>
    </div>
  );
}
