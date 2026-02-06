import { useState } from 'react';
import { IoAttachOutline, IoHappyOutline, IoPaperPlaneOutline, IoDocumentOutline, IoCloseOutline } from 'react-icons/io5';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Popover from '@/shared/presentation/components/Popover';
import Button from '@/shared/presentation/components/Button';
import IconButton from '@/shared/presentation/components/IconButton';
import EmojiPicker from '@/shared/presentation/components/EmojiPicker';
import { formatSize } from '@/shared/utils/format';
import useFilePreview from '@/shared/presentation/hooks/use-file-preview';
import './ChatInput.css';

interface ChatInputProps {
    disabled?: boolean;
    onTyping: () => void;
    onSendText: (text: string) => Promise<unknown>;
    onSendFiles: (files: File[]) => Promise<unknown>;
};

const ChatInput = ({ disabled, onTyping, onSendText, onSendFiles }: ChatInputProps) => {
    const [message, setMessage] = useState('');
    const { files, previews, inputRef, removeFile, clear, handleInputChange: handleFileInput, openFilePicker, hasFiles } = useFilePreview();

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() && !hasFiles) return;

        if (hasFiles) {
            await onSendFiles(files);
            clear();
        }

        if (message.trim()) {
            await onSendText(message);
            setMessage('');
        }
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessage(e.target.value);
        onTyping();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend(e);
        }
    };

    return (
        <form onSubmit={handleSend} className='chat-input-container'>
            {previews.length > 0 && (
                <Container className='d-flex column gap-05 y-auto chat-file-previews'>
                    {previews.map((item, index) => (
                        <Container key={index} className='d-flex items-center gap-075 chat-file-preview-item'>
                            {item.preview ? (
                                <img src={item.preview} alt={item.file.name} className='chat-file-preview-thumbnail f-shrink-0' />
                            ) : (
                                <Container className='d-flex flex-center chat-file-preview-icon f-shrink-0'>
                                    <IoDocumentOutline size={20} className='color-muted' />
                                </Container>
                            )}
                            <Container className='d-flex column flex-1 overflow-hidden'>
                                <Paragraph className='font-size-2 font-weight-5 color-primary chat-file-preview-name'>
                                    {item.file.name}
                                </Paragraph>
                                <Paragraph className='font-size-1 color-muted'>
                                    {formatSize(item.file.size)}
                                </Paragraph>
                            </Container>
                            <IconButton size='sm' variant='ghost' onClick={() => removeFile(index)}>
                                <IoCloseOutline size={16} />
                            </IconButton>
                        </Container>
                    ))}
                </Container>
            )}

            <Container className='d-flex items-center gap-05 chat-input-wrapper'>
                <input type='file' ref={inputRef} onChange={handleFileInput} multiple hidden />

                <IconButton size='sm' variant='ghost' onClick={openFilePicker} disabled={disabled} title='Attach File'>
                    <IoAttachOutline size={20} />
                </IconButton>

                <textarea
                    className='flex-1 chat-input-textarea font-size-2-5 color-primary'
                    placeholder='Type a message...'
                    rows={1}
                    value={message}
                    onChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                />

                <Popover
                    id='chat-emoji-picker'
                    trigger={
                        <IconButton size='sm' variant='ghost' disabled={disabled} title='Emoji'>
                            <IoHappyOutline size={20} />
                        </IconButton>
                    }
                >
                    {(close) => (
                        <EmojiPicker
                            onSelect={(emoji: string) => {
                                setMessage((prev) => prev + emoji);
                                close();
                            }}
                        />
                    )}
                </Popover>

                <Button
                    variant='solid'
                    intent='brand'
                    iconOnly
                    type='submit'
                    disabled={disabled || (!message.trim() && !hasFiles)}
                    title='Send'
                >
                    <IoPaperPlaneOutline size={18} />
                </Button>
            </Container>
        </form>
    );
};

export default ChatInput;
