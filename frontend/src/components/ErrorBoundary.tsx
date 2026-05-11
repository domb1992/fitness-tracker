import { Component, ErrorInfo, ReactNode } from 'react';
import i18n from '../i18n';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100dvh', background: 'var(--paper)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: 24, textAlign: 'center',
        }}>
          <div className="mono-tag" style={{ marginBottom: 12 }}>{i18n.t('errors.somethingWrong')}</div>
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--ink)' }}>
            {this.state.error.message || 'Unknown error'}
          </p>
          <pre style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 24, maxWidth: 340, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', textAlign: 'left', background: 'var(--paper-2)', padding: 12, borderRadius: 8, border: '1px solid var(--hair)' }}>
            {this.state.error.stack?.split('\n').slice(0, 6).join('\n')}
          </pre>
          <button
            onClick={() => { this.setState({ error: null }); window.location.href = '/dashboard'; }}
            className="block-btn"
            style={{ width: 'auto', padding: '0 24px', height: 44, fontSize: 14 }}
          >
            {i18n.t('errors.backToDashboard')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
