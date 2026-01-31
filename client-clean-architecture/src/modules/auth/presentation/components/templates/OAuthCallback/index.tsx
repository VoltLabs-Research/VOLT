import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';
import useAuthUseCases from '@/modules/auth/presentation/hooks/use-auth-use-cases';
import TokenStorage from '@/modules/auth/infrastructure/storage/TokenStorage';
import { useAuthStore } from '../../../stores/use-auth-store';
import './OAuthCallback.css';

const OAuthCallbackTemplate = () => {
    const navigate = useNavigate();
    const { getMeUseCase } = useAuthUseCases();
    const setUser = useAuthStore((state) => state.setUser);
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const tokenStorage = useMemo(() => new TokenStorage(), []);

    useEffect(() => {
        const handleOAuthCallback = async () => {
            try{
                const params = new URLSearchParams(window.location.search);
                const token = params.get('token');

                if(!token){
                    throw new Error('No token received from OAuth provider');
                }

                tokenStorage.setToken(token);

                const user = await getMeUseCase.execute();
                setUser(user);

                setStatus('success');

                setTimeout(() => {
                    navigate('/');
                }, 1500);
            }catch(error){
                console.error('OAuth callback error:', error);
                setStatus('error');
                setTimeout(() => {
                    navigate('/auth/sign-in?error=oauth_failed');
                }, 2000);
            }
        };

        handleOAuthCallback();
    }, [navigate, getMeUseCase, tokenStorage, setUser]);

    return (
        <Container className='d-flex flex-center items-center oauth-callback-container p-relative vh-max overflow-hidden'>
            <Container className='p-absolute inset-0 overflow-hidden'>
                <Container className='oauth-background-blob oauth-blob-blue p-absolute w-50' />
                <Container className='oauth-background-blob oauth-blob-purple p-absolute' />
            </Container>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className='oauth-card p-relative w-max text-center p-2'
            >
                <Container className='d-flex flex-center mb-1-5 oauth-status-icon'>
                    {status === 'loading' && (
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        >
                            <Loader2 size={48} className='oauth-icon-loading' />
                        </motion.div>
                    )}

                    {status === 'success' && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 10 }}
                        >
                            <CheckCircle size={48} className='oauth-icon-success' />
                        </motion.div>
                    )}

                    {status === 'error' && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 10 }}
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
                    <Paragraph className='oauth-description'>
                        {status === 'loading' && 'Please wait while we verify your credentials.'}
                        {status === 'success' && 'Redirecting you to the dashboard...'}
                        {status === 'error' && 'Something went wrong. Redirecting to login...'}
                    </Paragraph>
                </motion.div>
            </motion.div>
        </Container>
    );
};

export default OAuthCallbackTemplate;
