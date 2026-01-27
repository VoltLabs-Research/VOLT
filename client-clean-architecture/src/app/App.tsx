import { useEffect, useMemo } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { setErrorNotificationHandler } from '@/shared/infrastructure/api/error-notification';
import Loader from '@/shared/presentation/components/atoms/common/Loader';
import ToastContainer from '@/shared/presentation/components/atoms/common/ToastContainer';
import { useAuthStore } from '@/modules/auth/presentation/stores';
import useToast from '@/shared/presentation/hooks/ui/use-toast';
import useAppInitializer from '@/shared/presentation/hooks/core/use-app-initializer';
import { renderPublicRoutes, renderProtectedRoutes, renderGuestRoutes } from '@/app/routes';
import NotFoundRedirect from '@/shared/presentation/components/atoms/common/NotFoundRedirect';

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
    useAppInitializer();

    // Setup error notification handler for API errors
    useEffect(() => {
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
