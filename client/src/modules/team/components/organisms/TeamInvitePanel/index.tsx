import React from 'react';
import { Copy, BookOpen } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import PanelHeader from '../../molecules/PanelHeader';
import PanelFooter from '../../molecules/PanelFooter';
import InvitationEmailInput from '../../molecules/InvitationEmailInput';
import InvitationsList from '../../molecules/InvitationsList';
import useInvitePanel from '@/modules/team/hooks/team-invitation/use-invite-panel';
import './TeamInvitePanel.css';

interface TeamInvitePanelProps {
    onClose?: () => void;
};

const TeamInvitePanel: React.FC<TeamInvitePanelProps> = ({
    onClose
}) => {
    const {
        emailField,
        handleSubmit,
        isSubmitting,
        buttonState,
        pendingInvitations,
        loadingInvitations,
        cancelingId,
        handleCancelInvitation
    } = useInvitePanel();

    return (
        <Container className='team-invite-panel d-flex column'>
            <PanelHeader
                tabs={[
                    { label: 'Share', active: true, onClick: undefined },
                    { label: 'Publish', active: false, disabled: true, onClick: undefined }
                ]}
                onClose={onClose}
            />

            <Container className='team-invite-content d-flex column flex-1 y-auto'>
                <InvitationEmailInput
                    value={emailField.value}
                    onChange={(event) => {
                        emailField.onChange(event as React.ChangeEvent<HTMLInputElement>);
                    }}
                    onBlur={emailField.onBlur}
                    onSubmit={handleSubmit}
                    error={emailField.error}
                    isSubmitting={isSubmitting}
                    buttonState={buttonState}
                />

                <InvitationsList
                    invitations={pendingInvitations}
                    isLoading={loadingInvitations}
                    cancelingId={cancelingId}
                    onCancelInvitation={handleCancelInvitation}
                />

                <PanelFooter
                    actions={[{ 
                        label: 'Copy link', 
                        icon: <Copy size={16} />, 
                        onClick: () => {},
                        disabled: true
                    }, { 
                        label: 'Learn more', 
                        icon: <BookOpen size={16} />, 
                        onClick: () => {},
                        disabled: true
                    }]}
                />
            </Container>
        </Container>
    );
};

export default TeamInvitePanel;
