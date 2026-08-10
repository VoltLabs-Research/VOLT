import { Users } from 'lucide-react';
import type { WorkspacePresenceUser } from '@/modules/canvas/collaboration/use-canvas-workspace';

interface CanvasBannersProps {
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

/**
 * `.canvas-banner-stack` clears the toolbar with the same `--canvas-header-height` the
 * toolbar uses, and clears the right panel with the `--canvas-right-overlay-size`
 * `CanvasPage` writes as an inline style. Both `var()` references are kept rather than
 * resolved.
 */
const STACK_CLASS = 'z-[4] mt-[var(--canvas-header-height,55px)] mr-[var(--canvas-right-overlay-size,0px)] border-b border-border';

/**
 * `.canvas-banner--collab` tinted the row with 14% of `--accent-blue` over the page.
 * That token collapsed onto the monochrome accent, so the mix is expressed against
 * `--accent` — the same computed colour, without the dead token name.
 */
const BANNER_CLASS = 'w-full gap-3 border-b border-border px-3.5 py-2 text-[0.8125rem] leading-[1.35] last:border-b-0 bg-[color-mix(in_srgb,var(--accent)_14%,var(--background))] text-foreground';

const CanvasBanners = ({
    collaborationOwner,
    isWorkspaceOwner,
    onLeaveCollaboration
}: CanvasBannersProps) => {
    const showCollabBanner = Boolean(collaborationOwner) && !isWorkspaceOwner;

    if (!showCollabBanner) {
        return null;
    }

    return (
        <div className={`flex flex-col ${STACK_CLASS}`} role='region' aria-label='Canvas notifications'>
            {showCollabBanner && collaborationOwner && (
                <div className={`flex flex-row items-center ${BANNER_CLASS}`} role='status'>
                    <span className='inline-flex shrink-0 items-center justify-center' aria-hidden='true'>
                        <Users size={14} />
                    </span>
                    <span className='min-w-0 flex-1'>
                        You are viewing <strong>{formatPeerName(collaborationOwner)}</strong>'s session.
                        Changes are broadcast live — scene edits go to their viewport.
                    </span>
                    {onLeaveCollaboration && (
                        <span className='inline-flex shrink-0 gap-1.5'>
                            <button
                                type='button'
                                className='inline-flex size-[22px] cursor-pointer items-center justify-center rounded border-0 bg-transparent p-0 text-current opacity-70 hover:bg-[color-mix(in_srgb,currentColor_12%,transparent)] hover:opacity-100'
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
        </div>
    );
};

export default CanvasBanners;
