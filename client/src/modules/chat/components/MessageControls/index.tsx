import { COMMON_REACTIONS } from '@/modules/chat/utils/reactions';
import { EllipsisVertical, Smile, SquarePen, Trash2 } from 'lucide-react';
import { useState } from 'react';
import EmojiPicker from '@/shared/ui/components/EmojiPicker';
import {
    DropdownItem,
    DropdownMenu,
    DropdownPopover,
    DropdownRoot,
    DropdownTrigger,
    PopoverContent,
    PopoverDialog,
    PopoverRoot,
    PopoverTrigger,
    buttonVariants,
    cn
} from '@heroui/react';

interface MessageControlsProps {
    messageId: string;
    isOwn: boolean;
    onReact: (emoji: string) => void;
    onEdit: () => void;
    onDelete: () => void;
}

/*
 * MessageControls.css was driven entirely from MessageBubble's classes — the whole
 * `.message-bubble:hover .message-controls` family. Those are the `group/bubble`
 * variants below, and the side flip that was `.message-bubble.sent
 * .message-controls` is `isOwn`, which this component already receives.
 *
 * `top` / `right` / `z-index` are carried over as written. They are inert: the
 * root has no `position`, so they were inert in the stylesheet too. Adding
 * `absolute` here would float the controls over the bubble — which is plainly what
 * this was drawn for, and just as plainly a change in layout, so it is reported
 * rather than made silently.
 *
 * Where a pointer cannot hover, the controls are always visible; the two media
 * queries are one alternation in CSS and two variants here.
 */
const CONTROLS_CLASS_NAMES = 'flex gap-1 -top-2 right-2 z-10 opacity-0 transition-opacity duration-200 group-hover/bubble:opacity-100 group-focus-within/bubble:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100 [@media(hover:none)]:opacity-100';

const OWN_CONTROLS_CLASS_NAMES = 'right-auto left-2';

/* bravais sized these to 40px through `.message-controls .volt-icon-button`. */
const TRIGGER_CLASS_NAMES = 'min-w-10 min-h-10';

const MessageControls = ({ messageId, isOwn, onReact, onEdit, onDelete }: MessageControlsProps) => {
    const [isReactionPickerOpen, setIsReactionPickerOpen] = useState(false);

    return (
        <div className={cn(CONTROLS_CLASS_NAMES, isOwn && OWN_CONTROLS_CLASS_NAMES)}>
            <PopoverRoot isOpen={isReactionPickerOpen} onOpenChange={setIsReactionPickerOpen}>
                <PopoverTrigger<'button'>
                    type='button'
                    className={`${buttonVariants({ variant: 'ghost', size: 'sm', isIconOnly: true })} ${TRIGGER_CLASS_NAMES}`}
                    title='Add reaction'
                    aria-label='Add reaction'
                    render={(triggerProps) => <button {...triggerProps} />}
                >
                    <Smile size={16} />
                </PopoverTrigger>

                <PopoverContent placement='bottom end' className='bg-transparent shadow-none'>
                    <PopoverDialog aria-label='Add reaction' className='p-0'>
                        <EmojiPicker
                            emojis={COMMON_REACTIONS}
                            onSelect={(emoji) => {
                                onReact(emoji);
                                setIsReactionPickerOpen(false);
                            }}
                        />
                    </PopoverDialog>
                </PopoverContent>
            </PopoverRoot>

            {isOwn && (
                <DropdownRoot>
                    <DropdownTrigger
                        className={`${buttonVariants({ variant: 'ghost', size: 'sm', isIconOnly: true })} ${TRIGGER_CLASS_NAMES}`}
                        aria-label='Open message actions'
                    >
                        <EllipsisVertical size={16} />
                    </DropdownTrigger>

                    <DropdownPopover placement='bottom end'>
                        <DropdownMenu aria-label={`Actions for message ${messageId}`}>
                            <DropdownItem onAction={onEdit}>
                                <SquarePen />
                                Edit
                            </DropdownItem>
                            <DropdownItem variant='danger' onAction={onDelete}>
                                <Trash2 />
                                Delete
                            </DropdownItem>
                        </DropdownMenu>
                    </DropdownPopover>
                </DropdownRoot>
            )}
        </div>
    );
};

export default MessageControls;
