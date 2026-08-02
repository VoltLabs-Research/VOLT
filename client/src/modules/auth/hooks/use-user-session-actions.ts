import { useAuthStore } from '@/modules/auth/store/use-auth-store';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const useUserSessionActions = () => {
    const navigate = useNavigate();
    const [isSigningOut, setIsSigningOut] = useState(false);

    return {
        handleSettingsClick: () => navigate('/dashboard/settings/general'),
        handleSignOut: () => {
            setIsSigningOut(true);
            useAuthStore.getState().signOut();
        },
        isSigningOut
    };
};

export default useUserSessionActions;
