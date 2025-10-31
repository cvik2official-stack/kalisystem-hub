import React, { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleRefresh = () => {
    window.location.reload();
  };
  
  private handleClearCacheAndRefresh = () => {
    localStorage.clear();
    window.location.reload();
  }

  public render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="min-h-screen bg-gray-900 text-gray-200 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl shadow-2xl p-8 max-w-lg w-full text-center border-t-4 border-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h1 className="text-2xl font-bold text-white mb-2">Application Error</h1>
            <p className="text-gray-400 mb-6">Sorry, the application has encountered a problem and cannot continue.</p>
            
            <div className="flex justify-center space-x-4">
                <button 
                    onClick={this.handleRefresh}
                    className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                    Refresh Page
                </button>
                 <button 
                    onClick={this.handleClearCacheAndRefresh}
                    className="px-4 py-2 text-sm font-medium rounded-md bg-gray-600 hover:bg-gray-500 text-white"
                >
                    Clear Data & Refresh
                </button>
            </div>

            {this.state.error && (
              <details className="mt-6 bg-gray-900 rounded-md p-3 text-left">
                <summary className="cursor-pointer text-sm text-gray-400 hover:text-white">Error Details</summary>
                <pre className="mt-2 text-xs text-red-400 whitespace-pre-wrap overflow-x-auto">
                  <code>
                    {this.state.error.toString()}
                    {'\n\n'}
                    {this.state.error.stack}
                  </code>
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    // FIX: This line was correct, but the error suggests a tooling issue. Refactoring the class to extend React.Component directly should resolve it.
    return this.props.children;
  }
}

export default ErrorBoundary;
