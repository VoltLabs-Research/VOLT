import { renderPublicRoutes, renderGuestRoutes, renderProtectedRoutes, renderOptionalAuthRoutes } from './routes/RouteRenderer';
import { resolveRouteTitle } from './routes/title-resolver';
import { reportHotspotDuration } from './core/http/utilities/client-instrumentation';
import { useGlobalShortcuts } from '@/shared/presentation/hooks/use-global-shortcuts';
import { useFallbackPageTitle } from '@/shared/presentation/hooks/use-page-title';
import { usePageTracker } from '@/modules/start/hooks/use-page-tracker';
import { useRouteCleanup } from '@/shared/presentation/hooks/use-route-cleanup';
import { ErrorSurface, getErrorMessage, isApiError, reportError } from '@/shared/errors/core';
import { runErrorRecoveryCleanup } from '@/shared/utils/app-cleanup-registry';
import { ensureApplicationStoreCleanupsRegistered } from '@/shared/utils/application-store-cleanups';
import { buildErrorPath } from '@/shared/utils';
import AppToaster from '@/shared/presentation/components/AppToaster';
import ErrorBoundary from '@/shared/presentation/components/ErrorBoundary';
import GlobalContextMenu from '@/shared/presentation/components/GlobalContextMenu';
import GlobalErrorListener from '@/shared/presentation/components/GlobalErrorListener';
import QueryProvider from '@/shared/presentation/components/QueryProvider';
import NotFoundState from '@/shared/presentation/components/NotFoundState';
import { useThemeInitialization } from '@/shared/presentation/hooks/use-theme';
import { useCallback, useEffect } from 'react';
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
    return pathname !== '/error' && !pathname.startsWith('/auth/');
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

const WorkspaceGlobals = () => {
    useGlobalShortcuts();
    usePageTracker();

    return null;
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
            {shouldMountGlobals && <WorkspaceGlobals />}
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
    const routeTitle = resolveRouteTitle(location.pathname) ?? '';

    useFallbackPageTitle(routeTitle);
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
            navigate(buildErrorPath(getErrorMessage(error.code, error.message), 'render', stack ?? undefined), { replace: true });
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
                    {renderOptionalAuthRoutes()}
                    {renderGuestRoutes()}
                    {renderProtectedRoutes()}
                    <Route path='*' element={<NotFoundState />} />
                </Routes>
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
        <QueryProvider>
            <BrowserRouter unstable_useTransitions={false}>
                <AppChrome />
            </BrowserRouter>
        </QueryProvider>
    );
}
