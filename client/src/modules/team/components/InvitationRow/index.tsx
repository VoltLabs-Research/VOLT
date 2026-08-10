import { Button, Spinner } from '@heroui/react';
import { getAvatarColorFromString, getInitialsFromEmail } from '@/shared/utils/user';
import { format } from 'date-fns';

interface InvitationRowProps {
    email: string;
    createdAt: Date | string;
    onCancel: () => void;
    isLoading?: boolean;
}

/**
 * bravais's `ListRow` with neither `onClick` nor `to`, which rendered a passive
 * `<div>`. Its chrome came from two stylesheets that are both being deleted, so it
 * is restated here as utilities:
 *
 *   `.volt-list-row`           flex row, `items-center`, `gap-3`, `w-full`, `p-3`, a
 *                              1px transparent border (so a selected state could
 *                              colour it without shifting layout), `--radius-md`
 *                              (12px → `rounded-xl`), transparent background,
 *                              `text-align: left`, `cursor: pointer`.
 *   `.list-item-hoverable`     the hover feedback — `--color-surface-2`
 *                              (`bg-surface-tertiary`), gated behind
 *                              `@media (hover: hover)`, which Tailwind's `hover:`
 *                              already implies.
 *   `.volt-list-row__content`  `flex-col gap-0.5 flex-1 min-w-0` — the `min-w-0` is
 *                              what makes the two `truncate`s work at all.
 *   `.volt-list-row__trailing` `inline-flex gap-2 shrink-0 ms-auto text-muted`.
 *
 * `.invitation-row`'s own `--color-surface-1` fill is `bg-surface-secondary`, and
 * `.invitation-avatar`'s 36px / white / 0.875rem is `size-9 text-white text-sm`.
 * The leading slot keeps the `aria-hidden` bravais put on it.
 */
export const InvitationRow = ({
    email,
    createdAt,
    onCancel,
    isLoading = false
}: InvitationRowProps) => {
    return (
        <div className='flex flex-row items-center gap-3 w-full p-3 rounded-xl border border-transparent bg-surface-secondary text-left cursor-pointer transition-colors duration-200 ease-out hover:bg-surface-tertiary'>
            <div className='flex flex-row items-center shrink-0' aria-hidden='true'>
                <div
                    className='flex items-center justify-center rounded-full shrink-0 size-9 text-white text-sm font-medium'
                    style={{ backgroundColor: getAvatarColorFromString(email) }}
                >
                    {getInitialsFromEmail(email)}
                </div>
            </div>

            <div className='flex flex-col gap-0.5 flex-1 min-w-0'>
                <span className='text-sm font-medium text-foreground truncate'>
                    {email}
                </span>
                <span className='text-xs text-muted truncate'>
                    {`Sent ${format(new Date(createdAt), 'MMM d, h:mm a')}`}
                </span>
            </div>

            <div className='inline-flex gap-2 shrink-0 ms-auto text-muted'>
                <Button
                    variant='ghost'
                    size='sm'
                    onPress={onCancel}
                    isDisabled={isLoading}
                    isPending={isLoading}
                >
                    {isLoading && <Spinner size='sm' color='current' />}
                    Cancel
                </Button>
            </div>
        </div>
    );
};
