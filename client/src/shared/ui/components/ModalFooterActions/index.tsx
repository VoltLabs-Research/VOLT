import { Button } from '@heroui/react';
import type { ButtonProps } from '@heroui/react';
import type { ReactNode } from 'react';

/**
 * The two buttons in a modal footer, in the one order the app uses them:
 * secondary (dismiss) then primary (commit).
 *
 * `ModalFooterAction` is HeroUI's `ButtonProps` plus a `label`, so every prop a
 * footer button can take is the button's own — which is also why the rename from
 * bravais reaches all 14 call sites rather than stopping here:
 * `onClick`→`onPress`, `disabled`→`isDisabled`, `isLoading`→`isPending`, and
 * `intent`→`variant` (HeroUI crosses no intent axis; `intent='danger'` is
 * `variant='danger'`).
 *
 * Two props that used to be accepted are gone, because HeroUI's `ButtonProps` is
 * closed where bravais's extended `ButtonHTMLAttributes`:
 *
 *   • `title` — a native tooltip. No footer action passed one, so nothing is lost
 *     here, but a caller that wants one now needs a `Tooltip` around the button.
 *   • `intent` — see above.
 *
 * `type` and `form` survive: React Aria's button declares both, so the three
 * footers that submit a form by id (JoinTeamModal, TeamCreatorModal,
 * SecretKeyCreationModal) keep working unchanged.
 */
export interface ModalFooterAction extends Omit<ButtonProps, 'children'> {
    label: ReactNode;
};

interface ModalFooterActionsProps {
    primary?: ModalFooterAction;
    secondary?: ModalFooterAction;
};

const renderAction = (
    action: ModalFooterAction | undefined,
    defaultVariant: ButtonProps['variant']
) => {
    if (!action) {
        return null;
    }

    const { label, variant, ...props } = action;

    return (
        <Button variant={variant ?? defaultVariant} {...props}>
            {label}
        </Button>
    );
};

/*
 * The defaults are bravais's, converted by what they painted: the dismiss button
 * was `variant='ghost' intent='neutral'` → `ghost`, and the commit button was
 * `variant='solid' intent='brand'`, the accent fill → `primary`.
 */
const ModalFooterActions = ({ primary, secondary }: ModalFooterActionsProps) => {
    return (
        <>
            {renderAction(secondary, 'ghost')}
            {renderAction(primary, 'primary')}
        </>
    );
};

export default ModalFooterActions;
