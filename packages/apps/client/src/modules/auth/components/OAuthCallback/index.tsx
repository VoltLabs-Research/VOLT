import Loader from '@/shared/ui/components/Loader';
import { fetchCurrentUser } from '@/modules/auth/hooks/queries';
import {
    clearPostAuthDestination,
    getPostAuthRedirectPath,
    resolvePostAuthDestination
} from '@/modules/auth/services/post-auth-destination-storage';
import { useAuthStore } from '@/modules/auth/store/use-auth-store';
import { resolveErrorTitle } from '@/shared/errors/core/report-error';
import { Button } from '@heroui/react';
import { Check } from 'lucide-react';
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

    let content = (
        <>
            <Loader size='md' color='current' className='text-muted' />
            <div className='flex flex-col gap-2'>
                <h1 className='text-2xl font-semibold tracking-tight text-foreground'>Authenticating...</h1>
                <p className='text-base text-muted'>Please wait while we verify your credentials.</p>
            </div>
        </>
    );

    if (status === 'success') {
        content = (
            <>
                <Check size={28} className='text-muted' aria-hidden='true' />
                <div className='flex flex-col gap-2'>
                    <h1 className='text-2xl font-semibold tracking-tight text-foreground'>Successfully Authenticated!</h1>
                    <p className='text-base text-muted'>Redirecting you to setup...</p>
                </div>
            </>
        );
    }

    if (status === 'error') {
        content = (
            <>
                <div className='flex flex-col gap-2'>
                    <h1 className='text-2xl font-semibold tracking-tight text-foreground'>Authentication failed</h1>
                    <p className='text-base text-muted'>{errorMessage}</p>
                </div>
                <Button variant='primary' size='sm' onPress={handleBackToSignIn}>Back to sign in</Button>
            </>
        );
    }

    return (
        <main className='flex min-h-dvh items-center justify-center bg-background px-4 py-18'>
            {/* Keyed by status, so each state rises in on its own. */}
            <section
                key={status}
                className='flex w-full max-w-sm flex-col items-center gap-5 text-center animate-in fade-in-0 slide-in-from-bottom-3 duration-280 ease-out-fluid'
                role={status === 'error' ? 'alert' : 'status'}
                aria-live={status === 'error' ? undefined : 'polite'}
            >
                {content}
            </section>
        </main>
    );
};

export default OAuthCallbackTemplate;
