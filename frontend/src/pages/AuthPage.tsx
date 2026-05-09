import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button, Input, Card, Typography, Badge } from '../components/ui';

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [mode,      setMode]      = useState<'login' | 'signup'>('login');
  const [name,      setName]      = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [message,   setMessage]   = useState('');

  // Handle redirect if already logged in
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
          options: {
            data: { name },
            emailRedirectTo: window.location.origin + '/auth',
          },
        });
        if (error) throw error;
        setMessage('Success! Check your email to confirm your account.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ft-screen flex flex-col items-center justify-center p-6 bg-[var(--paper-2)]">
      <div className="w-full max-w-[360px] animate-slide-up">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-[var(--ink)] text-[var(--paper)] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>
              <path d="M12 8v8M8 12h8"/>
            </svg>
          </div>
          <Typography variant="h1" className="text-3xl mb-1 block">FitTrack</Typography>
          <Typography variant="mono" className="text-[var(--ink-3)]">The iron never lies</Typography>
        </div>

        <Card className="p-6 shadow-md border-none">
          <div className="flex bg-[var(--paper-2)] p-1 rounded-[var(--r-1)] mb-6">
            <button
              onClick={() => { setMode('login'); setError(''); setMessage(''); }}
              className={`flex-1 h-9 rounded-[7px] text-[10px] font-mono font-bold uppercase tracking-wider transition-all ${
                mode === 'login' ? 'bg-[var(--paper)] text-[var(--ink)] shadow-sm' : 'bg-transparent text-[var(--ink-4)]'
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => { setMode('signup'); setError(''); setMessage(''); }}
              className={`flex-1 h-9 rounded-[7px] text-[10px] font-mono font-bold uppercase tracking-wider transition-all ${
                mode === 'signup' ? 'bg-[var(--paper)] text-[var(--ink)] shadow-sm' : 'bg-transparent text-[var(--ink-4)]'
              }`}
            >
              Sign Up
            </button>
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

            {error && <Badge variant="danger" className="py-2.5 px-4 text-[11px] leading-relaxed">{error}</Badge>}
            {message && <Badge variant="success" className="py-2.5 px-4 text-[11px] leading-relaxed">{message}</Badge>}

            <Button
              type="submit"
              isLoading={loading}
              className="mt-2 h-12"
              rightIcon={!loading && (
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6"/>
                </svg>
              )}
            >
              {mode === 'login' ? 'Continue' : 'Create Account'}
            </Button>
          </form>
        </Card>

        {mode === 'login' && (
          <button
            onClick={async () => {
              if (!email) { setError('Enter your email first'); return; }
              setLoading(true); setError('');
              const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + '/update-password',
              });
              setLoading(false);
              if (error) setError(error.message);
              else setMessage('Reset link sent to your email.');
            }}
            className="w-full mt-6 bg-transparent border-none cursor-pointer font-mono text-[9px] font-bold tracking-widest uppercase text-[var(--ink-4)] hover:text-[var(--ink-2)] transition-colors"
          >
            Forgot password?
          </button>
        )}
      </div>
    </div>
  );
}
