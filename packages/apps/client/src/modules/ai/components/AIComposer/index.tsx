import { Button, ListBox, Select, Tooltip } from '@heroui/react';
import OptionListBoxItem from '@/shared/ui/components/OptionListBoxItem';
import { useEffect, useId, useRef } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import type { SelectOption } from '@/shared/contracts/form-field';
import type { KeyboardEvent } from 'react';

const MAX_TEXTAREA_HEIGHT_PX = 168;

// The round 36px action that ends the row: send, or stop while a reply streams.
const ROUND_ACTION_CLASS = 'size-9 min-w-9 shrink-0 rounded-full bg-foreground text-canvas transition-opacity hover:opacity-90 disabled:opacity-40';

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
    const statusId = useId();
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
    }, [value]);

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onSend();
        }
    };

    const canStop = isSending && Boolean(onStop);
    const canSend = !disabled && !isSending && value.trim().length > 0;

    const modelPlaceholder = modelOptions.length ? 'Select model' : 'No models';

    let statusMessage = 'Composer ready.';
    if (disabled) statusMessage = 'Composer unavailable.';
    if (isSending) statusMessage = 'Sending message.';
    if (error) statusMessage = error;

    return (
        <div className='mx-auto flex w-full max-w-3xl flex-col gap-2 px-3 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] [.ai-floating-assistant_&]:p-2'>
            {error && (
                <p className='px-4 text-xs text-danger' role='alert' aria-live='assertive'>
                    {error}
                </p>
            )}

            <label htmlFor={inputId} className='sr-only'>Message to Volt AI</label>
            <span className='sr-only' id={statusId} aria-live='polite' aria-atomic='true'>
                {statusMessage}
            </span>

            <div className='flex flex-row items-end gap-2 rounded-3xl bg-foreground/6 p-2'>
                <textarea
                    id={inputId}
                    ref={textareaRef}
                    rows={1}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder='Ask anything'
                    className='max-h-42 min-w-0 flex-1 resize-none bg-transparent py-1.5 pl-3 text-base leading-6 text-foreground outline-none placeholder:text-muted focus-visible:outline-none'
                    disabled={disabled}
                    enterKeyHint='send'
                    aria-describedby={statusId}
                    aria-invalid={Boolean(error)}
                />

                <Select
                    className='min-w-0 max-w-50'
                    selectedKey={selectedModel}
                    onSelectionChange={(key) => {
                        if (key === null) return;
                        onModelChange(String(key));
                    }}
                    isDisabled={disabled || modelOptions.length === 0}
                    placeholder={modelPlaceholder}
                    aria-label='Select AI model'
                >
                    <Select.Trigger className='h-9 min-h-9 items-center rounded-full border-0 bg-transparent py-0 ps-2.5 text-xs font-medium text-muted shadow-none hover:bg-foreground/8 hover:text-foreground aria-expanded:bg-foreground/8 aria-expanded:text-foreground'>
                        <Select.Value className='truncate text-xs'>
                            {({ isPlaceholder, selectedText, defaultChildren }) => (
                                isPlaceholder ? defaultChildren : selectedText
                            )}
                        </Select.Value>
                        <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                        <ListBox>
                            {modelOptions.map((option) => (
                                <OptionListBoxItem key={option.value} option={option} />
                            ))}
                        </ListBox>
                    </Select.Popover>
                </Select>

                {canStop ? (
                    <Tooltip>
                        <Button
                            isIconOnly
                            className={ROUND_ACTION_CLASS}
                            onPress={onStop}
                            aria-label='Stop generating'
                        >
                            <Square size={14} fill='currentColor' />
                        </Button>
                        <Tooltip.Content>Stop generating</Tooltip.Content>
                    </Tooltip>
                ) : (
                    <Button
                        isIconOnly
                        className={ROUND_ACTION_CLASS}
                        isDisabled={!canSend}
                        onPress={onSend}
                        aria-label='Send message'
                    >
                        <ArrowUp size={18} />
                    </Button>
                )}
            </div>

            <p className='pl-4 text-xs text-muted max-md:hidden [.ai-floating-assistant_&]:hidden'>
                Enter to send · Shift + Enter for a new line
            </p>
        </div>
    );
};

export default AIComposer;
