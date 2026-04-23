import SettingsRow from '@/modules/auth/components/SettingsRow';
import { Button } from '@/shared/presentation/primitives';
import { format } from 'date-fns';
import { ChevronDown, ChevronUp, Lock } from 'lucide-react';
import type { PasswordInfo } from '@/modules/auth/components/PasswordChangeForm/validation-schema';

interface PasswordStatusRowProps {
    passwordInfo: PasswordInfo | null;
    isFormOpen: boolean;
    onToggleForm: () => void;
};

const PasswordStatusRow = ({
    passwordInfo,
    isFormOpen,
    onToggleForm
}: PasswordStatusRowProps) => {
    let description = 'No password set (OAuth only)';
    let rightIcon = <ChevronDown size={16} />;

    if (passwordInfo?.hasPassword) {
        description = 'Password configured';
        if (passwordInfo.lastChanged) {
            description = `Last changed: ${format(new Date(passwordInfo.lastChanged), 'MMMM d, yyyy')}`;
        }
    }

    if (isFormOpen) {
        rightIcon = <ChevronUp size={16} />;
    }

    return (
        <SettingsRow
            icon={<Lock size={20} />}
            title="Password"
            description={description}
            rightContent={
                <Button
                    variant="soft"
                    rightIcon={rightIcon}
                    onClick={onToggleForm}
                >
                    {passwordInfo?.hasPassword ? 'Change' : 'Set Password'}
                </Button>
            }
        />
    );
};

export default PasswordStatusRow;
