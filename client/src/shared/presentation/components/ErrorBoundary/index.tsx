import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface ErrorBoundaryProps{
    children: ReactNode;
    onError: (error: Error, info: ErrorInfo) => void;
};

interface ErrorBoundaryState{
    hasError: boolean;
};

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState>{
    constructor(props: ErrorBoundaryProps){
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(): ErrorBoundaryState{
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void{
        this.props.onError(error, info);
    }

    render(){
        if(this.state.hasError){
            // Reset so the error page itself can render normally
            this.setState({ hasError: false });
            return null;
        }

        return this.props.children;
    }
};

export default ErrorBoundary;
