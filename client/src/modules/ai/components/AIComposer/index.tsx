import { Button, ListBox, Select, Tooltip, cn } from '@heroui/react';
import OptionListBoxItem from '@/shared/ui/components/OptionListBoxItem';
import { useEffect, useId, useRef } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import type { AISelectOption } from '@/modules/ai/utils/model-options';
import type { KeyboardEvent } from 'react';

const MAX_TEXTAREA_HEIGHT_PX = 168;

interface AIComposerProps {
    value: string;
    modelOptions: AISelectOption[];
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
        <div className='ai-composer mx-auto flex w-full max-w-[46rem] flex-col gap-1.5 px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] max-md:px-3 [.ai-floating-assistant_&]:px-3 [.ai-floating-assistant_&]:pb-3'>
            {error && (
                <p className='px-1 text-xs text-danger' role='alert' aria-live='assertive'>
                    {error}
                </p>
            )}

            <label htmlFor={inputId} className='sr-only'>Message to Volt AI</label>
            <span className='sr-only' id={statusId} aria-live='polite' aria-atomic='true'>
                {statusMessage}
            </span>

            <div className='flex flex-col gap-1 rounded-xl border border-border bg-surface-secondary px-3 py-2.5 transition-[border-color,box-shadow] duration-200 focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_14%,transparent)]'>
                <textarea
                    id={inputId}
                    ref={textareaRef}
                    rows={1}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder='Ask anything'
                    className='max-h-42 w-full resize-none border-none bg-transparent p-0 text-sm leading-[1.5] text-foreground outline-none [font-family:inherit] placeholder:text-muted focus-visible:outline-none'
                    disabled={disabled}
                    enterKeyHint='send'
                    aria-describedby={statusId}
                    aria-invalid={Boolean(error)}
                />

                <div className='flex flex-row items-center justify-between gap-2'>
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
                        <Select.Trigger className='h-6 min-h-0 w-full rounded-md border-0 bg-transparent px-1 pe-5 text-2xs text-muted shadow-none hover:text-foreground'>
                            <Select.Value className='overflow-hidden text-ellipsis whitespace-nowrap text-2xs'>
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
                                className='flex size-7 min-h-7 min-w-7 shrink-0 items-center justify-center rounded-full border-none bg-danger-soft p-0 text-danger'
                                onPress={onStop}
                                aria-label='Stop generating'
                            >
                                <Square size={13} />
                            </Button>
                            <Tooltip.Content>Stop generating</Tooltip.Content>
                        </Tooltip>
                    ) : (
                        <Button
                            isIconOnly
                            className={cn(
                                'flex size-7 min-h-7 min-w-7 shrink-0 items-center justify-center rounded-full border-none p-0 transition-opacity duration-200',
                                'bg-foreground text-background hover:bg-foreground hover:text-background disabled:opacity-40'
                            )}
                            isDisabled={!canSend}
                            onPress={onSend}
                            aria-label='Send message'
                        >
                            <ArrowUp size={14} />
                        </Button>
                    )}
                </div>
            </div>

            <p className='px-1 text-2xs text-muted max-md:hidden'>
                Enter to send · Shift + Enter for a new line
            </p>
        </div>
    );
};

export default AIComposer;
