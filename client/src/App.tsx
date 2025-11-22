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
import { AnimatePresence, motion } from 'framer-motion';
import { setErrorNotificationHandler } from '@/api/error-notification';
import Canvas from './pages/protected/Canvas';
import Dashboard from './pages/protected/Dashboard';
import SignUp from './pages/guest/SignUp';
import SignIn from './pages/guest/SignIn';
import ProtectedRoute from './components/atoms/ProtectedRoute';
import DashboardLayout from './components/atoms/DashboardLayout';
import Studio from './pages/protected/Studio';
import HeadlessRasterizerView from './pages/protected/HeadlessRasterizerView';
import Messages from './pages/protected/Messages';
import PluginListing from './pages/protected/PluginListing';
import AnalysisConfigsListing from './pages/protected/AnalysisConfigsListing';
import PageWrapper from '@/components/atoms/animations/PageWrapper';
import GlobalTransitionOverlay from '@/components/atoms/animations/GlobalTransitionOverlay';
import Loader from '@/components/atoms/Loader';
import LoadingShimmer from '@/components/atoms/animations/LoadingShimmer';
import ToastContainer from '@/components/atoms/ToastContainer';
import useAuthStore from '@/stores/authentication';
import useToast from '@/hooks/ui/use-toast';
import TrajectoriesListing from './pages/protected/TrajectoriesListing';
import AccountSettings from './pages/protected/AccountSettings';
import TeamInvitationPage from './pages/guest/TeamInvitationPage';
import Clusters from './pages/protected/Clusters';

const AuthLoadingOverlay = () => (
    <motion.div
        key='global-auth-loader'
        initial={{ opacity: 0 }}
        animate={{
            opacity: 1,
            transition: { duration: 0.3, ease: 'easeInOut' }
        }}
        exit={{
            opacity: 0,
            transition: { duration: 0.5, ease: 'easeInOut' }
        }}
        style={{
            // TODO: CSS
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100dvh',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--glass-bg)',
        }}
    >
        <Loader scale={0.7} />
    </motion.div>
);

const App = () => {
    const location = useLocation();
    const isLoading = useAuthStore((state) => state.isLoading);
    const { showError } = useToast();

    // Setup error notification handler for API errors
    useMemo(() => {
        setErrorNotificationHandler((message: string) => {
            showError(message);
        });
    }, [showError]);

    const isDesktop = typeof window !== 'undefined' ? window.innerWidth > 768 : true;
    const containerStyle = useMemo(() => ({
        position: 'relative' as const,
        width: '100%',
        height: isDesktop ? '100dvh' : undefined,
        minHeight: isDesktop ? undefined : '100svh',
        overflowX: 'hidden' as const,
        overflowY: isDesktop ? 'hidden' as const : 'auto' as const,
    backgroundColor: 'var(--color-bg)',
        scrollBehavior: 'smooth' as const,
        isolation: 'isolate' as const,
    }), [isDesktop]);

    const handleExitComplete = () => {
        if(typeof window !== 'undefined'){
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
            document.body.style.transform = '';
        }
    };

    return (
        <div style={containerStyle}>
            <AnimatePresence>
                {isLoading && <AuthLoadingOverlay />}
            </AnimatePresence>
            
            <GlobalTransitionOverlay />
            <LoadingShimmer />
            <ToastContainer />
            
            <AnimatePresence
                mode='wait'
                initial={false}
                onExitComplete={handleExitComplete}
            >
                <Routes location={location} key={location.pathname}>
                    {/* Rutas públicas para visualizar trayectorias (accesibles sin autenticación) */}
                    <Route
                        path='/canvas/:trajectoryId/'
                        element={
                            <PageWrapper>
                                <Canvas />
                            </PageWrapper>
                        }
                    />

                    <Route
                        path='/raster/:trajectoryId'
                        element={
                            <PageWrapper>
                                <HeadlessRasterizerView />
                            </PageWrapper>
                        }
                    />

                    <Route
                        path='/team-invitation/:token'
                        element={
                            <PageWrapper>
                                <TeamInvitationPage />
                            </PageWrapper>
                        }
                    />
                    
                    {/* Rutas protegidas que requieren autenticación */}
                    <Route element={<ProtectedRoute mode='protect' />}>
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
                                path='/dashboard/clusters'
                                element={
                                    <PageWrapper>
                                        <Clusters />
                                    </PageWrapper>
                                }
                            />

                            <Route
                                path='/dashboard/trajectories/list'
                                element={
                                    <PageWrapper>
                                        <TrajectoriesListing />
                                    </PageWrapper>
                                }
                            />

                            <Route
                                path='/dashboard/analysis-configs/list'
                                element={
                                    <PageWrapper>
                                        <AnalysisConfigsListing />
                                    </PageWrapper>
                                }
                            />

                            <Route
                                path='/dashboard/trajectory/:trajectoryId/plugin/:pluginId/listing/:listingKey'
                                element={
                                    <PageWrapper>
                                        <PluginListing />
                                    </PageWrapper>
                                }
                            />
                          
                            <Route
                                path='/dashboard/studio/'
                                element={
                                    <PageWrapper>
                                        <Studio />
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
                                path='/account/settings'
                                element={
                                    <PageWrapper>
                                        <AccountSettings />
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
