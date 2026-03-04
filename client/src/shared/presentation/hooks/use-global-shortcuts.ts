import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export const useGlobalShortcuts = () => {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (location.pathname === '/start') {
                    navigate('/dashboard');
                } else {
                    navigate('/start');
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [navigate, location.pathname]);
};
