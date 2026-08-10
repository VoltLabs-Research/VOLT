import { IconButton, Select, Tooltip } from '@voltstack/bravais';
import type { SelectOption } from '@voltstack/bravais';
import { useId } from 'react';
import { ArrowUp, Square } from 'lucide-react';
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
    onStop?: () => void;
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
    onSend,
    onStop
}: AIComposerProps) => {
    const inputId = useId();
    const inputLabelId = useId();
    const statusId = useId();

    const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onSend();
        }
    };

    const canStop = isSending && Boolean(onStop);

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
        <div className='flex flex-col gap-2 ai-composer'>
            {error && (
                <p className='text-xs text-danger' role='alert' aria-live='assertive'>
                    {error}
                </p>
            )}

            <label id={inputLabelId} htmlFor={inputId} className='sr-only'>
                Message to Volt AI
            </label>

            <span className='sr-only' id={statusId} aria-live='polite' aria-atomic='true'>
                {statusMessage}
            </span>

            <div className='flex flex-row items-center gap-2 ai-composer-input-wrapper'>
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

                {canStop ? (
                    <Tooltip content='Stop generating'>
                        <IconButton
                            className='ai-composer-send ai-composer-stop'
                            onClick={onStop}
                            aria-label='Stop generating'
                            title='Stop generating'
                        >
                            <Square size={18} />
                        </IconButton>
                    </Tooltip>
                ) : (
                    <Tooltip content='Send message'>
                        <IconButton
                            className='ai-composer-send'
                            disabled={disabled || isSending || !value.trim()}
                            onClick={onSend}
                            aria-label='Send message'
                            title='Send message'
                        >
                            <ArrowUp size={18} />
                        </IconButton>
                    </Tooltip>
                )}
            </div>
        </div>
    );
};

export default AIComposer;
