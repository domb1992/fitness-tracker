import { useState, FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../api/client';
import { supabase } from '../lib/supabase';

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from     = (location.state as any)?.from?.pathname || '/dashboard';

  const [mode,         setMode]         = useState<'login' | 'register'>('login');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [info,         setInfo]         = useState('');
  const [form,         setForm]         = useState({ name: '', email: '', password: '' });
  const [resetSending, setResetSending] = useState(false);

  const field = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleForgotPassword() {
    if (!form.email) { setError('Enter your email address first'); return; }
    setResetSending(true); setError('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      if (error) throw error;
      setInfo('Check your email — a password reset link has been sent.');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setResetSending(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(''); setInfo('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await authApi.login(form.email, form.password);
        // onAuthStateChange in store fires automatically → navigate
        navigate(from, { replace: true });
      } else {
        const result = await authApi.register(form.email, form.password, form.name);
        if (result.session) {
          navigate(from, { replace: true });
        } else {
          setInfo('Check your email to confirm your account, then sign in.');
          setMode('login');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--paper)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 24px 48px',
    }}>
      <div style={{ width: '100%', maxWidth: 360 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, background: 'var(--ink)',
            borderRadius: 'var(--r-2)', marginBottom: 16,
          }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 22, color: 'var(--lime)', fontWeight: 600 }}>FT</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--ink)' }}>
            FitTrack
          </h1>
          <p className="mono-tag" style={{ marginTop: 6 }}>Training planner</p>
        </div>

        {/* Toggle */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          background: 'var(--paper-2)', border: '1px solid var(--hair)',
          borderRadius: 'var(--r-2)', padding: 3, marginBottom: 24, gap: 3,
        }}>
          {(['login', 'register'] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setError(''); setInfo(''); }} style={{
              padding: '9px 0',
              background: mode === m ? 'var(--ink)' : 'transparent',
              color: mode === m ? 'var(--paper)' : 'var(--ink-3)',
              border: 'none', borderRadius: 5,
              fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 500,
              letterSpacing: '0.04em', textTransform: 'uppercase',
              cursor: 'pointer',
            }}>
              {m === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'register' && (
            <div>
              <label className="ft-label">Full Name</label>
              <input className="ft-input" type="text" value={form.name} onChange={field('name')}
                placeholder="Alex Johnson" required autoComplete="name" />
            </div>
          )}
          <div>
            <label className="ft-label">Email</label>
            <input className="ft-input" type="email" value={form.email} onChange={field('email')}
              placeholder="you@example.com" required autoComplete="email" />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label className="ft-label">Password</label>
              {mode === 'login' && (
                <button type="button" onClick={handleForgotPassword} disabled={resetSending} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.06em',
                  textTransform: 'uppercase', color: 'var(--ink-3)',
                  textDecoration: 'underline', textUnderlineOffset: 2,
                  opacity: resetSending ? 0.5 : 1,
                }}>
                  {resetSending ? 'Sending…' : 'Forgot password?'}
                </button>
              )}
            </div>
            <input className="ft-input" type="password" value={form.password} onChange={field('password')}
              placeholder={mode === 'register' ? 'At least 6 characters' : '••••••••'}
              required minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </div>

          {error && (
            <div style={{
              background: 'oklch(0.93 0.05 30)', border: '1px solid oklch(0.80 0.08 30)',
              color: 'oklch(0.35 0.10 30)', borderRadius: 'var(--r-2)', padding: '10px 14px',
              fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '0.02em',
            }}>{error}</div>
          )}
          {info && (
            <div style={{
              background: 'oklch(0.93 0.12 145)', border: '1px solid oklch(0.80 0.12 145)',
              color: 'oklch(0.30 0.10 145)', borderRadius: 'var(--r-2)', padding: '10px 14px',
              fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '0.02em',
            }}>{info}</div>
          )}

          <button type="submit" disabled={loading} className="block-btn" style={{ marginTop: 4 }}>
            <span>{loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}</span>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6"/>
            </svg>
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24 }} className="mono-tag">
          {mode === 'login' ? 'No account? ' : 'Have an account? '}
          <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setInfo(''); }} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'var(--ink)', fontWeight: 600,
            textDecoration: 'underline', textUnderlineOffset: 3, padding: 0,
          }}>
            {mode === 'login' ? 'Register' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
