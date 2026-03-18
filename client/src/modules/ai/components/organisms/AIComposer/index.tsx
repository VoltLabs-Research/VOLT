import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Select from '@/shared/presentation/components/Select';
import Tooltip from '@/shared/presentation/components/Tooltip';
import { useId } from 'react';
import { IoAddOutline, IoArrowUpOutline } from 'react-icons/io5';
import type { CSSProperties, KeyboardEvent } from 'react';
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

const VISUALLY_HIDDEN_STYLES: CSSProperties = {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0
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
    const inputId = useId();
    const inputLabelId = useId();
    const statusId = useId();

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

    let statusMessage = 'Composer ready.';
    if (disabled) {
        statusMessage = 'Composer unavailable.';
    }

    if (isSending) {
        statusMessage = 'Sending message.';
    }

    if (error) {
        statusMessage = error;
    }

    return (
        <Container className='d-flex column gap-05 ai-composer'>
            {error && (
                <Paragraph className='font-size-1 color-danger' role='alert' aria-live='assertive'>
                    {error}
                </Paragraph>
            )}

            <label id={inputLabelId} htmlFor={inputId} style={VISUALLY_HIDDEN_STYLES}>
                Message to Volt AI
            </label>

            <span id={statusId} style={VISUALLY_HIDDEN_STYLES} aria-live='polite' aria-atomic='true'>
                {statusMessage}
            </span>

            <Container className='d-flex items-center gap-05 ai-composer-input-wrapper'>
                <Tooltip content='Attachments coming soon'>
                    <button
                        type='button'
                        className='ai-composer-side-icon d-flex flex-center'
                        aria-label='Attachments coming soon'
                        title='Attachments coming soon'
                        disabled
                    >
                        <IoAddOutline size={18} />
                    </button>
                </Tooltip>

                <input
                    id={inputId}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    onKeyDown={handleInputKeyDown}
                    placeholder='Ask anything'
                    className='ai-composer-input flex-1'
                    disabled={disabled}
                    autoComplete='off'
                    enterKeyHint='send'
                    aria-labelledby={inputLabelId}
                    aria-describedby={statusId}
                    aria-invalid={Boolean(error)}
                />

                <Select
                    options={modelOptions}
                    value={selectedModel}
                    onChange={onModelChange}
                    disabled={disabled || modelOptions.length === 0}
                    placeholder={modelPlaceholder}
                    className='ai-composer-model-select'
                    aria-label='Select AI model'
                />

                <Tooltip content='Send message'>
                    <button
                        type='button'
                        className='ai-composer-send d-flex flex-center'
                        disabled={disabled || isSending || !value.trim()}
                        onClick={onSend}
                        aria-label='Send message'
                        title='Send message'
                    >
                        <IoArrowUpOutline size={18} />
                    </button>
                </Tooltip>
            </Container>
        </Container>
    );
};

export default AIComposer;
