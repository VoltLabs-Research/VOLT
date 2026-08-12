import Loader from '@/shared/ui/components/Loader';
import { fetchCurrentUser } from '@/modules/auth/hooks/queries';
import {
    clearPostAuthDestination,
    getPostAuthRedirectPath,
    resolvePostAuthDestination
} from '@/modules/auth/services/post-auth-destination-storage';
import { useAuthStore } from '@/modules/auth/store/use-auth-store';
import { resolveErrorTitle } from '@/shared/errors/core/report-error';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';

import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const DEFAULT_OAUTH_ERROR_MESSAGE = 'We could not complete sign in with your provider. Please try again.';

const OAuthCallbackTemplate = () => {
    const navigate = useNavigate();
    const markAuthenticated = useAuthStore((state) => state.markAuthenticated);
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [errorMessage, setErrorMessage] = useState(DEFAULT_OAUTH_ERROR_MESSAGE);
    const redirectTimeoutReference = useRef<number | null>(null);

    const params = useMemo(() => new URLSearchParams(window.location.search), []);
    const next = useMemo(() => resolvePostAuthDestination({
        queryNext: params.get('next')
    }), [params]);
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
    }, [markAuthenticated, navigate, next, params]);

    return (
        <div className='flex flex-row items-center justify-center relative overflow-hidden h-dvh bg-background'>
            <div className='absolute overflow-hidden inset-0'>
                <div className='rounded-full absolute -top-[20%] -left-[10%] w-1/2 h-1/2 bg-accent/10 blur-[120px] opacity-50' />
                <div className='rounded-full absolute top-[20%] -right-[10%] w-2/5 h-2/5 bg-accent/10 blur-[120px] opacity-50' />
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
                    className='z-10 max-w-[28rem] bg-surface border border-border rounded-3xl relative w-full text-center p-8'
                >
                    <div className='flex flex-row items-center justify-center mb-6'>
                        {status === 'loading' && (
                            <Loader size='lg' color='current' />
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
                                <CheckCircle size={48} className='text-success' />
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
                        <h3 className='mb-2 text-2xl font-bold text-foreground'>
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
