import useAppHotkeys from './use-app-hotkeys';
import { useNavigate, useLocation } from 'react-router-dom';

export const useGlobalShortcuts = () => {
    const navigate = useNavigate();
    const location = useLocation();

    useAppHotkeys(
        'escape',
        () => {
            if (location.pathname === '/start') {
                navigate('/dashboard');
            } else {
                navigate('/start');
            }
        },
        {
            preventDefault: true
        },
        [navigate, location.pathname]
    );
};
