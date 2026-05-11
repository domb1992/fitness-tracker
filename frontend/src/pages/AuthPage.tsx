import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { Input, Badge } from '../components/ui';
import { ApexMark } from '../components/ApexMark';

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

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
        setMessage(t('auth.checkEmail'));
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email) { setError(t('auth.enterEmailFirst')); return; }
    setLoading(true); setError('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/update-password',
    });
    setLoading(false);
    if (error) setError(error.message);
    else setMessage(t('auth.resetSent'));
  }

  return (
    <div className="ft-screen flex flex-col min-h-dvh bg-[var(--paper-2)]">

      {/* Brand section — always ink-dark regardless of theme */}
      <div className="flex-shrink-0 px-8 pt-16 pb-12 flex flex-col items-center text-center" style={{ background: '#0B0C0E' }}>
        {/* Apex app icon tile */}
        <div style={{
          width: 72, height: 72,
          borderRadius: 18,
          background: 'var(--ink-2)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08), 0 20px 40px -20px rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20,
        }}>
          <ApexMark size={38} color="#F2EFE8" accentColor="#D6FF3D" />
        </div>

        {/* Wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontFamily: 'var(--sans)',
            fontWeight: 600,
            fontSize: 32,
            letterSpacing: '-0.04em',
            color: '#F2EFE8',
            lineHeight: 1,
          }}>
            Fit<span style={{ fontWeight: 300, opacity: 0.45 }}>Track</span>
          </span>
        </div>

        <p style={{
          margin: '10px 0 0', fontFamily: 'var(--mono)', fontSize: 10,
          letterSpacing: '0.16em', textTransform: 'uppercase',
          color: 'rgba(242,239,232,0.35)',
        }}>
          {t('auth.tagline')}
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
              {m === 'login' ? t('auth.login') : t('auth.signup')}
            </button>
          ))}
        </div>

        <form onSubmit={handleAuth} className="flex flex-col gap-5">
          {mode === 'signup' && (
            <Input
              label={t('auth.fullName')}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('auth.namePlaceholder')}
              required
            />
          )}
          <Input
            label={t('auth.email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('auth.emailPlaceholder')}
            required
            autoFocus
          />
          <Input
            label={t('auth.password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('auth.passwordPlaceholder')}
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
            <span>{loading ? t('auth.pleaseWait') : mode === 'login' ? t('auth.continue') : t('auth.createAccount')}</span>
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
            {t('auth.forgotPassword')}
          </button>
        )}
      </div>
    </div>
  );
}
