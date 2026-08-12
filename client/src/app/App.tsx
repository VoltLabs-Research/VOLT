import { renderPublicRoutes, renderGuestRoutes, renderProtectedRoutes, renderOptionalAuthRoutes } from './routes/RouteRenderer';
import { resolveConfiguredRouteTitle } from './routes/metadata';
import { reportHotspotDuration } from './core/http/utils/client-instrumentation';
import { useFallbackPageTitle } from '@/shared/ui/hooks/use-page-title';
import { useRouteCleanup } from '@/shared/ui/hooks/use-route-cleanup';
import { ErrorSurface } from '@/shared/contracts/errors';
import { getErrorMessage } from '@voltstack/voltclient';
import { isApiError, reportError } from '@/shared/errors/core/report-error';
import { runErrorRecoveryCleanup } from '@/shared/utils/app-cleanup-registry';
import { ensureApplicationStoreCleanupsRegistered } from '@/shared/utils/application-store-cleanups';
import { buildErrorPath } from '@/shared/utils/error-routing';
import AppToaster from '@/shared/ui/components/AppToaster';
import ErrorBoundary from '@/shared/ui/components/ErrorBoundary';
import GlobalContextMenu from '@/shared/ui/components/GlobalContextMenu';
import GlobalErrorListener from '@/shared/ui/components/GlobalErrorListener';
import queryClient from '@/shared/query/query-client';
import { QueryClientProvider } from '@tanstack/react-query';
import NotFoundState from '@/shared/ui/components/NotFoundState';
import EndpointGuard from '@/app/routes/EndpointGuard';
import { useThemeInitialization } from '@/shared/ui/hooks/use-theme';
import { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import 'sileo/styles.css';
import type { ErrorInfo } from 'react';
ensureApplicationStoreCleanupsRegistered();

const TARGET_DESKTOP_VIEWPORT_WIDTH = 1800;
const TARGET_DESKTOP_VIEWPORT_HEIGHT = 960;
const DESKTOP_BREAKPOINT = 1024;
const DEFAULT_ROOT_FONT_SIZE = 16;
const MINIMUM_PAGE_SCALE = 0.75;

const shouldMountWorkspaceGlobals = (pathname: string): boolean => {
    return pathname !== '/error' && pathname !== '/connect' && !pathname.startsWith('/auth/');
};

const getPageScale = () => {
    if (window.innerWidth < DESKTOP_BREAKPOINT) {
        return 1;
    }

    const scale = Math.min(
        window.innerWidth / TARGET_DESKTOP_VIEWPORT_WIDTH,
        window.innerHeight / TARGET_DESKTOP_VIEWPORT_HEIGHT,
        1
    );

    return Number.isFinite(scale) ? Math.max(scale, MINIMUM_PAGE_SCALE) : 1;
};

const syncPageScale = () => {
    const pageScale = getPageScale();
    document.documentElement.style.setProperty('--volt-root-font-size', `${(DEFAULT_ROOT_FONT_SIZE * pageScale).toFixed(2)}px`);
};

const resetPageScale = () => {
    document.documentElement.style.removeProperty('--volt-root-font-size');
};

const AppChrome = () => {
    const location = useLocation();
    const shouldMountGlobals = shouldMountWorkspaceGlobals(location.pathname);

    useEffect(() => {
        const startedAt = performance.now();
        const frameId = window.requestAnimationFrame(() => {
            reportHotspotDuration('route.bootstrap', startedAt, {
                path: location.pathname
            });
        });

        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, [location.pathname]);

    const appContent = (
        <>
            <AppRoutes />
            <AppToaster />
        </>
    );

    if (!shouldMountGlobals) {
        return appContent;
    }

    return (
        <GlobalContextMenu>
            {appContent}
        </GlobalContextMenu>
    );
};

const AppRoutes = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const routeTitle = resolveConfiguredRouteTitle(location.pathname) ?? '';

    useFallbackPageTitle(routeTitle);
    useRouteCleanup({
        shouldCleanup: (previousPathname, nextPathname) => (
            !(previousPathname.startsWith('/dashboard') && nextPathname.startsWith('/dashboard'))
        )
    });

    const handleRenderError = (error: Error, info: ErrorInfo) => {
        if (isApiError(error)) {
            reportError(error, { surface: ErrorSurface.Toast });
        }

        const message = isApiError(error) ? getErrorMessage(error.code, error.message) : error.message;
        const stack = info.componentStack ?? error.stack;

        runErrorRecoveryCleanup(location.pathname, '/error');
        navigate(buildErrorPath(message, 'render', stack ?? undefined), { replace: true });
    };

    return (
        <>
            <GlobalErrorListener />
            <ErrorBoundary onError={handleRenderError}>
                <EndpointGuard>
                    <Routes>
                        {renderPublicRoutes()}
                        {renderOptionalAuthRoutes()}
                        {renderGuestRoutes()}
                        {renderProtectedRoutes()}
                        <Route path='*' element={<NotFoundState />} />
                    </Routes>
                </EndpointGuard>
            </ErrorBoundary>
        </>
    );
};

export default function App() {
    useThemeInitialization();

    useEffect(() => {
        let frameReference = 0;

        const handleResize = () => {
            if (frameReference) {
                cancelAnimationFrame(frameReference);
            }

            frameReference = window.requestAnimationFrame(() => {
                syncPageScale();
                frameReference = 0;
            });
        };

        handleResize();
        window.addEventListener('resize', handleResize);

        return () => {
            if (frameReference) {
                cancelAnimationFrame(frameReference);
            }

            window.removeEventListener('resize', handleResize);
            resetPageScale();
        };
    }, []);

    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter useTransitions={false}>
                <AppChrome />
            </BrowserRouter>
        </QueryClientProvider>
    );
}
