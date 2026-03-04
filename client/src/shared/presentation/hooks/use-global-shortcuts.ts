import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const useGlobalShortcuts = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Check for Windows key (Meta) or Command key on Mac
            if (event.key === 'OS' || event.key === 'Meta') {
                navigate('/start');
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [navigate]);
};
