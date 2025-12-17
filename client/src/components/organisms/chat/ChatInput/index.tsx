import React, { useRef, useState } from 'react';
import { IoAttachOutline, IoHappyOutline, IoPaperPlaneOutline } from 'react-icons/io5';
import EmojiPicker from '@/components/atoms/chat/EmojiPicker';
import Button from '@/components/primitives/Button';
import './ChatInput.css';

type Preview = {
    file: File;
    preview: string
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

    const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newFiles = Array.from(e.target.files || []);
        if (!newFiles.length) return;
        setFiles((prev) => [...prev, ...newFiles]);

        newFiles.filter(f => f.type.startsWith('image/')).forEach(file => {
            const reader = new FileReader();
            reader.onload = ev => setPreviews((prev) => [...prev, { file, preview: ev.target?.result as string }]);
            reader.readAsDataURL(file);
        });
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
            <div className='d-flex items-center gap-075 chat-input-wrapper p-relative overflow-hidden'>
                <input
                    type='file'
                    ref={fileRef}
                    onChange={handleSelectFiles}
                    multiple
                    style={{ display: 'none' }} />

                <Button
                    variant='ghost'
                    intent='neutral'
                    iconOnly
                    size='sm'
                    title='Attach File'
                    onClick={() => fileRef.current?.click()}
                >
                    <IoAttachOutline />
                </Button>

                <textarea
                    className='chat-input y-auto flex-1 font-size-3 font-weight-4 color-primary line-height-5'
                    placeholder='Type a message...'
                    rows={1}
                    value={message}
                    onChange={handleChatInputChange}
                    disabled={disabled}
                />

                <Button
                    variant='ghost'
                    intent='neutral'
                    iconOnly
                    size='sm'
                    title='Emoji'
                    onClick={() => setShowPicker(v => !v)}
                >
                    <IoHappyOutline />
                </Button>

                <Button
                    variant='solid'
                    intent='brand'
                    iconOnly
                    type='submit'
                    title='Send Message'
                    disabled={disabled || (!message.trim() && files.length === 0)}
                >
                    <IoPaperPlaneOutline />
                </Button>
            </div>

            {showPicker && (
                <EmojiPicker
                    onSelect={(e) => { setMessage((m) => m + e); setShowPicker(false); }}
                    onClose={() => setShowPicker(false)}
                />
            )}

            {previews.length > 0 && (
                <div className='chat-file-previews-container'>
                    <div className='d-flex items-center content-between chat-file-previews-header font-weight-6 color-primary'>
                        <span>Archivos seleccionados({previews.length})</span>
                        <Button
                            variant='ghost'
                            intent='neutral'
                            iconOnly
                            size='sm'
                            onClick={handleClearFiles}
                        >✕</Button>
                    </div>
                    <div className='chat-file-previews-grid gap-075'>
                        {previews.map((item, index) => (
                            <div key={index} className='chat-file-preview-item p-relative'>
                                <img src={item.preview} alt={item.file.name} className='chat-file-preview-image w-max' />
                                <div className='d-flex column gap-025 chat-file-preview-info'>
                                    <span className='chat-file-preview-name overflow-hidden font-size-1 font-weight-6 color-primary'>{item.file.name}</span>
                                    <span className='chat-file-preview-size color-muted'>{(item.file.size / 1024).toFixed(1)} KB</span>
                                </div>
                                <Button
                                    variant='ghost'
                                    intent='danger'
                                    iconOnly
                                    size='sm'
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
        </form>
    );
};

export default ChatInput;
