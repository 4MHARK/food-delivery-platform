import { Component } from "react";
import * as Sentry from "@sentry/react";

// Catches any uncaught render/lifecycle error in the tree below and shows a
// friendly retry screen instead of a blank white page.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  // getDerivedStateFromError only swaps in the fallback UI — it's a pure render
  // phase hook, so side effects don't belong there. componentDidCatch is the
  // commit-phase counterpart, and it's the one that actually reports.
  componentDidCatch(error, errorInfo) {
    Sentry.captureException(error, {
      contexts: { react: { componentStack: errorInfo.componentStack } },
    });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-4xl text-red-400">error_outline</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
            <p className="text-slate-500 mb-6 text-sm">
              An unexpected error occurred. Reload the page to continue.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-full bg-amber-500 px-8 py-3 font-semibold text-white hover:bg-amber-600 transition active:scale-95"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
