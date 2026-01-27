/**
 * Copyright(c) 2025, Volt Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
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
 */

import { useMemo } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { setErrorNotificationHandler } from '@/api/error-notification';
import Loader from '@/components/atoms/common/Loader';
import ToastContainer from '@/components/atoms/common/ToastContainer';
import { useAuthStore } from '@/features/auth/stores';
import useToast from '@/hooks/ui/use-toast';
import useAppInitializer from '@/hooks/core/use-app-initializer';
import { renderPublicRoutes, renderProtectedRoutes, renderGuestRoutes } from '@/app/routes';
import NotFoundRedirect from '@/components/atoms/common/NotFoundRedirect';

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

    // Initialize global app data (teams, websocket, plugins, etc.)
    // This runs once and ensures data is available regardless of which page is accessed first
    useAppInitializer();

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
        if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
            document.body.style.transform = '';
        }
    };

    return (
        <div style={containerStyle}>
            <AnimatePresence>
                {isLoading && <AuthLoadingOverlay />}
            </AnimatePresence>

            <ToastContainer />

            <AnimatePresence
                mode='wait'
                initial={false}
                onExitComplete={handleExitComplete}
            >
                <Routes location={location} key={location.pathname}>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />

                    {renderPublicRoutes()}
                    {renderProtectedRoutes()}
                    {renderGuestRoutes()}

                    <Route path="*" element={<NotFoundRedirect />} />
                </Routes>
            </AnimatePresence>
        </div>
    );
};

export default App;
