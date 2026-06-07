import { Button, Row, Stack, Heading, Text } from '@voltstack/bravais';
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
                <Row justify='center' width='max' height='max' p='2'>
                    <Stack align='center' textAlign='center' gap='1-5' role='alert' aria-live='assertive'>
                        <Row justify='center'>
                            <AlertTriangle size={28} aria-hidden='true' />
                        </Row>
                        <Stack gap='05' align='center'>
                            <Heading level={2} size='lg' weight='bold'>
                                {this.props.fallbackTitle ?? 'Something went wrong'}
                            </Heading>
                            <Text as='p' size='md' tone='secondary' lineHeight='5'>
                                {this.props.fallbackDescription ?? 'The interface hit an unexpected issue. Try again or reload the page.'}
                            </Text>
                            {this.state.error?.message && (
                                <Text as='p' size='sm' tone='muted' lineHeight='5'>
                                    {this.state.error.message}
                                </Text>
                            )}
                        </Stack>
                        <Row gap='075'>
                            <Button variant='ghost' intent='neutral' size='sm' onClick={this.handleReset}>
                                Try again
                            </Button>
                            <Button variant='solid' intent='brand' size='sm' onClick={this.handleReload}>
                                Reload page
                            </Button>
                        </Row>
                    </Stack>
                </Row>
            );
        }

        return this.props.children;
    }
};

export default ErrorBoundary;
