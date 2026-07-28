import './OAuthCallback.css';
import { fetchCurrentUser } from '@/modules/auth/hooks/queries';
import {
    clearPostAuthDestination,
    getPostAuthRedirectPath,
    resolvePostAuthDestination
} from '@/modules/auth/services/post-auth-destination-storage';
import { useAuthStore } from '@/modules/auth/store/use-auth-store';
import { resolveErrorTitle } from '@/shared/errors/core';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import { Box, Heading, Loader, Row, Text } from '@voltstack/bravais';
import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const DEFAULT_OAUTH_ERROR_MESSAGE = 'We could not complete sign in with your provider. Please try again.';

const OAuthCallbackTemplate = () => {
    const navigate = useNavigate();
    const markAuthenticated = useAuthStore((state) => state.markAuthenticated);
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [errorMessage, setErrorMessage] = useState(DEFAULT_OAUTH_ERROR_MESSAGE);
    const redirectTimeoutReference = useRef<number | null>(null);

    const params = new URLSearchParams(window.location.search);
    const next = resolvePostAuthDestination({
        queryNext: params.get('next')
    });
    const signInRedirectPath = `/auth/sign-in?${new URLSearchParams({
        error: 'oauth_failed',
        next
    }).toString()}`;

    const handleBackToSignIn = () => {
        navigate(signInRedirectPath);
    };

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

                const redirectPath = getPostAuthRedirectPath(next);

                redirectTimeoutReference.current = window.setTimeout(() => {
                    clearPostAuthDestination();
                    redirectTimeoutReference.current = null;
                    navigate(redirectPath);
                }, 1500);
            }catch(error){
                if (isCancelled) {
                    return;
                }

                setErrorMessage(resolveErrorTitle(error, DEFAULT_OAUTH_ERROR_MESSAGE));
                setStatus('error');
            }
        };

        handleOAuthCallback();

        return () => {
            isCancelled = true;
            clearRedirectTimeout();
        };
    }, [markAuthenticated, navigate]);

    if (status === 'error') {
        return (
            <Row justify='center' position='relative' height='vh-max' overflow='hidden' className='oauth-callback-container'>
                <Box position='absolute' inset='0' overflow='hidden'>
                    <Box position='absolute' radius='full' width='50' className='oauth-background-blob oauth-blob-blue' />
                    <Box position='absolute' radius='full' className='oauth-background-blob oauth-blob-purple' />
                </Box>

                <RecoveryState
                    tone={RecoveryStateTone.Error}
                    title='Authentication failed'
                    description={errorMessage}
                    retryLabel='Back to sign in'
                    onRetry={handleBackToSignIn}
                />
            </Row>
        );
    }

    return (
        <Row justify='center' position='relative' height='vh-max' overflow='hidden' className='oauth-callback-container'>
            <Box position='absolute' inset='0' overflow='hidden'>
                <Box position='absolute' radius='full' width='50' className='oauth-background-blob oauth-blob-blue' />
                <Box position='absolute' radius='full' className='oauth-background-blob oauth-blob-purple' />
            </Box>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className='oauth-card glass-bg radius-2xl p-relative w-max text-center p-2'
            >
                <Row justify='center' className='mb-1-5 oauth-status-icon'>
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
                </Row>

                <motion.div
                    key={status}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <Heading level={3} size='2xl' weight='bold' tone='primary' className='oauth-title'>
                        {status === 'loading' && 'Authenticating...'}
                        {status === 'success' && 'Successfully Authenticated!'}
                    </Heading>
                </motion.div>

                <motion.div
                    key={`desc-${status}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                >
                    <Text as='p' tone='secondary'>
                        {status === 'loading' && 'Please wait while we verify your credentials.'}
                        {status === 'success' && 'Redirecting you to setup...'}
                    </Text>
                </motion.div>
            </motion.div>
        </Row>
    );
};

export default OAuthCallbackTemplate;
