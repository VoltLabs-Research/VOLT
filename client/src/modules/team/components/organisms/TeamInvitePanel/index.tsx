import { InvitationEmailInput } from '../../molecules/InvitationEmailInput';
import { InvitationsList } from '../../molecules/InvitationsList';
import { InviteCodeSection } from '../../molecules/InviteCodeSection';
import { PanelFooter } from '../../molecules/PanelFooter';
import { PanelHeader } from '../../molecules/PanelHeader';
import Container from '@/shared/presentation/components/Container';
import useInvitePanel from '@/modules/team/hooks/invitation/use-invite-panel';
import useInviteCode from '@/modules/team/hooks/invitation/use-invite-code';
import { BookOpen, Copy } from 'lucide-react';
import './TeamInvitePanel.css';

interface TeamInvitePanelProps {
    onClose?: () => void;
};

export const TeamInvitePanel = ({
    onClose
}: TeamInvitePanelProps) => {
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

    const {
        inviteCode,
        canManageCode,
        isGenerating,
        isDeleting,
        handleGenerate,
        handleDelete,
        handleCopy
    } = useInviteCode();

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
                    onChange={emailField.onChange}
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

                <InviteCodeSection
                    inviteCode={inviteCode}
                    canManageCode={canManageCode}
                    isGenerating={isGenerating}
                    isDeleting={isDeleting}
                    onGenerate={handleGenerate}
                    onDelete={handleDelete}
                    onCopy={handleCopy}
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
