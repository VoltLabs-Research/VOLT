import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Canva from './pages/protected/Canva';
import Dashboard from './pages/protected/Dashboard';
import SignUp from './pages/guest/SignUp';
import SignIn from './pages/guest/SignIn';
import ProtectedRoute from './components/atoms/ProtectedRoute';

const App = () => {

    return (
        <Routes>
            <Route element={<ProtectedRoute mode='protect' />}>
                <Route path='/canva' element={<Canva />} />
                <Route path='/dashboard' element={<Dashboard />} />
            </Route>

            <Route element={<ProtectedRoute mode='guest' />}>
                <Route path='/auth/sign-up' element={<SignUp />} />
                <Route path='/auth/sign-in' element={<SignIn />} />
            </Route>
        </Routes>
    );
};

export default App;
