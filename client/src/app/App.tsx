import { renderPublicRoutes, renderGuestRoutes, renderProtectedRoutes } from './routes/RouteRenderer';
import { resolveRouteTitle } from './routes/title-resolver';
import { useGlobalShortcuts } from '@/shared/presentation/hooks/use-global-shortcuts';
import { useFallbackPageTitle } from '@/shared/presentation/hooks/use-page-title';
import { usePageScale } from '@/shared/presentation/hooks/use-page-scale';
import { usePageTracker } from '@/modules/start/hooks/use-page-tracker';
import { useRouteCleanup } from '@/shared/presentation/hooks/use-route-cleanup';
import { ErrorSurface, isApiError, normalizeError, reportError } from '@/shared/errors/core';
import { runErrorRecoveryCleanup } from '@/shared/utils/app-cleanup-registry';
import { ensureApplicationStoreCleanupsRegistered } from '@/shared/utils/application-store-cleanups';
import { buildErrorPath } from '@/shared/utils';
import { isDesktopEnvironment } from '@/shared/utils/desktop-environment';
import AppToaster from '@/shared/presentation/components/AppToaster';
import DesktopShell from '@/shared/presentation/components/DesktopShell';
import ErrorBoundary from '@/shared/presentation/components/ErrorBoundary';
import GlobalContextMenu from '@/shared/presentation/components/GlobalContextMenu';
import GlobalErrorListener from '@/shared/presentation/components/GlobalErrorListener';
import QueryProvider from '@/shared/presentation/components/QueryProvider';
import NotFoundState from '@/shared/presentation/components/NotFoundState';
import { useThemeInitialization } from '@/shared/presentation/hooks/use-theme';
import { useCallback } from 'react';
import { BrowserRouter, HashRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import 'sileo/styles.css';
import type { ErrorInfo } from 'react';

ensureApplicationStoreCleanupsRegistered();

const AppRoutes = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const routeTitle = resolveRouteTitle(location.pathname) ?? '';

    useGlobalShortcuts();
    useFallbackPageTitle(routeTitle);
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

        if (isApiError(error)) {
            reportError(error, { surface: ErrorSurface.Toast });
            runErrorRecoveryCleanup(location.pathname, '/error');
            navigate(buildErrorPath(normalizeError(error).friendlyMessage, 'render', stack ?? undefined), { replace: true });
            return;
        }

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
                    <Route path='*' element={<NotFoundState />} />
                </Routes>
            </ErrorBoundary>
        </>
    );
};

export default function App() {
    const Router = isDesktopEnvironment() ? HashRouter : BrowserRouter;
    usePageScale();
    useThemeInitialization();

    return (
        <QueryProvider>
            <Router unstable_useTransitions={false}>
                <DesktopShell>
                    <GlobalContextMenu>
                        <AppRoutes />
                        <AppToaster />
                    </GlobalContextMenu>
                </DesktopShell>
            </Router>
        </QueryProvider>
    );
}
