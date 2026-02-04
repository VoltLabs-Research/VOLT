import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { renderPublicRoutes, renderGuestRoutes, renderProtectedRoutes } from './routes/RouteRenderer';

const AppRoutes = () => {
    const location = useLocation();

    return (
        <AnimatePresence mode='wait' initial={false}>
            <Routes location={location} key={location.pathname}>
                {renderPublicRoutes()}
                {renderGuestRoutes()}
                {renderProtectedRoutes()}
                <Route path='*' element={<div>404</div>} />
            </Routes>
        </AnimatePresence>
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
