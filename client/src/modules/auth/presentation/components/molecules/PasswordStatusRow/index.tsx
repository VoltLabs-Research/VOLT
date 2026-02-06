import React from 'react';
import { format } from 'date-fns';
import Button from '@/shared/presentation/components/Button';
import SettingsRow from '@/modules/auth/presentation/components/molecules/SettingsRow';
import { PasswordInfo } from '@/modules/auth/presentation/components/organisms/PasswordChangeForm/validation-schema';
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
    return (
        <SettingsRow
            icon={<Lock size={20} />}
            title="Password"
            description={
                passwordInfo?.hasPassword
                    ? `Last changed: ${format(new Date(passwordInfo.lastChanged), 'MMMM d, yyyy')}`
                    : 'No password set (OAuth only)'
            }
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
