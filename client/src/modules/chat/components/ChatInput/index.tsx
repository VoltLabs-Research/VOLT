import { FileText, Paperclip, Send, Smile, X } from 'lucide-react';
import { useId, useState } from 'react';
import useFilePreview from '@/modules/chat/hooks/use-file-preview';
import { formatSize } from '@/shared/utils/format';
import { Button, IconButton, Popover, Tooltip } from '@voltstack/bravais';
import EmojiPicker from '@/shared/ui/components/EmojiPicker';
import useTip from '@/shared/tips/use-tip';
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react';
import './ChatInput.css';

interface ChatInputProps {
    disabled?: boolean;
    isSending?: boolean;
    onTyping: () => void;
    onSendText: (text: string) => Promise<unknown>;
    onSendFiles: (files: File[]) => Promise<unknown>;
}

const ChatInput = ({ disabled, isSending = false, onTyping, onSendText, onSendFiles }: ChatInputProps) => {
    useTip('chat-file-attachments');

    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
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
        <div className='flex flex-row items-center gap-3 chat-file-preview-item' key={index}>
            {item.preview ? (
                <img src={item.preview} alt={item.file.name} className='chat-file-preview-thumbnail shrink-0' />
            ) : (
                <div className='flex shrink-0 items-center justify-center chat-file-preview-icon'>
                    <FileText size={20} className='text-muted' />
                </div>
            )}
            <div className='flex flex-col overflow-hidden flex-1'>
                <p className='text-sm font-medium chat-file-preview-name'>
                    {item.file.name}
                </p>
                <p className='text-sm text-muted'>
                    {formatSize(item.file.size)}
                </p>
            </div>
            <IconButton size='sm' variant='ghost' onClick={() => removeFile(index)} title={`Remove ${item.file.name}`} aria-label={`Remove ${item.file.name}`}>
                <X size={16} />
            </IconButton>
        </div>
    );

    return (
        <form onSubmit={handleSend} className='chat-input-container'>
            {previews.length > 0 && (
                <div className='flex flex-col gap-2 overflow-y-auto chat-file-previews'>
                    {previews.map(renderFilePreview)}
                </div>
            )}

            <label htmlFor={textareaId} className='sr-only'>
                Message
            </label>

            <div className='flex flex-row items-center gap-2 chat-input-wrapper'>
                <input type='file' ref={inputRef} onChange={handleFileInput} multiple hidden />

                <Tooltip content='Attach file'>
                    <IconButton size='sm' variant='ghost' onClick={openFilePicker} disabled={isPending} title='Attach file' aria-label='Attach file'>
                        <Paperclip size={20} />
                    </IconButton>
                </Tooltip>

                <textarea
                    id={textareaId}
                    className='flex-1 chat-input-textarea text-sm text-foreground'
                    placeholder='Type a message...'
                    rows={1}
                    value={message}
                    onChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                    disabled={isPending}
                    aria-describedby={isPending ? statusId : undefined}
                />

                <Popover
                    id='chat-emoji-picker'
                    trigger={
                        <IconButton size='sm' variant='ghost' disabled={isPending} title='Open emoji picker' aria-label='Open emoji picker'>
                            <Smile size={20} />
                        </IconButton>
                    }
                >
                    {(close: () => void) => (
                        <EmojiPicker onSelect={(emoji: string) => {
                            setMessage((previous) => previous + emoji);
                            close();
                        }} />
                    )}
                </Popover>

                <Tooltip content='Send'>
                    <Button
                        variant='solid'
                        intent='brand'
                        iconOnly
                        type='submit'
                        disabled={isPending || (!message.trim() && !hasFiles)}
                        isLoading={isPending}
                        title='Send message'
                        aria-label='Send message'
                        aria-describedby={isPending ? statusId : undefined}
                    >
                        <Send size={18} />
                    </Button>
                </Tooltip>
            </div>

            <p className='text-sm text-muted chat-input-status' id={statusId} role='status' aria-live='polite'>
                {isPending ? 'Sending message…' : ''}
            </p>
        </form>
    );
};

export default ChatInput;
