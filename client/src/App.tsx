import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Canva from './pages/protected/Canva';
import Dashboard from './pages/protected/Dashboard';
import SignUp from './pages/guest/SignUp';
import SignIn from './pages/guest/SignIn';
import ProtectedRoute from './components/atoms/ProtectedRoute';
import DashboardLayout from './components/atoms/DashboardLayout';
import SharedWithMe from './pages/protected/SharedWithMe';
import Tutorials from './pages/protected/Tutorials';
import Simulations from './pages/protected/Simulations';

const App = () => {

    return (
        <Routes>
            <Route element={<ProtectedRoute mode='protect' />}>
                <Route path='/canva' element={<Canva />} />
                <Route element={<DashboardLayout />}>
                    <Route path='/dashboard' element={<Dashboard />} />
                    <Route path='/dashboard/shared-with-me/' element={<SharedWithMe />} />
                    <Route path='/dashboard/simulations/' element={<Simulations />} />
                    <Route path='/dashboard/tutorials/' element={<Tutorials />} />

                </Route>
            </Route>

            <Route element={<ProtectedRoute mode='guest' />}>
                <Route path='/auth/sign-up' element={<SignUp />} />
                <Route path='/auth/sign-in' element={<SignIn />} />
            </Route>
        </Routes>
    );
};

export default App;
