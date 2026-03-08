import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Select from '@/shared/presentation/components/Select';
import Tooltip from '@/shared/presentation/components/Tooltip';
import { IoAddOutline, IoArrowUpOutline } from 'react-icons/io5';
import type { KeyboardEvent } from 'react';
import type { SelectOption } from '@/shared/presentation/components/Select';
import './AIComposer.css';

interface AIComposerProps {
    value: string;
    modelOptions: SelectOption[];
    selectedModel: string | null;
    disabled?: boolean;
    isSending?: boolean;
    error?: string | null;
    onChange: (message: string) => void;
    onModelChange: (model: string) => void;
    onSend: () => void;
};

const AIComposer = ({
    value,
    modelOptions,
    selectedModel,
    disabled = false,
    isSending = false,
    error,
    onChange,
    onModelChange,
    onSend
}: AIComposerProps) => {
    const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            onSend();
        }
    };

    let modelPlaceholder = 'No models';
    if (modelOptions.length) {
        modelPlaceholder = 'Select model';
    }

    return (
        <Container className='d-flex column gap-05 ai-composer'>
            {error && (
                <Paragraph className='font-size-1 color-danger'>{error}</Paragraph>
            )}

            <Container className='d-flex items-center gap-05 ai-composer-input-wrapper'>
                <button
                    type='button'
                    className='ai-composer-side-icon d-flex flex-center'
                    aria-label='Attach'
                    disabled={disabled}
                >
                    <IoAddOutline size={18} />
                </button>

                <input
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    onKeyDown={handleInputKeyDown}
                    placeholder='Ask anything'
                    className='ai-composer-input flex-1'
                    disabled={disabled}
                />

                <Select
                    options={modelOptions}
                    value={selectedModel}
                    onChange={onModelChange}
                    disabled={disabled || modelOptions.length === 0}
                    placeholder={modelPlaceholder}
                    className='ai-composer-model-select'
                />

                <Tooltip content='Send message'>
                    <button
                        type='button'
                        className='ai-composer-send d-flex flex-center'
                        disabled={disabled || isSending || !value.trim()}
                        onClick={onSend}
                    >
                        <IoArrowUpOutline size={18} />
                    </button>
                </Tooltip>
            </Container>
        </Container>
    );
};

export default AIComposer;
