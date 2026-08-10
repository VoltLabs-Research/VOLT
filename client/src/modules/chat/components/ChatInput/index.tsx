import { FileText, Paperclip, Send, Smile, X } from 'lucide-react';
import { useId, useState } from 'react';
import useFilePreview from '@/modules/chat/hooks/use-file-preview';
import { formatSize } from '@/shared/utils/format';
import { Button, PopoverContent, PopoverDialog, PopoverRoot, PopoverTrigger, Tooltip, buttonVariants } from '@heroui/react';
import EmojiPicker from '@/shared/ui/components/EmojiPicker';
import useTip from '@/shared/tips/use-tip';
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react';

interface ChatInputProps {
    disabled?: boolean;
    isSending?: boolean;
    onTyping: () => void;
    onSendText: (text: string) => Promise<unknown>;
    onSendFiles: (files: File[]) => Promise<unknown>;
}

/*
 * The composer's edge is the input: the wrapper carries the border and lights it
 * up on focus-within, and the textarea inside is transparent and borderless. Below
 * 640px the row wraps and the textarea takes a line of its own (`order-4`), which
 * puts the three controls above it.
 */
const WRAPPER_CLASS_NAMES = 'flex flex-row items-center gap-2 min-w-0 px-3 py-2 rounded-2xl border border-border transition-colors duration-200 focus-within:border-accent max-[640px]:flex-wrap max-[640px]:items-start max-[640px]:p-2.5';

const TEXTAREA_CLASS_NAMES = 'flex-1 min-w-0 min-h-11 py-2 resize-none bg-transparent outline-none [font-family:inherit] text-sm text-foreground max-[640px]:order-4 max-[640px]:basis-full max-[640px]:w-full';

/* bravais sized the composer's controls to the 44px touch target. */
const CONTROL_CLASS_NAMES = 'size-11';

const ChatInput = ({ disabled, isSending = false, onTyping, onSendText, onSendFiles }: ChatInputProps) => {
    useTip('chat-file-attachments');

    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    const { files, previews, inputRef, removeFile, clear, handleInputChange: handleFileInput, openFilePicker, hasFiles } = useFilePreview();
    const textareaId = useId();
    const statusId = `${textareaId}-status`;
    const isPending = disabled || isSending || isSubmitting;

    const handleSend = async (e: FormEvent) => {
        e.preventDefault();
        if (isPending || (!message.trim() && !hasFiles)) return;

        setIsSubmitting(true);
        try {
            if (hasFiles) {
                try {
                    await onSendFiles(files);
                    clear();
                } catch {
                    return;
                }
            }

            if (message.trim()) {
                await onSendText(message);
                setMessage('');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        setMessage(e.target.value);
        onTyping();
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend(e);
        }
    };

    const renderFilePreview = (item: typeof previews[number], index: number) => (
        <div className='flex flex-row items-center gap-3 p-2 rounded-lg border border-border bg-surface-tertiary' key={index}>
            {item.preview ? (
                <img src={item.preview} alt={item.file.name} className='shrink-0 size-12 rounded-md bg-default object-cover' />
            ) : (
                <div className='flex shrink-0 items-center justify-center size-12 rounded-md bg-default'>
                    <FileText size={20} className='text-muted' />
                </div>
            )}
            <div className='flex flex-col overflow-hidden flex-1'>
                <p className='text-sm font-medium truncate max-w-[150px] max-[640px]:max-w-none'>
                    {item.file.name}
                </p>
                <p className='text-sm text-muted'>
                    {formatSize(item.file.size)}
                </p>
            </div>
            <Button size='sm' variant='ghost' isIconOnly onPress={() => removeFile(index)} aria-label={`Remove ${item.file.name}`}>
                <X size={16} />
            </Button>
        </div>
    );

    return (
        <form onSubmit={handleSend} className='px-6 py-4 border-t border-border max-[640px]:px-4 max-[640px]:py-3.5'>
            {previews.length > 0 && (
                <div className='flex flex-col gap-2 overflow-y-auto max-h-[150px] mb-3'>
                    {previews.map(renderFilePreview)}
                </div>
            )}

            <label htmlFor={textareaId} className='sr-only'>
                Message
            </label>

            <div className={WRAPPER_CLASS_NAMES}>
                <input type='file' ref={inputRef} onChange={handleFileInput} multiple hidden />

                <Tooltip>
                    <Button size='sm' variant='ghost' isIconOnly className={CONTROL_CLASS_NAMES} onPress={openFilePicker} isDisabled={isPending} aria-label='Attach file'>
                        <Paperclip size={20} />
                    </Button>
                    <Tooltip.Content>Attach file</Tooltip.Content>
                </Tooltip>

                <textarea
                    id={textareaId}
                    className={TEXTAREA_CLASS_NAMES}
                    placeholder='Type a message...'
                    rows={1}
                    value={message}
                    onChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                    disabled={isPending}
                    aria-describedby={isPending ? statusId : undefined}
                />

                {/*
                  * The trigger stays a real `<button>` rather than a HeroUI `Button`
                  * inside `PopoverTrigger`: the trigger part is a `div role='button'`,
                  * so nesting a button inside it would give the picker two of them.
                  * `buttonVariants` supplies the same chrome a ghost icon button has.
                  */}
                <PopoverRoot isOpen={isEmojiPickerOpen} onOpenChange={setIsEmojiPickerOpen}>
                    <PopoverTrigger<'button'>
                        type='button'
                        className={`${buttonVariants({ variant: 'ghost', size: 'sm', isIconOnly: true })} ${CONTROL_CLASS_NAMES}`}
                        disabled={isPending}
                        title='Open emoji picker'
                        aria-label='Open emoji picker'
                        render={(triggerProps) => <button {...triggerProps} />}
                    >
                        <Smile size={20} />
                    </PopoverTrigger>

                    <PopoverContent placement='top end' className='bg-transparent shadow-none'>
                        <PopoverDialog aria-label='Emoji picker' className='p-0'>
                            <EmojiPicker onSelect={(emoji: string) => {
                                setMessage((previous) => previous + emoji);
                                setIsEmojiPickerOpen(false);
                            }} />
                        </PopoverDialog>
                    </PopoverContent>
                </PopoverRoot>

                <Tooltip>
                    <Button
                        variant='primary'
                        isIconOnly
                        className={CONTROL_CLASS_NAMES}
                        type='submit'
                        isDisabled={isPending || (!message.trim() && !hasFiles)}
                        isPending={isPending}
                        aria-label='Send message'
                        aria-describedby={isPending ? statusId : undefined}
                    >
                        <Send size={18} />
                    </Button>
                    <Tooltip.Content>Send</Tooltip.Content>
                </Tooltip>
            </div>

            <p className='text-sm text-muted min-h-6 mt-2' id={statusId} role='status' aria-live='polite'>
                {isPending ? 'Sending message…' : ''}
            </p>
        </form>
    );
};

export default ChatInput;
