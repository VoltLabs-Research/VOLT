import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { buildErrorPath, shouldIgnoreError, isErrorPage } from '@/shared/utils';

/**
 * Mounted inside the Router so it can use `useNavigate`.
 * Attaches window `error` and `unhandledrejection` listeners
 * and navigates to /error with the error details as URL params.
 */
const GlobalErrorListener = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const navigatingRef = useRef(false);

    const navigateToError = (message: string, source: 'window' | 'promise', stack?: string) => {
        if(shouldIgnoreError(message)) return;
        if(isErrorPage(location.pathname)) return;
        if(navigatingRef.current) return;

        navigatingRef.current = true;
        navigate(buildErrorPath(message, source, stack), { replace: true });

        requestAnimationFrame(() => {
            navigatingRef.current = false;
        });
    };

    useEffect(() => {
        const onError = (event: ErrorEvent) => {
            navigateToError(
                event.message || 'Uncaught error',
                'window',
                event.error?.stack
            );
        };

        const onRejection = (event: PromiseRejectionEvent) => {
            const reason = event.reason;
            const message = reason instanceof Error
                ? reason.message
                : typeof reason === 'string' ? reason : 'Unhandled promise rejection';
            const stack = reason instanceof Error ? reason.stack : undefined;

            navigateToError(message, 'promise', stack);
        };

        window.addEventListener('error', onError);
        window.addEventListener('unhandledrejection', onRejection);
        return () => {
            window.removeEventListener('error', onError);
            window.removeEventListener('unhandledrejection', onRejection);
        };
    });

    return null;
};

export default GlobalErrorListener;
