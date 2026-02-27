import { useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import type { ErrorInfo } from 'react';
import { renderPublicRoutes, renderGuestRoutes, renderProtectedRoutes } from './routes/RouteRenderer';
import ErrorBoundary from '@/shared/presentation/components/ErrorBoundary';
import GlobalErrorListener from '@/shared/presentation/components/GlobalErrorListener';
import { buildErrorPath } from '@/shared/utils';

const AppRoutes = () => {
    const navigate = useNavigate();

    const handleRenderError = useCallback((error: Error, info: ErrorInfo) => {
        const stack = info.componentStack ?? error.stack;
        navigate(buildErrorPath(error.message, 'render', stack ?? undefined), { replace: true });
    }, [navigate]);

    return (
        <>
            <GlobalErrorListener />
            <ErrorBoundary onError={handleRenderError}>
                <Routes>
                    {renderPublicRoutes()}
                    {renderGuestRoutes()}
                    {renderProtectedRoutes()}
                    <Route path='*' element={<div>404</div>} />
                </Routes>
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
