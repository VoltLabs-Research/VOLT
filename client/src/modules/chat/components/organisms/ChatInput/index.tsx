import { IoAttachOutline, IoHappyOutline, IoPaperPlaneOutline, IoDocumentOutline, IoCloseOutline } from 'react-icons/io5';
import { useId, useState } from 'react';
import { formatSize } from '@/shared/utils/format';
import Button from '@/shared/presentation/components/Button';
import EmojiPicker from '@/shared/presentation/components/EmojiPicker';
import useFilePreview from '@/shared/presentation/hooks/use-file-preview';
import useTip from '@/shared/tips/use-tip';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import IconButton from '@/shared/presentation/components/IconButton';
import Popover from '@/shared/presentation/components/Popover';
import Tooltip from '@/shared/presentation/components/Tooltip';
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react';
import './ChatInput.css';

interface ChatInputProps {
    disabled?: boolean;
    isSending?: boolean;
    onTyping: () => void;
    onSendText: (text: string) => Promise<unknown>;
    onSendFiles: (files: File[]) => Promise<unknown>;
};

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
                } catch (_error) {
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

    const handleEmojiSelect = (close: () => void, emoji: string) => {
        setMessage((prev) => prev + emoji);
        close();
    };

    const renderFilePreviewMedia = (index: number) => {
        const item = previews[index];
        if (!item) return null;

        if (item.preview) {
            return <img src={item.preview} alt={item.file.name} className='chat-file-preview-thumbnail f-shrink-0' />;
        }

        return (
            <Container className='d-flex flex-center chat-file-preview-icon f-shrink-0'>
                <IoDocumentOutline size={20} className='color-muted' />
            </Container>
        );
    };

    const renderEmojiPicker = (close: () => void) => (
        <EmojiPicker onSelect={(emoji: string) => handleEmojiSelect(close, emoji)} />
    );

    const renderFilePreview = (item: typeof previews[number], index: number) => (
        <Container key={index} className='d-flex items-center gap-075 chat-file-preview-item'>
            {renderFilePreviewMedia(index)}
            <Container className='d-flex column flex-1 overflow-hidden'>
                <Paragraph className='font-size-2 font-weight-5 color-primary chat-file-preview-name'>
                    {item.file.name}
                </Paragraph>
                <Paragraph className='font-size-2 color-muted'>
                    {formatSize(item.file.size)}
                </Paragraph>
            </Container>
            <IconButton size='sm' variant='ghost' onClick={() => removeFile(index)} title={`Remove ${item.file.name}`} aria-label={`Remove ${item.file.name}`}>
                <IoCloseOutline size={16} />
            </IconButton>
        </Container>
    );

    return (
        <form onSubmit={handleSend} className='chat-input-container'>
            {previews.length > 0 && (
                <Container className='d-flex column gap-05 y-auto chat-file-previews'>
                    {previews.map(renderFilePreview)}
                </Container>
            )}

            <label htmlFor={textareaId} className='chat-input-visually-hidden'>
                Message
            </label>

            <Container className='d-flex items-center gap-05 chat-input-wrapper'>
                <input type='file' ref={inputRef} onChange={handleFileInput} multiple hidden />

                <Tooltip content='Attach file'>
                    <IconButton size='sm' variant='ghost' onClick={openFilePicker} disabled={isPending} title='Attach file' aria-label='Attach file'>
                        <IoAttachOutline size={20} />
                    </IconButton>
                </Tooltip>

                <textarea
                    id={textareaId}
                    className='flex-1 chat-input-textarea font-size-2 color-primary'
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
                            <IoHappyOutline size={20} />
                        </IconButton>
                    }
                >
                    {renderEmojiPicker}
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
                        <IoPaperPlaneOutline size={18} />
                    </Button>
                </Tooltip>
            </Container>

            <Paragraph id={statusId} className='chat-input-status font-size-2 color-muted' role='status' aria-live='polite'>
                {isPending ? 'Sending message…' : ''}
            </Paragraph>
        </form>
    );
};

export default ChatInput;
