import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { renderPublicRoutes, renderGuestRoutes, renderProtectedRoutes } from './routes/RouteRenderer';

const App = () => {
    return (
        <BrowserRouter>
            <Routes>
                {renderPublicRoutes()}
                {renderGuestRoutes()}
                {renderProtectedRoutes()}
                <Route path='*' element={<div>404</div>} />
            </Routes>
        </BrowserRouter>
    );
};

export default App;
