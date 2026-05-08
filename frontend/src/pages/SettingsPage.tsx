import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useThemeStore, ThemeChoice } from '../store/store';
import { supabase } from '../lib/supabase';
import { Button, Input, Card, Typography, Badge } from '../components/ui';

const THEME_OPTIONS: { value: ThemeChoice; label: string; Icon: React.FC }[] = [
  { value: 'light',  label: 'Light',  Icon: () => <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg> },
  { value: 'dark',   label: 'Dark',   Icon: () => <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> },
  { value: 'system', label: 'Auto',   Icon: () => <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><path d="M8 21h8M12 17v4"/></svg> },
];

declare const __APP_VERSION__: string;

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, signOut, updateName } = useAuthStore();
  const { theme, setTheme } = useThemeStore();

  const [name,           setName]           = useState(user?.name || '');
  const [email,          setEmail]          = useState(user?.email || '');
  const [profileSaving,  setProfileSaving]  = useState(false);
  const [profileSaved,   setProfileSaved]   = useState(false);
  const [profileError,   setProfileError]   = useState('');
  const [emailConfirmSent, setEmailConfirmSent] = useState(false);

  const [newPw,          setNewPw]          = useState('');
  const [confirmPw,      setConfirmPw]      = useState('');
  const [pwSaving,       setPwSaving]       = useState(false);
  const [pwSaved,        setPwSaved]        = useState(false);
  const [pwError,        setPwError]        = useState('');

  const [resetSending,   setResetSending]   = useState(false);
  const [resetSent,      setResetSent]      = useState(false);
  const [resetError,     setResetError]     = useState('');

  const profileChanged = name !== user?.name || email !== user?.email;

  async function handleSaveProfile() {
    setProfileSaving(true); setProfileError(''); setProfileSaved(false);
    try {
      if (name !== user?.name) await updateName(name);
      if (email !== user?.email) {
        const { error } = await supabase.auth.updateUser({ email });
        if (error) throw error;
        setEmailConfirmSent(true);
      }
      setProfileSaved(true);
    } catch (err: any) {
      setProfileError(err.message || 'Update failed');
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleUpdatePassword() {
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return; }
    setPwSaving(true); setPwError(''); setPwSaved(false);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setPwSaved(true);
      setNewPw(''); setConfirmPw('');
    } catch (err: any) {
      setPwError(err.message || 'Update failed');
    } finally {
      setPwSaving(false);
    }
  }

  async function handleResetPassword() {
    setResetSending(true); setResetError('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user?.email || '', {
        redirectTo: window.location.origin + '/update-password',
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err: any) {
      setResetError(err.message || 'Failed to send reset link');
    } finally {
      setResetSending(false);
    }
  }

  async function handleLogout() {
    await signOut();
    navigate('/auth', { replace: true });
  }

  return (
    <div className="ft-screen animate-fade-in bg-[var(--paper)]" style={{ paddingBottom: 'calc(var(--nav-safe) + 20px)' }}>
      {/* Header */}
      <div className="p-[20px_20px_16px]">
        <Typography variant="h1" className="text-2xl mb-1 block">Settings</Typography>
        <Typography variant="mono" className="text-[var(--ink-4)]">Manage your account</Typography>
      </div>

      <div className="flex flex-col gap-5 px-5">

        {/* Profile */}
        <Card className="p-5 flex flex-col gap-4 border-none bg-[var(--paper-2)]/50">
          <Typography variant="mono" className="mb-1 block opacity-60">Profile</Typography>

          <Input
            label="Name"
            value={name}
            onChange={(e) => { setName(e.target.value); setProfileSaved(false); }}
            placeholder="Your name"
          />

          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setProfileSaved(false); setEmailConfirmSent(false); }}
            placeholder="you@example.com"
          />

          {emailConfirmSent && (
            <Badge variant="info" className="py-2.5 px-4 text-[10px]">
              Confirmation sent to <strong>{email.trim().toLowerCase()}</strong> — click the link to update.
            </Badge>
          )}
          {profileError && <Badge variant="danger" className="py-2.5 px-4 text-[10px]">{profileError}</Badge>}

          <Button
            onClick={handleSaveProfile}
            disabled={profileSaving || !profileChanged}
            isLoading={profileSaving}
            className="h-11 mt-1 font-bold"
            rightIcon={profileSaved && !profileSaving && (
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
            )}
          >
            {profileSaved ? 'Saved' : 'Save Profile'}
          </Button>
        </Card>

        {/* Appearance */}
        <Card className="p-5 border-none bg-[var(--paper-2)]/50">
          <Typography variant="mono" className="mb-4 block opacity-60">Appearance</Typography>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-[var(--ink)]">Theme</div>
              <Typography variant="mono" className="text-[9px] normal-case opacity-50 block mt-0.5">
                {theme === 'system' ? 'Following device setting' : `Always ${theme} mode`}
              </Typography>
            </div>
            <div className="seg-ctrl">
              {THEME_OPTIONS.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  className={`seg-btn flex items-center gap-1.5 px-3 h-8 ${theme === value ? 'active' : ''}`}
                  onClick={() => setTheme(value)}
                >
                  <Icon />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Password */}
        <Card className="p-5 flex flex-col gap-4 border-none bg-[var(--paper-2)]/50">
          <Typography variant="mono" className="mb-1 block opacity-60">Security</Typography>

          <Input
            label="New Password"
            type="password"
            value={newPw}
            onChange={(e) => { setNewPw(e.target.value); setPwError(''); setPwSaved(false); }}
            placeholder="Min. 8 characters"
          />

          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPw}
            onChange={(e) => { setConfirmPw(e.target.value); setPwError(''); setPwSaved(false); }}
            placeholder="Repeat new password"
          />

          {pwError && <Badge variant="danger" className="py-2.5 px-4 text-[10px]">{pwError}</Badge>}
          {pwSaved && <Badge variant="success" className="py-2.5 px-4 text-[10px]">Password updated successfully.</Badge>}

          <Button
            onClick={handleUpdatePassword}
            disabled={pwSaving || !newPw || !confirmPw}
            isLoading={pwSaving}
            className="h-11 mt-1 font-bold"
          >
            Update Password
          </Button>

          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-[var(--border)]" />
            <Typography variant="mono" className="text-[9px] opacity-40">OR</Typography>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>

          {resetSent ? (
            <Badge variant="info" className="py-2.5 px-4 text-[10px]">
              Check your email — reset link sent to <strong>{user?.email}</strong>.
            </Badge>
          ) : (
            <div className="flex flex-col gap-3">
              {resetError && <Badge variant="danger" className="py-2.5 px-4 text-[10px]">{resetError}</Badge>}
              <Button
                variant="ghost"
                onClick={handleResetPassword}
                isLoading={resetSending}
                className="h-11 text-xs"
              >
                Send Reset Link via Email
              </Button>
            </div>
          )}
        </Card>

        {/* Sign Out */}
        <Button
          variant="danger"
          onClick={handleLogout}
          className="h-12 font-bold shadow-sm bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)]/10 hover:bg-[var(--danger)] hover:text-white transition-all"
          leftIcon={(
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
          )}
        >
          Sign Out
        </Button>

        {/* Version */}
        <div className="text-center py-4">
          <Typography variant="mono" className="text-[9px] opacity-30">
            Version {__APP_VERSION__}
          </Typography>
        </div>

      </div>
    </div>
  );
}
