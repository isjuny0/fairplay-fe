import { Component, lazy, Suspense, useState } from 'react';
import { useLocation } from 'react-router';
import { useInteractions } from '../hooks/useInteractions.js';

function ReloadScreen() {
  const { confirmDiscard } = useInteractions();
  return (
    <div className="resource-error-state" role="alert">
      <h1>화면을 불러오지 못했습니다.</h1>
      <p>연결 상태를 확인하고 다시 불러와 주세요.</p>
      <button className="secondary-button" onClick={async () => {
        if (await confirmDiscard()) window.location.reload();
      }}>다시 불러오기</button>
    </div>
  );
}

class ScreenErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidUpdate(previousProps) {
    if (this.state.failed && previousProps.resetKey !== this.props.resetKey)
      this.setState({ failed: false });
  }
  render() { return this.state.failed ? <ReloadScreen /> : this.props.children; }
}

export default function DeferredScreen({ children, label = '화면' }) {
  const { pathname } = useLocation();
  return (
    <ScreenErrorBoundary resetKey={pathname}>
      <Suspense fallback={
        <div className="loading-placeholder" role="status" aria-label={`${label} 불러오는 중`}>
          <span>{label} 불러오는 중…</span><div aria-hidden="true" /><div aria-hidden="true" />
        </div>
      }>
        {children}
      </Suspense>
    </ScreenErrorBoundary>
  );
}

export function deferScreen(load, label) {
  const Screen = lazy(load);
  return function DeferredPage(props) {
    const [LoadedScreen] = useState(() => load.component || Screen);
    return <DeferredScreen label={label}><LoadedScreen {...props} /></DeferredScreen>;
  };
}
