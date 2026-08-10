import { Button, Description, Label, ListBox, Select, Tooltip } from '@heroui/react';
import { useId } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import type { AISelectOption } from '@/modules/ai/utils/model-options';
import type { KeyboardEvent } from 'react';

/**
 * `[.ai-floating-assistant_&]:` is the ancestor-flag form of what
 * `AIFloatingAssistantPanel.css` used to do with a descendant selector
 * (`.ai-floating-assistant .ai-composer { padding: … }`). It has to be a variant rather
 * than a plain class: once the composer's own rules are utilities, a same-specificity
 * descendant rule in a stylesheet would no longer reliably outrank them.
 */
const COMPOSER = 'ai-composer m-auto flex w-[min(880px,100%)] flex-col gap-2 border-t-0 bg-transparent px-4 pt-[0.8rem] pb-[calc(1.1rem+env(safe-area-inset-bottom,0px))] max-md:px-3 [.ai-floating-assistant_&]:p-3 [.ai-floating-assistant_&]:pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]';

const INPUT_WRAPPER = 'flex min-h-12 flex-row items-center gap-2 rounded-full border border-border bg-[var(--field-background,var(--surface-secondary))] py-2 pr-[0.55rem] pl-3 transition-[border-color,box-shadow,background-color] duration-200 focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)] max-md:gap-[0.35rem] [.ai-floating-assistant_&]:overflow-hidden';

const INPUT = 'min-h-8 flex-1 border-none bg-transparent p-0 leading-[1.45] text-foreground outline-none [font-family:inherit] placeholder:text-muted focus-visible:outline-none';

const MODEL_SELECT_ROOT = 'min-w-[132px] max-w-[180px] shrink-0 max-md:max-w-[132px] [.ai-floating-assistant_&]:min-w-0 [.ai-floating-assistant_&]:max-w-[120px]';

/**
 * `pe-6` is not decoration: `Select.Indicator` is positioned absolutely at `end-2`
 * with `size-4`, so the value needs inline-end room or the chevron sits on the text.
 */
const MODEL_SELECT_TRIGGER = 'h-[1.9rem] min-h-0 w-full rounded-full border-0 bg-transparent px-[0.6rem] pe-6 text-[0.78rem] text-foreground shadow-none';

const MODEL_SELECT_VALUE = 'overflow-hidden text-ellipsis whitespace-nowrap text-[0.78rem]';

const ACTION_BUTTON = 'flex size-8 min-h-8 min-w-8 max-w-8 shrink-0 items-center justify-center rounded-full border-none p-0 transition-opacity duration-200 disabled:opacity-50';

const SEND_TONE = 'bg-foreground text-background hover:bg-foreground hover:text-background';

/**
 * `animate-pulse` at 1.4s stands in for the old `ai-composer-stop-pulse` keyframes
 * (opacity 1 → 0.65 → 1); Tailwind's trough is 0.5 rather than 0.65. The global
 * reduced-motion block in `index.css` neutralises it, which is what the sheet's own
 * `prefers-reduced-motion` opt-out did.
 */
const STOP_TONE = 'bg-danger-soft text-danger animate-pulse animation-duration-[1400ms]';

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
        <div className={COMPOSER}>
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

            <div className={INPUT_WRAPPER}>
                <input
                    id={inputId}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    onKeyDown={handleInputKeyDown}
                    placeholder='Ask anything'
                    className={INPUT}
                    disabled={disabled}
                    autoComplete='off'
                    enterKeyHint='send'
                    aria-labelledby={inputLabelId}
                    aria-describedby={statusId}
                    aria-invalid={Boolean(error)}
                />

                <Select
                    className={MODEL_SELECT_ROOT}
                    selectedKey={selectedModel}
                    onSelectionChange={(key) => {
                        if (key === null) return;

                        onModelChange(String(key));
                    }}
                    isDisabled={disabled || modelOptions.length === 0}
                    placeholder={modelPlaceholder}
                    aria-label='Select AI model'
                >
                    <Select.Trigger className={MODEL_SELECT_TRIGGER}>
                        {/*
                          * bravais's trigger rendered the selected option's `title` only;
                          * RAC's default children render the whole item, so a
                          * `description` would leak into the trigger.
                          */}
                        <Select.Value className={MODEL_SELECT_VALUE}>
                            {({ isPlaceholder, selectedText, defaultChildren }) => (
                                isPlaceholder ? defaultChildren : selectedText
                            )}
                        </Select.Value>
                        <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                        <ListBox>
                            {modelOptions.map((option) => (
                                <ListBox.Item key={option.value} id={option.value} textValue={option.title}>
                                    <ListBox.ItemIndicator />
                                    <Label>{option.title}</Label>
                                    {option.description && <Description>{option.description}</Description>}
                                </ListBox.Item>
                            ))}
                        </ListBox>
                    </Select.Popover>
                </Select>

                {canStop ? (
                    <Tooltip>
                        <Button
                            isIconOnly
                            className={`${ACTION_BUTTON} ${STOP_TONE}`}
                            onPress={onStop}
                            aria-label='Stop generating'
                        >
                            <Square size={18} />
                        </Button>
                        <Tooltip.Content>Stop generating</Tooltip.Content>
                    </Tooltip>
                ) : (
                    <Tooltip>
                        <Button
                            isIconOnly
                            className={`${ACTION_BUTTON} ${SEND_TONE}`}
                            isDisabled={disabled || isSending || !value.trim()}
                            onPress={onSend}
                            aria-label='Send message'
                        >
                            <ArrowUp size={18} />
                        </Button>
                        <Tooltip.Content>Send message</Tooltip.Content>
                    </Tooltip>
                )}
            </div>
        </div>
    );
};

export default AIComposer;
