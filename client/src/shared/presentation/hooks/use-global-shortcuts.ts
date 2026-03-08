import { useNavigate, useLocation } from 'react-router-dom';
import useAppHotkeys from './use-app-hotkeys';

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
