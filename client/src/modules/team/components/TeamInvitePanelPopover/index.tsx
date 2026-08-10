import { Button, PopoverContent, PopoverDialog, PopoverRoot, PopoverTrigger } from '@heroui/react';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import { TeamInvitePanel } from '@/modules/team/components/TeamInvitePanel';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';

/**
 * `.team-invite-panel-popover` plus the surface classes the call site already carried.
 * They go on `PopoverContent` — the positioned element, and bravais's `.popover`
 * equivalent. HeroUI's own `.popover` supplies the overlay fill and shadow but no
 * border, so `border border-border` is kept.
 */
const PANEL_POPOVER_CLASS = 'max-h-[420px] w-[min(520px,calc(100vw-2rem))] max-w-[400px] border border-border bg-surface overflow-hidden';

/**
 * `p-0` is bravais's `noPadding`. HeroUI's `.popover__dialog` is `p-4`, where bravais's
 * `.popover` declared no padding at all — so both of its `noPadding` states were in fact
 * padding-free and the panel sits edge-to-edge.
 */
const PANEL_DIALOG_CLASS = 'flex flex-col h-full p-0';

export const TeamInvitePanelPopover = () => {
    const selectedTeam = useSelectedTeam();
    /*
     * bravais's Popover owned its open state and handed a `close` callback to a
     * render-prop child. HeroUI's `PopoverDialog` types `children` as a plain
     * `ReactNode`, so the state is held here instead and `close` is derived from it —
     * `TeamInvitePanel`'s own `onClose` keeps working unchanged.
     */
    const [isOpen, setIsOpen] = useState(false);

    return (
        <PopoverRoot isOpen={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger>
                <Button isIconOnly variant='ghost' aria-label='Invite team members'>
                    {/* React Aria's Button drops `title`, so the native tooltip hangs off the glyph. */}
                    <span className='flex items-center justify-center' title='Invite members'>
                        <UserPlus size={18} aria-hidden='true' />
                    </span>
                </Button>
            </PopoverTrigger>
            <PopoverContent placement='bottom end' className={PANEL_POPOVER_CLASS}>
                <PopoverDialog className={PANEL_DIALOG_CLASS} aria-label='Invite members'>
                    {selectedTeam && (
                        <TeamInvitePanel onClose={() => setIsOpen(false)} />
                    )}
                </PopoverDialog>
            </PopoverContent>
        </PopoverRoot>
    );
};
