import Button from '@/shared/presentation/primitives/Button';
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
    children: ReactNode;
    onError?: (error: Error, info: ErrorInfo) => void;
    fallbackTitle?: string;
    fallbackDescription?: string;
};

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
};

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null
        };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return {
            hasError: true,
            error
        };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        this.props.onError?.(error, info);
    }

    handleReload = (): void => {
        window.location.reload();
    };

    handleReset = (): void => {
        this.setState({
            hasError: false,
            error: null
        });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className='d-flex items-center content-center w-max h-max p-2'>
                    <div className='d-flex column items-center text-center gap-1-5' role='alert' aria-live='assertive'>
                        <div className='d-flex items-center content-center'>
                            <AlertTriangle size={28} aria-hidden='true' />
                        </div>
                        <div className='d-flex column gap-05 items-center'>
                            <h2 className='font-size-3 font-weight-6 color-primary'>
                                {this.props.fallbackTitle ?? 'Something went wrong'}
                            </h2>
                            <p className='font-size-2 color-secondary line-height-5'>
                                {this.props.fallbackDescription ?? 'The interface hit an unexpected issue. Try again or reload the page.'}
                            </p>
                            {this.state.error?.message && (
                                <p className='font-size-1 color-muted line-height-5'>
                                    {this.state.error.message}
                                </p>
                            )}
                        </div>
                        <div className='d-flex items-center gap-075'>
                            <Button variant='ghost' intent='neutral' size='sm' onClick={this.handleReset}>
                                Try again
                            </Button>
                            <Button variant='solid' intent='brand' size='sm' onClick={this.handleReload}>
                                Reload page
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
};

export default ErrorBoundary;
