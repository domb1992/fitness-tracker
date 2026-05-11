import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore, useThemeStore, useUIStore, ThemeChoice } from '../store/store';
import { supabase } from '../lib/supabase';
import { Button, Input, Badge } from '../components/ui';
import { ApexMark } from '../components/ApexMark';
import type { SupportedLocale } from '../i18n';

declare const __APP_VERSION__: string;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      margin: '0 0 14px',
      fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: 'var(--ink-4)', fontWeight: 600,
    }}>
      {children}
    </p>
  );
}

const LOCALE_OPTIONS: { value: SupportedLocale; flag: string }[] = [
  { value: 'en', flag: '🇬🇧' },
  { value: 'de', flag: '🇩🇪' },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, signOut, updateName } = useAuthStore();
  const { theme, setTheme }           = useThemeStore();
  const { locale, setLocalePreference } = useUIStore();

  const THEME_OPTIONS: { value: ThemeChoice; label: string; icon: React.ReactNode }[] = [
    {
      value: 'light', label: t('settings.themeLight'),
      icon: (
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <circle cx="12" cy="12" r="5"/>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </svg>
      ),
    },
    {
      value: 'dark', label: t('settings.themeDark'),
      icon: (
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      ),
    },
    {
      value: 'system', label: t('settings.themeAuto'),
      icon: (
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <path d="M8 21h8M12 17v4"/>
        </svg>
      ),
    },
  ];

  const [name,             setName]             = useState(user?.name || '');
  const [email,            setEmail]            = useState(user?.email || '');
  const [profileSaving,    setProfileSaving]    = useState(false);
  const [profileSaved,     setProfileSaved]     = useState(false);
  const [profileError,     setProfileError]     = useState('');
  const [emailConfirmSent, setEmailConfirmSent] = useState(false);

  const [newPw,    setNewPw]    = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved,  setPwSaved]  = useState(false);
  const [pwError,  setPwError]  = useState('');

  const [resetSending, setResetSending] = useState(false);
  const [resetSent,    setResetSent]    = useState(false);
  const [resetError,   setResetError]   = useState('');

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
    if (newPw !== confirmPw) { setPwError(t('settings.passwordMismatch')); return; }
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
    <div className="ft-screen animate-fade-in" style={{ paddingBottom: 'calc(var(--nav-safe) + 24px)' }}>

      {/* Header */}
      <div style={{ padding: '20px 20px 20px' }}>
        <p style={{
          margin: '0 0 3px', fontFamily: 'var(--mono)', fontSize: 9,
          letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-4)',
        }}>
          {t('settings.pageLabel')}
        </p>
        <h1 style={{
          margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em',
          lineHeight: 1.1, color: 'var(--ink)',
        }}>
          {t('settings.heading')}
        </h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 20px' }}>

        {/* Profile */}
        <div className="surface" style={{ padding: '18px 18px' }}>
          <SectionLabel>{t('settings.profile')}</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input
              label={t('settings.name')}
              value={name}
              onChange={(e) => { setName(e.target.value); setProfileSaved(false); }}
              placeholder={t('settings.namePlaceholder')}
            />
            <Input
              label={t('settings.emailAddress')}
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setProfileSaved(false); setEmailConfirmSent(false); }}
              placeholder={t('settings.emailPlaceholder')}
            />
            {emailConfirmSent && (
              <Badge variant="info" className="py-2.5 px-4 text-[10px]">
                {t('settings.confirmSent', { email: email.trim().toLowerCase() })}
              </Badge>
            )}
            {profileError && (
              <Badge variant="danger" className="py-2.5 px-4 text-[10px]">{profileError}</Badge>
            )}
            <Button
              onClick={handleSaveProfile}
              disabled={profileSaving || !profileChanged}
              isLoading={profileSaving}
              className="h-11 mt-1"
              rightIcon={profileSaved && !profileSaving && (
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              )}
            >
              {profileSaved ? t('settings.saved') : t('settings.saveProfile')}
            </Button>
          </div>
        </div>

        {/* Appearance */}
        <div className="surface" style={{ padding: '18px 18px' }}>
          <SectionLabel>{t('settings.appearance')}</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
                {t('settings.theme')}
              </div>
              <div style={{
                marginTop: 3, fontFamily: 'var(--mono)', fontSize: 9,
                letterSpacing: '0.04em', color: 'var(--ink-4)',
              }}>
                {theme === 'system'
                  ? t('settings.themeFollowDevice')
                  : t('settings.themeAlways', { theme: theme === 'light' ? t('settings.themeLight').toLowerCase() : t('settings.themeDark').toLowerCase() })}
              </div>
            </div>
            <div className="seg-ctrl">
              {THEME_OPTIONS.map(({ value, label, icon }) => (
                <button
                  key={value}
                  className={`seg-btn flex items-center gap-1.5 px-3 h-8 ${theme === value ? 'active' : ''}`}
                  onClick={() => setTheme(value)}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Language */}
        <div className="surface" style={{ padding: '18px 18px' }}>
          <SectionLabel>{t('settings.language')}</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
                {t('settings.languageLabel')}
              </div>
              <div style={{
                marginTop: 3, fontFamily: 'var(--mono)', fontSize: 9,
                letterSpacing: '0.04em', color: 'var(--ink-4)',
              }}>
                {t('settings.languageDesc')}
              </div>
            </div>
            <div className="seg-ctrl">
              {LOCALE_OPTIONS.map(({ value, flag }) => (
                <button
                  key={value}
                  className={`seg-btn flex items-center gap-1.5 px-3 h-8 ${locale === value ? 'active' : ''}`}
                  onClick={() => setLocalePreference(value)}
                >
                  <span style={{ fontSize: 14, lineHeight: 1 }}>{flag}</span>
                  {value === 'en' ? t('settings.english') : t('settings.german')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="surface" style={{ padding: '18px 18px' }}>
          <SectionLabel>{t('settings.security')}</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input
              label={t('settings.newPassword')}
              type="password"
              value={newPw}
              onChange={(e) => { setNewPw(e.target.value); setPwError(''); setPwSaved(false); }}
              placeholder={t('settings.newPasswordPlaceholder')}
            />
            <Input
              label={t('settings.confirmNewPassword')}
              type="password"
              value={confirmPw}
              onChange={(e) => { setConfirmPw(e.target.value); setPwError(''); setPwSaved(false); }}
              placeholder={t('settings.confirmPasswordPlaceholder')}
            />
            {pwError && (
              <Badge variant="danger" className="py-2.5 px-4 text-[10px]">{pwError}</Badge>
            )}
            {pwSaved && (
              <Badge variant="success" className="py-2.5 px-4 text-[10px]">{t('settings.passwordUpdated')}</Badge>
            )}
            <Button
              onClick={handleUpdatePassword}
              disabled={pwSaving || !newPw || !confirmPw}
              isLoading={pwSaving}
              className="h-11"
            >
              {t('settings.updatePassword')}
            </Button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.06em',
                color: 'var(--ink-4)', opacity: 0.5,
              }}>{t('common.or')}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            {resetSent ? (
              <Badge variant="info" className="py-2.5 px-4 text-[10px]">
                {t('settings.resetSent', { email: user?.email })}
              </Badge>
            ) : (
              <>
                {resetError && (
                  <Badge variant="danger" className="py-2.5 px-4 text-[10px]">{resetError}</Badge>
                )}
                <Button
                  variant="ghost"
                  onClick={handleResetPassword}
                  isLoading={resetSending}
                  className="h-11 text-xs"
                >
                  {t('settings.sendResetLink')}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={handleLogout}
          style={{
            width: '100%', height: 48,
            background: 'var(--danger-soft)',
            color: 'var(--danger)',
            border: '1px solid oklch(0.54 0.22 25 / 0.15)',
            borderRadius: 'var(--r-2)',
            fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 700,
            letterSpacing: '-0.01em',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            cursor: 'pointer',
            transition: 'background var(--duration-fast) var(--ease), color var(--duration-fast) var(--ease)',
          }}
          className="hover:bg-[var(--danger)] hover:text-white active:scale-[0.98]"
        >
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
          </svg>
          {t('settings.signOut')}
        </button>

        {/* Version */}
        <div style={{ textAlign: 'center', paddingBottom: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, opacity: 0.35 }}>
            <ApexMark size={13} color="var(--ink)" accentColor="var(--lime)" />
            <span style={{
              fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 13,
              letterSpacing: '-0.04em', color: 'var(--ink)', lineHeight: 1,
            }}>
              Fit<span style={{ fontWeight: 300, opacity: 0.5 }}>Track</span>
            </span>
          </div>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em',
            color: 'var(--ink-4)', opacity: 0.4, textTransform: 'uppercase',
          }}>
            {t('settings.version', { version: __APP_VERSION__ })}
          </span>
        </div>

      </div>
    </div>
  );
}
