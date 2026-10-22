import { Button, PopoverContent, PopoverDialog, PopoverRoot, PopoverTrigger } from '@heroui/react';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import { TeamInvitePanel } from '@/modules/team/components/TeamInvitePanel';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';

export const TeamInvitePanelPopover = () => {
    const selectedTeam = useSelectedTeam();

    const [isOpen, setIsOpen] = useState(false);

    return (
        <PopoverRoot isOpen={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger>
                <Button isIconOnly variant='ghost' className='rounded-lg text-muted hover:bg-foreground/6 hover:text-foreground' aria-label='Invite team members'>
                    <span className='flex items-center justify-center' title='Invite members'>
                        <UserPlus size={18} aria-hidden='true' />
                    </span>
                </Button>
            </PopoverTrigger>
            <PopoverContent placement='bottom end' className='max-h-[420px] w-[min(400px,calc(100vw-2rem))] overflow-hidden'>
                <PopoverDialog className='flex flex-col h-full p-0' aria-label='Invite members'>
                    {selectedTeam && (
                        <TeamInvitePanel onClose={() => setIsOpen(false)} />
                    )}
                </PopoverDialog>
            </PopoverContent>
        </PopoverRoot>
    );
};
