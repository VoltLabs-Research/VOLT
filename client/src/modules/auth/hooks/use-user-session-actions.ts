import { useAuthStore } from '@/modules/auth/store/use-auth-store';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const useUserSessionActions = () => {
    const navigate = useNavigate();
    const [isSigningOut, setIsSigningOut] = useState(false);

    const handleSignOut = useCallback(() => {
        setIsSigningOut(true);
        useAuthStore.getState().signOut();
    }, []);

    const handleSettingsClick = useCallback(() => {
        navigate('/dashboard/settings/general');
    }, [navigate]);

    return {
        handleSettingsClick,
        handleSignOut,
        isSigningOut
    };
};

export default useUserSessionActions;
