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
import { Loader } from '@voltstack/bravais';
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

            if (redirectTimeoutReference.current !== null) {
                window.clearTimeout(redirectTimeoutReference.current);
            }
        };
    }, [markAuthenticated, navigate]);

    return (
        <div className='flex flex-row items-center justify-center relative overflow-hidden h-dvh oauth-callback-container'>
            <div className='absolute overflow-hidden inset-0'>
                <div className='rounded-full absolute w-1/2 oauth-background-blob oauth-blob-blue' />
                <div className='rounded-full absolute oauth-background-blob oauth-blob-purple' />
            </div>

            {status === 'error' ? (
                <RecoveryState
                    tone={RecoveryStateTone.Error}
                    title='Authentication failed'
                    description={errorMessage}
                    retryLabel='Back to sign in'
                    onRetry={handleBackToSignIn}
                />
            ) : (
                <motion.div
                    initial={{
                        opacity: 0,
                        scale: 0.95
                    }}
                    animate={{
                        opacity: 1,
                        scale: 1
                    }}
                    className='oauth-card bg-surface border border-border rounded-3xl relative w-full text-center p-8'
                >
                    <div className='flex flex-row items-center justify-center mb-6 oauth-status-icon'>
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
                    </div>

                    <motion.div
                        key={status}
                        initial={{
                            opacity: 0,
                            y: 10
                        }}
                        animate={{
                            opacity: 1,
                            y: 0
                        }}
                    >
                        <h3 className='text-2xl font-semibold text-foreground oauth-title'>
                            {status === 'loading' && 'Authenticating...'}
                            {status === 'success' && 'Successfully Authenticated!'}
                        </h3>
                    </motion.div>

                    <motion.div
                        key={`desc-${status}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                    >
                        <p className='text-muted'>
                            {status === 'loading' && 'Please wait while we verify your credentials.'}
                            {status === 'success' && 'Redirecting you to setup...'}
                        </p>
                    </motion.div>
                </motion.div>
            )}
        </div>
    );
};

export default OAuthCallbackTemplate;
