import { useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import type { ErrorInfo } from 'react';
import { renderPublicRoutes, renderGuestRoutes, renderProtectedRoutes } from './routes/RouteRenderer';
import ErrorBoundary from '@/shared/presentation/components/ErrorBoundary';
import GlobalErrorListener from '@/shared/presentation/components/GlobalErrorListener';
import QueryProvider from '@/shared/presentation/components/QueryProvider';
import { buildErrorPath } from '@/shared/utils';
import { Toaster } from 'sileo';
import { useGlobalShortcuts } from '@/shared/presentation/hooks/use-global-shortcuts';
import { usePageTracker } from '@/modules/start/hooks/use-page-tracker';
import { useRouteCleanup } from '@/shared/presentation/hooks/use-route-cleanup';
import { ensureApplicationStoreCleanupsRegistered } from '@/shared/utils/application-store-cleanups';
import { runErrorRecoveryCleanup } from '@/shared/utils/app-cleanup-registry';
import 'sileo/styles.css';

ensureApplicationStoreCleanupsRegistered();

const NotFoundRedirect = () => {
    const navigate = useNavigate();

    useEffect(() => {
        navigate('/dashboard', { replace: true, state: { fromNotFound: true } });
    }, [navigate]);

    return null;
};

const AppRoutes = () => {
    const location = useLocation();
    const navigate = useNavigate();

    useGlobalShortcuts();
    usePageTracker();
    useRouteCleanup({
        shouldCleanup: (previousPathname, nextPathname) => {
            if (previousPathname.startsWith('/dashboard') && nextPathname.startsWith('/dashboard')) {
                return false;
            }

            return true;
        }
    });

    const handleRenderError = useCallback((error: Error, info: ErrorInfo) => {
        const stack = info.componentStack ?? error.stack;
        runErrorRecoveryCleanup(location.pathname, '/error');
        navigate(buildErrorPath(error.message, 'render', stack ?? undefined), { replace: true });
    }, [location.pathname, navigate]);

    return (
        <>
            <GlobalErrorListener />
            <ErrorBoundary onError={handleRenderError}>
                <Routes>
                    {renderPublicRoutes()}
                    {renderGuestRoutes()}
                    {renderProtectedRoutes()}
                    <Route path='*' element={<NotFoundRedirect />} />
                </Routes>
            </ErrorBoundary>
        </>
    );
};

const App = () => {
    return (
        <QueryProvider>
            <BrowserRouter>
                <AppRoutes />
                <Toaster
                    position="bottom-right"
                    theme="light"
                    options={{
                        fill: '#171717'
                    }}
                />
            </BrowserRouter>
        </QueryProvider>
    );
};

export default App;
