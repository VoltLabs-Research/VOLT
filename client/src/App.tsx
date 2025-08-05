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

import { useMemo } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Canvas from './pages/protected/Canvas';
import Dashboard from './pages/protected/Dashboard';
import SignUp from './pages/guest/SignUp';
import SignIn from './pages/guest/SignIn';
import ProtectedRoute from './components/atoms/ProtectedRoute';
import DashboardLayout from './components/atoms/DashboardLayout';
import SharedWithMe from './pages/protected/SharedWithMe';
import Tutorials from './pages/protected/Tutorials';
import Messages from './pages/protected/Messages';

import PageWrapper from '@/components/atoms/animations/PageWrapper';
import GlobalTransitionOverlay from '@/components/atoms/animations/GlobalTransitionOverlay';
import LoadingShimmer from '@/components/atoms/animations/LoadingShimmer';

const App = () => {
    const location = useLocation();

    const containerStyle = useMemo(() => ({
        position: 'relative' as const,
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #fafafa 0%, #ffffff 100%)',
        scrollBehavior: 'smooth' as const,
        isolation: 'isolate' as const,
    }), []);

    const handleExitComplete = () => {
        if(typeof window !== 'undefined'){
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            document.body.style.transform = '';
        }
    };

    return (
        <div style={containerStyle}>
            <AnimatePresence
                mode='wait'
                initial={false}
                onExitComplete={handleExitComplete}
            >
                <GlobalTransitionOverlay key={`overlay-${location.pathname}`} />
                <LoadingShimmer key={`shimmer-${location.pathname}`} />

                <Routes location={location} key={location.pathname}>
                    <Route element={<ProtectedRoute mode='protect' />}>
                        <Route
                            path='/canvas/:trajectoryId/'
                            element={
                                <PageWrapper>
                                    <Canvas />
                                </PageWrapper>
                            }
                        />
                        <Route element={<DashboardLayout />}>
                            <Route
                                path='/dashboard'
                                element={
                                    <PageWrapper>
                                        <Dashboard />
                                    </PageWrapper>
                                }
                            />
                            <Route
                                path='/dashboard/shared-with-me/'
                                element={
                                    <PageWrapper>
                                        <SharedWithMe />
                                    </PageWrapper>
                                }
                            />
                            <Route
                                path='/dashboard/messages/'
                                element={
                                    <PageWrapper>
                                        <Messages />
                                    </PageWrapper>
                                }
                            />
                            <Route
                                path='/dashboard/tutorials/'
                                element={
                                    <PageWrapper>
                                        <Tutorials />
                                    </PageWrapper>
                                }
                            />
                        </Route>
                    </Route>

                    <Route element={<ProtectedRoute mode='guest' />}>
                        <Route
                            path='/auth/sign-up'
                            element={
                                <PageWrapper>
                                    <SignUp />
                                </PageWrapper>
                            }
                        />
                        <Route
                            path='/auth/sign-in'
                            element={
                                <PageWrapper>
                                    <SignIn />
                                </PageWrapper>
                            }
                        />
                    </Route>
                </Routes>
            </AnimatePresence>
        </div>
    );
};

export default App;
