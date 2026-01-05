import React, { useRef, useState } from 'react';
import { IoAttachOutline, IoHappyOutline, IoPaperPlaneOutline, IoDocumentTextOutline, IoImageOutline } from 'react-icons/io5';
import EmojiPicker from '@/components/atoms/chat/EmojiPicker';
import Button from '@/components/primitives/Button';
import Tooltip from '@/components/atoms/common/Tooltip';
import { formatSize } from '@/utilities/glb/scene-utils';
import './ChatInput.css';

type Preview = {
    file: File;
    preview: string;
};

export type ChatInputProps = {
    onTyping: () => void;
    onSendText: (text: string) => Promise<void> | void;
    onSendFiles: (files: File[]) => Promise<void> | void;
    disabled?: boolean;
};

const ChatInput = ({
    onTyping,
    onSendText,
    onSendFiles,
    disabled
}: ChatInputProps) => {
    const [message, setMessage] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<Preview[]>([]);
    const [showPicker, setShowPicker] = useState(false);

    const fileRef = useRef<HTMLInputElement>(null);

    const handleSelectFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const newFiles = Array.from(e.target.files || []);
        if (!newFiles.length) return;

        setFiles((prev) => [...prev, ...newFiles]);

        const newPreviews = await Promise.all(newFiles.map(file => {
            return new Promise<Preview>((resolve) => {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = ev => resolve({ file, preview: ev.target?.result as string });
                    reader.readAsDataURL(file);
                } else {
                    resolve({ file, preview: '' });
                }
            });
        }));

        setPreviews((prev) => [...prev, ...newPreviews]);
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!message.trim() && files.length === 0) return;

        if (files.length) {
            await onSendFiles(files);
            setFiles([]);
            setPreviews([]);
        }

        if (message.trim()) {
            await onSendText(message);
            setMessage('');
        }
    };

    const handleChatInputChange = (e: any) => {
        setMessage(e.target.value);
        onTyping();
    };

    const handleClearFiles = () => {
        setFiles([]);
        setPreviews([]);
    };

    return (
        <form onSubmit={handleSend} className='chat-input-container p-relative'>
            {previews.length > 0 && (
                <div className='chat-file-previews-container mb-1'>
                    <div className='d-flex column gap-05'>
                        {previews.map((item, index) => (
                            <div key={index} className='chat-file-preview-item d-flex items-center gap-075 p-relative'>
                                <div className='f-shrink-0'>
                                    {item.file.type.startsWith('image/') && item.preview ? (
                                        <div className='chat-file-preview-image-container overflow-hidden border-radius-sm border-soft'>
                                            <img src={item.preview} alt={item.file.name} className='chat-file-preview-image w-max h-max' />
                                        </div>
                                    ) : (
                                        <div className='chat-file-preview-icon d-flex items-center content-center bg-surface-3 color-primary border-radius-sm border-soft font-size-4'>
                                            <IoDocumentTextOutline />
                                        </div>
                                    )}
                                </div>
                                <div className='d-flex column gap-025 flex-1 min-w-0'>
                                    <span className='chat-file-preview-name overflow-hidden text-ellipsis font-size-2 font-weight-5 color-primary'>
                                        {item.file.name}
                                    </span>
                                    <span className='chat-file-preview-size font-size-1 color-secondary'>
                                        {formatSize(item.file.size)}
                                    </span>
                                </div>
                                <Button
                                    variant='ghost'
                                    intent='danger'
                                    iconOnly
                                    size='sm'
                                    className='chat-file-preview-remove'
                                    onClick={() => {
                                        setFiles(prev => prev.filter((_, i) => i !== index));
                                        setPreviews(prev => prev.filter((_, i) => i !== index));
                                    }}
                                >✕</Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className='d-flex items-center gap-075 chat-input-wrapper p-relative overflow-hidden'>
                <input
                    type='file'
                    ref={fileRef}
                    onChange={handleSelectFiles}
                    multiple
                    style={{ display: 'none' }} />

                <Tooltip content="Attach File" placement="top">
                    <Button
                        variant='ghost'
                        intent='neutral'
                        iconOnly
                        size='sm'
                        onClick={() => fileRef.current?.click()}
                    >
                        <IoAttachOutline />
                    </Button>
                </Tooltip>

                <textarea
                    className='chat-input y-auto flex-1 font-size-3 font-weight-4 color-primary line-height-5'
                    placeholder='Type a message...'
                    rows={1}
                    value={message}
                    onChange={handleChatInputChange}
                    disabled={disabled}
                />

                <Tooltip content="Emoji" placement="top">
                    <Button
                        variant='ghost'
                        intent='neutral'
                        iconOnly
                        size='sm'
                        onClick={() => setShowPicker(v => !v)}
                    >
                        <IoHappyOutline />
                    </Button>
                </Tooltip>

                <Tooltip content="Send Message" placement="top">
                    <Button
                        variant='solid'
                        intent='brand'
                        iconOnly
                        type='submit'
                        disabled={disabled || (!message.trim() && files.length === 0)}
                    >
                        <IoPaperPlaneOutline />
                    </Button>
                </Tooltip>
            </div>

            {showPicker && (
                <EmojiPicker
                    onSelect={(e) => { setMessage((m) => m + e); setShowPicker(false); }}
                    onClose={() => setShowPicker(false)}
                />
            )}
        </form>
    );
};

export default ChatInput;

