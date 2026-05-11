import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWorkoutStore } from '../store/store';

const NAV_ROUTES = ['/dashboard', '/progress', '/settings'];

const HomeIcon = ({ active }: { active: boolean }) => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={active ? 2.2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const ChartIcon = ({ active }: { active: boolean }) => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={active ? 2.2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);

const UserIcon = ({ active }: { active: boolean }) => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={active ? 2.2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { sessionId, syncPending } = useWorkoutStore();

  const NAV_ITEMS = [
    { path: '/dashboard', label: t('nav.home'),     Icon: HomeIcon  },
    { path: '/progress',  label: t('nav.progress'), Icon: ChartIcon },
    { path: '/settings',  label: t('nav.profile'),  Icon: UserIcon  },
  ];

  const isNavRoute = NAV_ROUTES.some((r) => location.pathname === r);
  if (!isNavRoute) return null;
  if (sessionId && !syncPending) return null;

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {NAV_ITEMS.map(({ path, label, Icon }) => {
        const active = location.pathname === path;
        return (
          <button
            key={path}
            className={`nav-item${active ? ' active' : ''}`}
            onClick={() => navigate(path)}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
          >
            <Icon active={active} />
            <span className="nav-item-label">{label}</span>
            {active && <span className="nav-item-dot" aria-hidden />}
          </button>
        );
      })}
    </nav>
  );
}
