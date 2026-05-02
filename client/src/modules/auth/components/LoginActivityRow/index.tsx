import SettingsRow from '@/modules/auth/components/SettingsRow';
import Button from '@/shared/presentation/primitives/Button';
import { Activity } from 'lucide-react';

interface LoginActivityRowProps {
    onViewActivity: () => void;
}

const LoginActivityRow = ({ onViewActivity }: LoginActivityRowProps) => {
    return (
        <SettingsRow
            icon={<Activity size={20} />}
            title="Recent Sessions"
            description="View your login history and active sessions"
            rightContent={
                <Button
                    variant="soft"
                    onClick={onViewActivity}
                >
                    View Activity
                </Button>
            }
        />
    );
};

export default LoginActivityRow;
