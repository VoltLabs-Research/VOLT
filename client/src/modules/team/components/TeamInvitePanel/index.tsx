import { InvitationEmailInput } from '../InvitationEmailInput';
import { InvitationsList } from '../InvitationsList';
import { InviteCodeSection } from '../InviteCodeSection';
import { PanelFooter } from '../PanelFooter';
import PanelHeader from '@/shared/presentation/components/PanelHeader';
import useInvitePanel from '@/modules/team/hooks/invitation/use-invite-panel';
import useInviteCode from '@/modules/team/hooks/invitation/use-invite-code';
import { useState } from 'react';
import { BookOpen, Copy } from 'lucide-react';
import './TeamInvitePanel.css';

enum InviteTab {
    Share = 'Share',
    InvitationCode = 'Invitation Code'
}

interface TeamInvitePanelProps {
    onClose?: () => void;
}

export const TeamInvitePanel = ({
    onClose
}: TeamInvitePanelProps) => {
    const [activeTab, setActiveTab] = useState<InviteTab>(InviteTab.Share);

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

    const tabs = [
        {
            label: InviteTab.Share,
            active: activeTab === InviteTab.Share,
            onClick: () => setActiveTab(InviteTab.Share)
        },
        {
            label: InviteTab.InvitationCode,
            active: activeTab === InviteTab.InvitationCode,
            onClick: () => setActiveTab(InviteTab.InvitationCode)
        }
    ];

    const footerActions = [
        {
            label: 'Copy link',
            icon: <Copy size={16} />,
            onClick: handleCopy,
            disabled: !inviteCode
        },
        {
            label: 'Learn more',
            icon: <BookOpen size={16} />,
            onClick: () => {},
            disabled: true
        }
    ];

    return (
        <div className='team-invite-panel d-flex column'>
            <PanelHeader
                tabs={tabs}
                onClose={onClose}
            />

            <div className='team-invite-content d-flex column flex-1 y-auto'>
                {activeTab === InviteTab.Share ? (
                    <>
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

                        <PanelFooter
                            actions={footerActions}
                        />
                    </>
                ) : (
                    <InviteCodeSection
                        inviteCode={inviteCode}
                        canManageCode={canManageCode}
                        isGenerating={isGenerating}
                        isDeleting={isDeleting}
                        onGenerate={handleGenerate}
                        onDelete={handleDelete}
                        onCopy={handleCopy}
                    />
                )}
            </div>
        </div>
    );
};
