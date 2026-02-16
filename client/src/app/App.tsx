import { useCallback } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import type { ErrorInfo } from 'react';
import { renderPublicRoutes, renderGuestRoutes, renderProtectedRoutes } from './routes/RouteRenderer';
import ErrorBoundary from '@/shared/presentation/components/ErrorBoundary';
import GlobalErrorListener from '@/shared/presentation/components/GlobalErrorListener';
import { buildErrorPath } from '@/shared/utils';

const AppRoutes = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const handleRenderError = useCallback((error: Error, info: ErrorInfo) => {
        const stack = info.componentStack ?? error.stack;
        navigate(buildErrorPath(error.message, 'render', stack ?? undefined), { replace: true });
    }, [navigate]);

    return (
        <>
            <GlobalErrorListener />
            <ErrorBoundary onError={handleRenderError}>
                <AnimatePresence mode='wait' initial={false}>
                    <Routes location={location} key={location.pathname}>
                        {renderPublicRoutes()}
                        {renderGuestRoutes()}
                        {renderProtectedRoutes()}
                        <Route path='*' element={<div>404</div>} />
                    </Routes>
                </AnimatePresence>
            </ErrorBoundary>
        </>
    );
};

const App = () => {
    return (
        <BrowserRouter>
            <AppRoutes />
        </BrowserRouter>
    );
};

export default App;
