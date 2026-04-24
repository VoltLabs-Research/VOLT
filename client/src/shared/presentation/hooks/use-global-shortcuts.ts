import { useHotkeys } from 'react-hotkeys-hook';
import { useLocation, useNavigate } from 'react-router-dom';
export const useGlobalShortcuts = () => {
    const navigate = useNavigate();
    const location = useLocation();

    useHotkeys(
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
