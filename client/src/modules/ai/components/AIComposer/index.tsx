import { IconButton, Select, VisuallyHidden, Row, Stack, Text, Tooltip } from '@voltstack/bravais';
import type { SelectOption } from '@voltstack/bravais';
import { useId } from 'react';
import { IoAddOutline, IoArrowUpOutline } from 'react-icons/io5';
import type { KeyboardEvent } from 'react';
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
}

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
        <Stack gap='05' className='ai-composer'>
            {error && (
                <Text as='p' size='sm' className='color-danger' role='alert' aria-live='assertive'>
                    {error}
                </Text>
            )}

            <label id={inputLabelId} htmlFor={inputId} className='sr-only'>
                Message to Volt AI
            </label>

            <VisuallyHidden id={statusId} aria-live='polite' aria-atomic='true'>
                {statusMessage}
            </VisuallyHidden>

            <Row gap='05' className='ai-composer-input-wrapper'>
                <Tooltip content='Attachments coming soon'>
                    <IconButton
                        className='ai-composer-side-icon'
                        aria-label='Attachments coming soon'
                        title='Attachments coming soon'
                        disabled
                    >
                        <IoAddOutline size={18} />
                    </IconButton>
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
                    <IconButton
                        className='ai-composer-send'
                        disabled={disabled || isSending || !value.trim()}
                        onClick={onSend}
                        aria-label='Send message'
                        title='Send message'
                    >
                        <IoArrowUpOutline size={18} />
                    </IconButton>
                </Tooltip>
            </Row>
        </Stack>
    );
};

export default AIComposer;
