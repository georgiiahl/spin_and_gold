import { Component, ErrorInfo, ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-4xl">⚠️</p>
          <h1 className="text-xl font-bold">Something went wrong</h1>
          <p className="text-sm text-gray-600">
            The app could not load its local data. This can happen in private/incognito mode or
            when browser storage is full.
          </p>
          <p className="text-xs text-gray-400 break-all">{this.state.error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
