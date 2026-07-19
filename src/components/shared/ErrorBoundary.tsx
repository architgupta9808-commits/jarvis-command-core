import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Rendered when the subtree throws. Receives a reset callback. */
  fallback: (reset: () => void, error: Error | null) => ReactNode;
}

interface State {
  error: Error | null;
}

/** Contains render-time crashes so one failing subsystem never blanks the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[JARVIS] Contained subsystem failure:', error);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) return this.props.fallback(this.reset, this.state.error);
    return this.props.children;
  }
}
