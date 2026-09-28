import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error | null) => ReactNode);
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Uncaught application error:', error, errorInfo);
  }

  handleReload = (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleGoHome = (): void => {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback(this.state.error);
        }
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white text-black font-['Cairo',sans-serif] px-4 py-16 selection:bg-[#22A39E] selection:text-white">
          <div className="max-w-md w-full text-center space-y-6">
            {/* Warning Icon Badge */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-3xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shadow-2xs">
              <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12 stroke-[1.75]" />
            </div>

            {/* Error Message */}
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                حدث خطأ غير متوقع
              </h1>
              <p className="text-sm sm:text-base text-gray-600 font-medium leading-relaxed max-w-sm mx-auto">
                نعتذر عن الإزعاج. حدث خطأ أثناء تشغيل هذه الصفحة، يمكنك محاولة إعادة التحميل أو العودة للرئيسية.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#22A39E] hover:bg-[#1b8581] text-white font-extrabold text-sm shadow-xs hover:shadow-md transition-all cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>إعادة تحميل الصفحة</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#F7F7F7] hover:bg-gray-200 border border-[#E5E5E5] text-gray-800 font-bold text-sm transition-colors cursor-pointer active:scale-95"
              >
                <Home className="w-4 h-4 text-gray-500" />
                <span>العودة للرئيسية</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
