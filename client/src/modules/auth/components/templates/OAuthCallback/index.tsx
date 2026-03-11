import './OAuthCallback.css';
import { fetchCurrentUser } from '@/modules/auth/hooks/queries';
import { useAuthStore } from '@/modules/auth/stores/use-auth-store';
import Container from '@/shared/presentation/components/Container';
import Loader from '@/shared/presentation/components/Loader';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle } from 'lucide-react';
import { sileo } from 'sileo';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const OAuthCallbackTemplate = () => {
    const navigate = useNavigate();
    const markAuthenticated = useAuthStore((state) => state.markAuthenticated);
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const redirectTimeoutReference = useRef<ReturnType<typeof window.setTimeout> | null>(null);

    useEffect(() => {
        let isCancelled = false;

        const clearRedirectTimeout = () => {
            if (redirectTimeoutReference.current === null) {
                return;
            }

            window.clearTimeout(redirectTimeoutReference.current);
            redirectTimeoutReference.current = null;
        };

        const handleOAuthCallback = async () => {
            try{
                const params = new URLSearchParams(window.location.search);
                const token = params.get('token');

                if(!token){
                    throw new Error('No token received from OAuth provider');
                }

                markAuthenticated(token);
                await fetchCurrentUser();
                if (isCancelled) {
                    return;
                }

                setStatus('success');

                const next = params.get('next') ?? '/dashboard';
                const onboardingUrl = next === '/dashboard' ? '/onboarding' : `/onboarding?next=${encodeURIComponent(next)}`;

                redirectTimeoutReference.current = window.setTimeout(() => {
                    redirectTimeoutReference.current = null;
                    navigate(onboardingUrl);
                }, 1500);
            }catch{
                if (isCancelled) {
                    return;
                }

                sileo.error({ title: 'Authentication failed', description: 'Redirecting to login...' });
                setStatus('error');
                redirectTimeoutReference.current = window.setTimeout(() => {
                    redirectTimeoutReference.current = null;
                    navigate('/auth/sign-in?error=oauth_failed');
                }, 2000);
            }
        };

        handleOAuthCallback();

        return () => {
            isCancelled = true;
            clearRedirectTimeout();
        };
    }, [markAuthenticated, navigate]);

    return (
        <Container className='d-flex flex-center items-center oauth-callback-container p-relative vh-max overflow-hidden'>
            <Container className='p-absolute inset-0 overflow-hidden'>
                <Container className='oauth-background-blob radius-full oauth-blob-blue p-absolute w-50' />
                <Container className='oauth-background-blob radius-full oauth-blob-purple p-absolute' />
            </Container>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className='oauth-card glass-bg radius-2xl p-relative w-max text-center p-2'
            >
                <Container className='d-flex flex-center mb-1-5 oauth-status-icon'>
                    {status === 'loading' && (
                        <Loader scale={0.6} isFixed={false} />
                    )}

                    {status === 'success' && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{
                                type: 'spring',
                                stiffness: 200,
                                damping: 10
                            }}
                        >
                            <CheckCircle size={48} className='oauth-icon-success' />
                        </motion.div>
                    )}

                    {status === 'error' && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{
                                type: 'spring',
                                stiffness: 200,
                                damping: 10
                            }}
                        >
                            <XCircle size={48} className='oauth-icon-error' />
                        </motion.div>
                    )}
                </Container>

                <motion.div
                    key={status}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <Title className='oauth-title font-size-5'>
                        {status === 'loading' && 'Authenticating...'}
                        {status === 'success' && 'Successfully Authenticated!'}
                        {status === 'error' && 'Authentication Failed'}
                    </Title>
                </motion.div>

                <motion.div
                    key={`desc-${status}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                >
                    <Paragraph className='color-secondary'>
                        {status === 'loading' && 'Please wait while we verify your credentials.'}
                        {status === 'success' && 'Redirecting you to setup...'}
                        {status === 'error' && 'Something went wrong. Redirecting to login...'}
                    </Paragraph>
                </motion.div>
            </motion.div>
        </Container>
    );
};

export default OAuthCallbackTemplate;
