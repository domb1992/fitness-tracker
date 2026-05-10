import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Input, Badge } from '../components/ui';

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [mode,     setMode]     = useState<'login' | 'signup'>('login');
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [message,  setMessage]  = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/dashboard', { replace: true });
    });
  }, [navigate]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(''); setMessage('');
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const from = (location.state as any)?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { name }, emailRedirectTo: window.location.origin + '/auth' },
        });
        if (error) throw error;
        setMessage('Check your email to confirm your account.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email) { setError('Enter your email first'); return; }
    setLoading(true); setError('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/update-password',
    });
    setLoading(false);
    if (error) setError(error.message);
    else setMessage('Reset link sent to your email.');
  }

  return (
    <div className="ft-screen flex flex-col min-h-dvh bg-[var(--paper-2)]">

      {/* Brand section */}
      <div className="flex-shrink-0 bg-[var(--ink)] px-8 pt-14 pb-10 flex flex-col items-center text-center">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: 'var(--lime)' }}
        >
          <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="var(--lime-ink)"
            strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6.5 6.5h11"/><path d="M6.5 17.5h11"/>
            <path d="M4 8.5v7"/><path d="M20 8.5v7"/>
            <rect x="2" y="8" width="3" height="8" rx="1"/>
            <rect x="19" y="8" width="3" height="8" rx="1"/>
            <rect x="5" y="6" width="2" height="12" rx="1"/>
            <rect x="17" y="6" width="2" height="12" rx="1"/>
          </svg>
        </div>
        <h1 style={{
          margin: 0, fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em',
          color: 'oklch(0.97 0.004 85)', lineHeight: 1,
        }}>
          FitTrack
        </h1>
        <p style={{
          margin: '10px 0 0', fontFamily: 'var(--mono)', fontSize: 10,
          letterSpacing: '0.10em', textTransform: 'uppercase',
          color: 'oklch(0.97 0.004 85 / 0.40)',
        }}>
          The iron never lies
        </p>
      </div>

      {/* Form section */}
      <div className="flex-1 flex flex-col px-6 pt-8 pb-10 max-w-[420px] w-full mx-auto">

        {/* Mode toggle */}
        <div className="flex bg-[var(--paper-3)] p-1 rounded-[var(--r-1)] mb-7">
          {(['login', 'signup'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); setMessage(''); }}
              className={[
                'flex-1 h-9 rounded-[7px] text-[10px] font-mono font-bold uppercase tracking-wider transition-all',
                mode === m
                  ? 'bg-[var(--paper)] text-[var(--ink)] shadow-sm'
                  : 'bg-transparent text-[var(--ink-4)]',
              ].join(' ')}
            >
              {m === 'login' ? 'Log In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <form onSubmit={handleAuth} className="flex flex-col gap-5">
          {mode === 'signup' && (
            <Input
              label="Full Name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
            />
          )}
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoFocus
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
          />

          {error && (
            <Badge variant="danger" className="py-2.5 px-4 text-[11px] leading-relaxed">
              {error}
            </Badge>
          )}
          {message && (
            <Badge variant="success" className="py-2.5 px-4 text-[11px] leading-relaxed">
              {message}
            </Badge>
          )}

          <button
            type="submit"
            disabled={loading}
            className="block-btn lime mt-2"
            style={{ height: 52, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}
          >
            <span>{loading ? 'Please wait…' : mode === 'login' ? 'Continue' : 'Create Account'}</span>
            {!loading && (
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6"/>
              </svg>
            )}
          </button>
        </form>

        {mode === 'login' && (
          <button
            onClick={handleForgotPassword}
            disabled={loading}
            className="w-full mt-5 bg-transparent border-none cursor-pointer font-mono text-[9px] font-bold tracking-widest uppercase text-[var(--ink-4)] hover:text-[var(--ink-2)] transition-colors"
          >
            Forgot password?
          </button>
        )}
      </div>
    </div>
  );
}
