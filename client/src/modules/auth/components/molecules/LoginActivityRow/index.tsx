import React from 'react';
import Button from '@/shared/presentation/components/Button';
import SettingsRow from '@/modules/auth/components/molecules/SettingsRow';
import { Activity } from 'lucide-react';

interface LoginActivityRowProps {
    onViewActivity: () => void;
}

const LoginActivityRow: React.FC<LoginActivityRowProps> = ({ onViewActivity }) => {
    return (
        <SettingsRow
            icon={<Activity size={20} />}
            title="Recent Sessions"
            description="View your login history and active sessions"
            rightContent={
                <Button
                    variant="soft"
                    size="sm"
                    onClick={onViewActivity}
                >
                    View Activity
                </Button>
            }
        />
    );
};

export default LoginActivityRow;
