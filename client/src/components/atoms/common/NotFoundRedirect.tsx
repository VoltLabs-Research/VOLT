import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useToast from '@/hooks/ui/use-toast';

const NotFoundRedirect = () => {
    const navigate = useNavigate();
    const { showError } = useToast();
    const hasRedirected = useRef(false);

    useEffect(() => {
        if (hasRedirected.current) return;
        hasRedirected.current = true;

        showError('Page not found. Redirecting to dashboard...');
        navigate('/dashboard', { replace: true });
    }, [navigate, showError]);

    return null;
};

export default NotFoundRedirect;
