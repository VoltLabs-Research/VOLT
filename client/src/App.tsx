import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Canva from './pages/protected/Canva';
import Dashboard from './pages/protected/Dashboard';
import SignUp from './pages/guest/SignUp';

const App = () => {
    
    return (
        <Routes>
            <Route path='/canva' element={<Canva />} />
            <Route path='/dashboard' element={<Dashboard />} />

            <Route path='/auth/sign-up' element={<SignUp />} />
        </Routes>
    );
};

export default App;
