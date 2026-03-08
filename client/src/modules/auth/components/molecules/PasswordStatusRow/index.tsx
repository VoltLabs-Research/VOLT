import React from 'react';
import { format } from 'date-fns';
import Button from '@/shared/presentation/components/Button';
import SettingsRow from '@/modules/auth/components/molecules/SettingsRow';
import { PasswordInfo } from '@/modules/auth/components/organisms/PasswordChangeForm/validation-schema';
import { Lock, ChevronDown, ChevronUp } from 'lucide-react';

interface PasswordStatusRowProps {
    passwordInfo: PasswordInfo | null;
    isFormOpen: boolean;
    onToggleForm: () => void;
}

const PasswordStatusRow: React.FC<PasswordStatusRowProps> = ({
    passwordInfo,
    isFormOpen,
    onToggleForm
}) => {
    let description = 'No password set (OAuth only)';
    if (passwordInfo?.hasPassword) {
        description = 'Password configured';
        if (passwordInfo.lastChanged) {
            description = `Last changed: ${format(new Date(passwordInfo.lastChanged), 'MMMM d, yyyy')}`;
        }
    }

    return (
        <SettingsRow
            icon={<Lock size={20} />}
            title="Password"
            description={description}
            rightContent={
                <Button
                    variant="soft"
                    size="sm"
                    rightIcon={isFormOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    onClick={onToggleForm}
                >
                    {passwordInfo?.hasPassword ? 'Change' : 'Set Password'}
                </Button>
            }
        />
    );
};

export default PasswordStatusRow;
