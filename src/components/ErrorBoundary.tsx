import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: "" };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("ErrorBoundary caught:", error, errorInfo);
    this.setState({ errorInfo: errorInfo.componentStack || "" });
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: "" });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-gray-100 dark:bg-gray-900">
          <div className="max-w-xl w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 space-y-4">
            <h1 className="text-xl font-bold text-red-600 dark:text-red-400">
              Something went wrong
            </h1>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <p className="font-medium mb-2">Error:</p>
              <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded-lg overflow-auto text-xs max-h-32">
                {this.state.error?.message || "Unknown error"}
              </pre>
            </div>
            {this.state.errorInfo ? (
              <div className="text-sm text-gray-700 dark:text-gray-300">
                <p className="font-medium mb-2">Component Stack:</p>
                <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded-lg overflow-auto text-xs max-h-48">
                  {this.state.errorInfo}
                </pre>
              </div>
            ) : null}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
