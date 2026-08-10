import { Button, cn } from '@heroui/react';
import { copyTextToClipboard } from '@/shared/ui/utils/copy-to-clipboard';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

/**
 * bravais's `KeyValueList` / `KeyValueRow`, re-expressed as plain elements plus
 * utilities. Four call sites in this module used them (the inspector list, the
 * overview's env/port cards and the create-container review step), so the two
 * shapes live here once rather than being inlined four times.
 *
 * Three details of the originals are load-bearing and are reproduced exactly:
 *
 *   1. **The divider is on the child, via the adjacent-sibling combinator.**
 *      `.volt-kv-list--dividers > * + * { border-top: … }` is the only rule the
 *      list ever had, which is why the first row has no top rule and why
 *      conditionally-rendered rows re-index for free. `[&>*+*]:border-t` is the
 *      same selector, so wrapping rows in a container still collapses the
 *      dividers to one — the behaviour a per-row `borderTop` prop would quietly
 *      change.
 *   2. **The row has a hidden responsive layout.** Below 480px it becomes a
 *      left-aligned column with a 0.25rem gap and the value loses its right
 *      alignment. That lived only in `KeyValueList.css` and is invisible in the
 *      class names, so it is restated here as `max-[480px]:*` variants.
 *   3. **The value breaks words.** `word-break: break-word; overflow-wrap:
 *      break-word` is what keeps long container ids and image digests wrapping
 *      instead of overflowing the card.
 *
 * Type sizes convert by value, not by name: bravais's `text-sm` was 0.75rem,
 * which is stock Tailwind's `text-xs`.
 */
const LIST_CLASS_NAMES = 'flex flex-col';
const LIST_DIVIDERS_CLASS_NAMES = '[&>*+*]:border-t [&>*+*]:border-border';

const ROW_CLASS_NAMES = 'flex min-w-0 flex-row items-center justify-between gap-4 py-2.5 max-[480px]:flex-col max-[480px]:items-start max-[480px]:gap-1';
const ROW_LABEL_CLASS_NAMES = 'min-w-0 shrink-0 text-xs text-muted';
const ROW_VALUE_GROUP_CLASS_NAMES = 'flex min-w-0 flex-row items-center gap-2';
const ROW_VALUE_CLASS_NAMES = 'min-w-0 break-words text-right text-xs font-medium text-foreground max-[480px]:text-left';

/**
 * bravais held the confirmation for 1400ms and swapped `Copy` for `Check`; the
 * accessible name flips with it, which is the only thing a screen reader hears
 * since the icon change is silent. `copyTextToClipboard` is the app's own helper
 * and still fires the sileo toast bravais's copy button fired.
 */
const COPIED_RESET_DELAY_MS = 1400;

interface ContainerKeyValueListProps {
    dividers?: boolean;
    className?: string;
    children?: ReactNode;
};

export const ContainerKeyValueList = ({ dividers = true, className, children }: ContainerKeyValueListProps) => (
    <div className={cn(LIST_CLASS_NAMES, dividers && LIST_DIVIDERS_CLASS_NAMES, className)}>
        {children}
    </div>
);

interface ContainerKeyValueRowProps {
    label: ReactNode;
    value: ReactNode;
    copyValue?: string;
    action?: ReactNode;
    tabular?: boolean;
    className?: string;
};

export const ContainerKeyValueRow = ({
    label,
    value,
    copyValue,
    action,
    tabular = false,
    className
}: ContainerKeyValueRowProps) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        if (!copyValue) {
            return;
        }

        const isCopied = await copyTextToClipboard(copyValue);

        if (!isCopied) {
            return;
        }

        setCopied(true);
        setTimeout(() => setCopied(false), COPIED_RESET_DELAY_MS);
    };

    return (
        <div className={cn(ROW_CLASS_NAMES, className)}>
            <span className={ROW_LABEL_CLASS_NAMES}>{label}</span>
            <div className={ROW_VALUE_GROUP_CLASS_NAMES}>
                <span className={cn(ROW_VALUE_CLASS_NAMES, tabular && 'tabular-nums')}>{value}</span>
                {copyValue && (
                    <Button
                        variant='ghost'
                        size='sm'
                        isIconOnly
                        aria-label={copied ? 'Copied' : 'Copy value'}
                        onPress={() => { void handleCopy(); }}
                    >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                    </Button>
                )}
                {action}
            </div>
        </div>
    );
};
