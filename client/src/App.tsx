/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import { Routes, Route } from 'react-router-dom';
import Canvas from './pages/protected/Canvas';
import Dashboard from './pages/protected/Dashboard';
import SignUp from './pages/guest/SignUp';
import SignIn from './pages/guest/SignIn';
import ProtectedRoute from './components/atoms/ProtectedRoute';
import DashboardLayout from './components/atoms/DashboardLayout';
import SharedWithMe from './pages/protected/SharedWithMe';
import Tutorials from './pages/protected/Tutorials';
import Messages from './pages/protected/Messages';

const App = () => {

    return (
        <Routes>
            <Route element={<ProtectedRoute mode='protect' />}>
                <Route path='/canvas/:trajectoryId/' element={<Canvas />} />
                <Route element={<DashboardLayout />}>
                    <Route path='/dashboard' element={<Dashboard />} />
                    <Route path='/dashboard/shared-with-me/' element={<SharedWithMe />} />
                    <Route path='/dashboard/messages/' element={<Messages />} />
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
