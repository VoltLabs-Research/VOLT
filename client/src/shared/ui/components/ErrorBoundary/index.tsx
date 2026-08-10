import { Button } from '@heroui/react';
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
                <div className='flex flex-row items-center justify-center p-8 w-full h-full'>
                    <div className='flex flex-col items-center gap-6 text-center' role='alert' aria-live='assertive'>
                        <div className='flex flex-row items-center justify-center'>
                            <AlertTriangle size={28} aria-hidden='true' />
                        </div>
                        <div className='flex flex-col items-center gap-2'>
                            <h2 className='text-base font-semibold text-foreground'>
                                {this.props.fallbackTitle ?? 'Something went wrong'}
                            </h2>
                            <p className='text-sm text-muted leading-normal'>
                                {this.props.fallbackDescription ?? 'The interface hit an unexpected issue. Try again or reload the page.'}
                            </p>
                            {this.state.error?.message && (
                                <p className='text-xs text-muted leading-normal'>
                                    {this.state.error.message}
                                </p>
                            )}
                        </div>
                        <div className='flex flex-row items-center gap-3'>
                            <Button variant='ghost' size='sm' onPress={this.handleReset}>
                                Try again
                            </Button>
                            <Button variant='primary' size='sm' onPress={this.handleReload}>
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
