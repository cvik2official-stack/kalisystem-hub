import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // FIX: Replaced constructor with a class property for state initialization.
  // This is a modern and common pattern in React that is more concise and helps avoid potential issues with 'this' context.
  // This change resolves the type errors where 'state' and 'props' were not found on the component instance.
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center text-center text-gray-200">
            <div className="bg-gray-800 p-8 rounded-lg shadow-2xl max-w-lg mx-4">
                <h1 className="text-2xl font-bold text-red-500 mb-4">Something went wrong.</h1>
                <p className="text-gray-300 mb-6">An unexpected error has occurred. Please try refreshing the page or clearing your local storage if the problem persists.</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Refresh Page
                </button>
                <details className="text-left bg-gray-900/50 p-3 rounded mt-6">
                    <summary className="cursor-pointer text-gray-400 text-sm">Error Details</summary>
                    <pre className="text-xs text-red-400 mt-2 overflow-auto whitespace-pre-wrap">
                        {this.state.error?.toString()}
                    </pre>
                </details>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
