import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Canva from './pages/protected/Canva';

const App = () => {
    
    return (
        <Routes>
            <Route path='/canva' element={<Canva />} />
        </Routes>
    );
};

export default App;
