import { renderPublicRoutes, renderGuestRoutes, renderProtectedRoutes } from './routes/RouteRenderer';
import { useGlobalShortcuts } from '@/shared/presentation/hooks/use-global-shortcuts';
import { usePageTracker } from '@/modules/start/hooks/use-page-tracker';
import { useRouteCleanup } from '@/shared/presentation/hooks/use-route-cleanup';
import { runErrorRecoveryCleanup } from '@/shared/utils/app-cleanup-registry';
import { ensureApplicationStoreCleanupsRegistered } from '@/shared/utils/application-store-cleanups';
import { buildErrorPath } from '@/shared/utils';
import { isElectronEnvironment } from '@/shared/utils/electron-environment';
import { notifyApiError } from '@/shared/errors/notify-api-error';
import AppToaster from '@/shared/presentation/components/AppToaster';
import DesktopShell from '@/shared/presentation/components/DesktopShell';
import ErrorBoundary from '@/shared/presentation/components/ErrorBoundary';
import GlobalErrorListener from '@/shared/presentation/components/GlobalErrorListener';
import QueryProvider from '@/shared/presentation/components/QueryProvider';
import { useCallback, useEffect } from 'react';
import { BrowserRouter, HashRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import 'sileo/styles.css';
import type { ErrorInfo } from 'react';

interface NotFoundNavigationState {
    fromNotFound: boolean;
};

const NOT_FOUND_NAVIGATION_STATE: NotFoundNavigationState = {
    fromNotFound: true
};

ensureApplicationStoreCleanupsRegistered();

const NotFoundRedirect = () => {
    const navigate = useNavigate();

    useEffect(() => {
        navigate('/dashboard', { replace: true, state: NOT_FOUND_NAVIGATION_STATE });
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
        if (notifyApiError(error)) {
            return;
        }

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

export default function App() {
    const Router = isElectronEnvironment() ? HashRouter : BrowserRouter;

    return (
        <QueryProvider>
            <Router unstable_useTransitions={false}>
                <DesktopShell>
                    <AppRoutes />
                    <AppToaster />
                </DesktopShell>
            </Router>
        </QueryProvider>
    );
}
