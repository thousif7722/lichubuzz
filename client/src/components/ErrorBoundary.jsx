import React from 'react';

/**
 * ErrorBoundary — Catches JavaScript errors anywhere in the component tree.
 * Prevents white screen of death. Shows a friendly retry UI instead.
 * Urban Company-level: no user ever sees a blank/crashed screen.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Log to console in dev; in production this would go to Sentry
    if (process.env.NODE_ENV === 'development') {
      console.error('🚨 ErrorBoundary caught:', error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
          fontFamily: "'Inter', sans-serif",
          padding: '24px',
          textAlign: 'center',
        }}>
          {/* Icon */}
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: '#FEE2E2', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 24, fontSize: 36,
          }}>
            ⚠️
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 15, color: '#6B7280', maxWidth: 360, lineHeight: 1.6, marginBottom: 32 }}>
            An unexpected error occurred. Your bookings and data are safe.
            Please try refreshing the page.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '12px 28px', borderRadius: 12, border: 'none',
                background: '#2563EB', color: '#fff', fontSize: 15,
                fontWeight: 600, cursor: 'pointer', letterSpacing: 0.3,
              }}
            >
              Try Again
            </button>
            <button
              onClick={this.handleGoHome}
              style={{
                padding: '12px 28px', borderRadius: 12,
                border: '2px solid #2563EB', background: 'transparent',
                color: '#2563EB', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Go to Home
            </button>
          </div>

          {/* Dev-only error details */}
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details style={{
              marginTop: 32, textAlign: 'left', maxWidth: 600,
              background: '#FEF2F2', borderRadius: 8, padding: 16,
              fontSize: 12, color: '#991B1B', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: 8 }}>
                🔍 Dev Error Details
              </summary>
              {this.state.error.toString()}
              {this.state.errorInfo?.componentStack}
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
