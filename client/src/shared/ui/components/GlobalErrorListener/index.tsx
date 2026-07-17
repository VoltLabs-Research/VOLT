import { buildErrorPath, shouldIgnoreError, isErrorPage } from '@/shared/utils/error-routing';
import { ErrorSurface, isApiError, reportError } from '@/shared/errors/core';
import { runErrorRecoveryCleanup } from '@/shared/utils/app-cleanup-registry';
import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
/**
 * Mounted inside the Router so it can use `useNavigate`.
 * Attaches window `error` and `unhandledrejection` listeners.
 * API errors are surfaced as notifications and all other uncaught errors
 * navigate to `/error` with the details encoded as URL params.
 */
const GlobalErrorListener = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const navigatingRef = useRef(false);

    const navigateToError = useCallback((message: string, source: 'window' | 'promise', stack?: string, error?: unknown) => {
        if (isApiError(error)) {
            reportError(error, { surface: ErrorSurface.Toast });
            return;
        }
        if(shouldIgnoreError(message)) return;
        if(isErrorPage(location.pathname)) return;
        if(navigatingRef.current) return;

        navigatingRef.current = true;
        runErrorRecoveryCleanup(location.pathname, '/error');
        navigate(buildErrorPath(message, source, stack), { replace: true });

        requestAnimationFrame(() => {
            navigatingRef.current = false;
        });
    }, [location.pathname, navigate]);

    useEffect(() => {
        const onError = (event: ErrorEvent) => {
            navigateToError(
                event.message || 'Uncaught error',
                'window',
                event.error?.stack,
                event.error
            );
        };

        const onRejection = (event: PromiseRejectionEvent) => {
            const reason = event.reason;
            let message = 'Unhandled promise rejection';
            let stack: string | undefined;

            if (reason instanceof Error) {
                message = reason.message;
                stack = reason.stack;
            } else if (typeof reason === 'string') {
                message = reason;
            }

            navigateToError(message, 'promise', stack, reason);
        };

        window.addEventListener('error', onError);
        window.addEventListener('unhandledrejection', onRejection);
        return () => {
            window.removeEventListener('error', onError);
            window.removeEventListener('unhandledrejection', onRejection);
        };
    }, [navigateToError]);

    return null;
};

export default GlobalErrorListener;
