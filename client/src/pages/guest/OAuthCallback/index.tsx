import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import useAuthStore from '@/stores/authentication';
import { TokenStorage } from '@/utilities/storage';
import './OAuthCallback.css';

export default function OAuthCallback(){
    const navigate = useNavigate();
    const initializeAuth = useAuthStore((state) => state.initializeAuth);
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

    useEffect(() => {
        const handleOAuthCallback = async() => {
            try{
                // Get token from URL query parameters
                const params = new URLSearchParams(window.location.search);
                const token = params.get('token');

                if(!token){
                    throw new Error('No token received from OAuth provider');
                }

                // Store token in localStorage
                TokenStorage.setToken(token);

                // Initialize auth state with the new token
                await initializeAuth();

                setStatus('success');

                // Redirect to dashboard after a short delay to show success state
                setTimeout(() => {
                    navigate('/dashboard');
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
    }, [navigate, initializeAuth]);

    return(
        <div className="oauth-callback-container">
            {/* Background Elements */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="oauth-background-blob blob-blue" />
                <div className="oauth-background-blob blob-purple" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="oauth-card"
            >
                <div className="oauth-status-icon">
                    {status === 'loading' && (
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                            <Loader2 size={48} className="text-blue-500" />
                        </motion.div>
                    )}

                    {status === 'success' && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 10 }}
                        >
                            <CheckCircle size={48} className="text-green-500" />
                        </motion.div>
                    )}

                    {status === 'error' && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 10 }}
                        >
                            <XCircle size={48} className="text-red-500" />
                        </motion.div>
                    )}
                </div>

                <motion.h2
                    key={status}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="oauth-title"
                >
                    {status === 'loading' && 'Authenticating...'}
                    {status === 'success' && 'Successfully Authenticated!'}
                    {status === 'error' && 'Authentication Failed'}
                </motion.h2>

                <motion.p
                    key={`desc-${status}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="oauth-description"
                >
                    {status === 'loading' && 'Please wait while we verify your credentials.'}
                    {status === 'success' && 'Redirecting you to the dashboard...'}
                    {status === 'error' && 'Something went wrong. Redirecting to login...'}
                </motion.p>
            </motion.div>
        </div>
    );
}
