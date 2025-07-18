import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Canva from './pages/protected/Canva';
import Dashboard from './pages/protected/Dashboard';
import SignUp from './pages/guest/SignUp';
import ProtectedRoute from './components/atoms/ProtectedRoute';

const App = () => {

    return (
        <Routes>
            <Route path='/canva' element={<Canva />} />
            <Route path='/dashboard' element={<Dashboard />} />

            <Route element={<ProtectedRoute mode='guest' />}>
                <Route path='/auth/sign-up' element={<SignUp />} />
            </Route>
        </Routes>
    );
};

export default App;
