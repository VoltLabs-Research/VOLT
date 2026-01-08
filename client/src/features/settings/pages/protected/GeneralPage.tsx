import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/features/auth/stores';
import authApi from '@/features/auth/api/auth';
import GeneralSettings from '@/features/settings/components/molecules/GeneralSettings';

import useConfirm from '@/hooks/ui/use-confirm';

const GeneralPage: React.FC = () => {
    const { confirm } = useConfirm();
    const user = useAuthStore((state) => state.user);

    const [userData, setUserData] = useState({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        email: user?.email || ''
    });
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateError, setUpdateError] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            setUserData({
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                email: user.email || ''
            });
        }
    }, [user]);

    const updateUserOnServer = useCallback(async (field: string, value: string) => {
        try {
            setIsUpdating(true);
            setUpdateError(null);
            await authApi.updateMe({ [field]: value } as any);
            setUserData(prev => ({ ...prev, [field]: value }));
        } catch (error: any) {
            console.error('Error updating user data:', error);
            setUpdateError(`Failed to update ${field}. Please try again.`);
            if (user) {
                setUserData({
                    firstName: user.firstName || '',
                    lastName: user.lastName || '',
                    email: user.email || ''
                });
            }
        } finally {
            setIsUpdating(false);
        }
    }, [user]);

    const handleUserDataChange = useCallback((field: string, value: string) => {
        setUserData(prev => ({ ...prev, [field]: value }));
        setUpdateError(null);
        setTimeout(() => {
            updateUserOnServer(field, value);
        }, 1000);
    }, [updateUserOnServer]);

    const handleDeleteAccount = useCallback(async () => {
        const isConfirmed = await confirm('Are you sure you want to delete your account? This action cannot be undone.');
        if (isConfirmed) {
            alert('TODO:');
        }
    }, [confirm]);

    return (
        <GeneralSettings
            user={user}
            userData={userData}
            isUpdating={isUpdating}
            updateError={updateError}
            onFieldChange={handleUserDataChange}
            onDeleteAccount={handleDeleteAccount}
        />
    );
};

export default GeneralPage;
