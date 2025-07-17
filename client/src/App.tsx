import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Canva from './pages/protected/Canva';
import Dashboard from './pages/protected/Dashboard';

const App = () => {
    
    return (
        <Routes>
            <Route path='/canva' element={<Canva />} />
            <Route path='/dashboard' element={<Dashboard />} />
        </Routes>
    );
};

export default App;
