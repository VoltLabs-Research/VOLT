import { useEffect, useState } from 'react';
import { Eye, Monitor, Users, X } from 'lucide-react';
import type { WorkspacePresenceUser } from '@/modules/canvas/collaboration/use-canvas-workspace';

const MOBILE_WARNING_STORAGE_KEY = 'volt:canvas:mobile-warning-dismissed';

interface CanvasBannersProps {
    isGuest: boolean;
    isNarrowViewport: boolean;
    collaborationOwner?: WorkspacePresenceUser;
    isWorkspaceOwner: boolean;
    onLeaveCollaboration?: () => void;
}

const formatPeerName = (peer: WorkspacePresenceUser): string => {
    const trimmedFirst = peer.firstName?.trim();
    const trimmedLast = peer.lastName?.trim();
    if (trimmedFirst || trimmedLast) {
        return [trimmedFirst, trimmedLast].filter(Boolean).join(' ');
    }
    if (peer.email) {
        return peer.email;
    }
    return 'another user';
};

const CanvasBanners = ({
    isGuest,
    isNarrowViewport,
    collaborationOwner,
    isWorkspaceOwner,
    onLeaveCollaboration
}: CanvasBannersProps) => {
    const [mobileWarningDismissed, setMobileWarningDismissed] = useState<boolean>(() => {
        if (typeof window === 'undefined') return true;
        return window.localStorage.getItem(MOBILE_WARNING_STORAGE_KEY) === '1';
    });

    useEffect(() => {
        if (!mobileWarningDismissed || typeof window === 'undefined') return;
        window.localStorage.setItem(MOBILE_WARNING_STORAGE_KEY, '1');
    }, [mobileWarningDismissed]);

    const showCollabBanner = Boolean(collaborationOwner) && !isWorkspaceOwner;
    const showMobileBanner = isNarrowViewport && !mobileWarningDismissed;

    if (!isGuest && !showCollabBanner && !showMobileBanner) {
        return null;
    }

    return (
        <div className='canvas-banner-stack d-flex column' role='region' aria-label='Canvas notifications'>
            {isGuest && (
                <div className='canvas-banner canvas-banner--guest d-flex items-center' role='status'>
                    <span className='canvas-banner__icon' aria-hidden='true'>
                        <Eye size={14} />
                    </span>
                    <span className='canvas-banner__message'>
                        <strong>Read-only.</strong> You are viewing this trajectory as a guest. Ask a team
                        administrator for access to run plugins or edit the scene.
                    </span>
                </div>
            )}

            {showCollabBanner && collaborationOwner && (
                <div className='canvas-banner canvas-banner--collab d-flex items-center' role='status'>
                    <span className='canvas-banner__icon' aria-hidden='true'>
                        <Users size={14} />
                    </span>
                    <span className='canvas-banner__message'>
                        You are viewing <strong>{formatPeerName(collaborationOwner)}</strong>'s session.
                        Changes are broadcast live — scene edits go to their viewport.
                    </span>
                    {onLeaveCollaboration && (
                        <span className='canvas-banner__actions'>
                            <button
                                type='button'
                                className='canvas-banner__close'
                                onClick={onLeaveCollaboration}
                                aria-label='Leave session and return to your workspace'
                                title='Leave session'
                            >
                                Leave
                            </button>
                        </span>
                    )}
                </div>
            )}

            {showMobileBanner && (
                <div className='canvas-banner canvas-banner--mobile d-flex items-center' role='status'>
                    <span className='canvas-banner__icon' aria-hidden='true'>
                        <Monitor size={14} />
                    </span>
                    <span className='canvas-banner__message'>
                        Canvas is optimized for desktop. On small screens some controls fall back to a
                        drawer and the timeline gets tight — consider switching to a larger display.
                    </span>
                    <span className='canvas-banner__actions'>
                        <button
                            type='button'
                            className='canvas-banner__close'
                            onClick={() => setMobileWarningDismissed(true)}
                            aria-label='Dismiss'
                            title='Dismiss'
                        >
                            <X size={14} />
                        </button>
                    </span>
                </div>
            )}
        </div>
    );
};

export default CanvasBanners;
