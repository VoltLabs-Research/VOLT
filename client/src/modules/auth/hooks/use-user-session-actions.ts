import { useAuthStore } from '@/modules/auth/stores/use-auth-store';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sileo } from 'sileo';

const useUserSessionActions = () => {
    const navigate = useNavigate();
    const [isSigningOut, setIsSigningOut] = useState(false);

    const handleSignOut = useCallback(async () => {
        try {
            setIsSigningOut(true);
            await useAuthStore.getState().signOut();
        } catch {
            sileo.error({ title: 'Sign out failed', description: 'Please try again.' });
        } finally {
            setIsSigningOut(false);
        }
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
