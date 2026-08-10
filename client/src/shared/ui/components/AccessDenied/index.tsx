import { Button, EmptyStateRoot, cn } from '@heroui/react';
import { ShieldOff } from 'lucide-react';
import { useId } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
interface AccessDeniedProps {
    title?: string;
    description?: string;
    showBack?: boolean;
    className?: string;
    headingLevel?: 'h1' | 'h2' | 'h3';

    requiredPermissions?: string[];

    contactHint?: string;

    actions?: ReactNode;
};

const AccessDenied = ({
    title = 'Access Denied',
    description = 'You do not have permission to perform this action. Contact your team administrator to request access.',
    showBack = true,
    className,
    headingLevel = 'h2',
    requiredPermissions,
    contactHint,
    actions
}: AccessDeniedProps) => {
    const navigate = useNavigate();
    const headingId = useId();
    const HeadingTag = headingLevel;
    const hasPermissionHint = Boolean(requiredPermissions && requiredPermissions.length > 0);

    return (
        <EmptyStateRoot<'section'>
            render={(props) => <section {...props} />}
            aria-labelledby={headingId}
            className={cn('flex flex-row items-center justify-center w-full h-full max-md:min-h-[300px]', className)}
        >
            <div className='flex flex-col items-center gap-6 text-center max-w-[360px] max-md:max-w-[90%]'>
                <div className='flex flex-row items-center justify-center size-14 shrink-0 rounded-2xl bg-danger-soft text-danger'>
                    <ShieldOff size={24} />
                </div>

                <div className='flex flex-col gap-2 text-center'>
                    <HeadingTag className='text-base font-medium text-foreground' id={headingId}>
                        {title}
                    </HeadingTag>
                    <span className='text-sm text-muted leading-normal'>{description}</span>
                    {hasPermissionHint && (
                        <span className='text-xs text-muted leading-normal px-4 py-3 rounded-xl bg-danger-soft'>
                            {`Permission${requiredPermissions!.length > 1 ? 's' : ''} needed: ${requiredPermissions!.join(', ')}.`}
                            {` Ask ${contactHint ?? 'a team administrator'} to grant access.`}
                        </span>
                    )}
                </div>

                {(showBack || actions) && (
                    <div className='flex flex-row items-center justify-center gap-3 mt-2'>
                        {showBack && (
                            <Button
                                variant='primary'
                                size='sm'
                                onPress={() => navigate(-1)}
                            >
                                Go back
                            </Button>
                        )}
                        {actions}
                    </div>
                )}
            </div>
        </EmptyStateRoot>
    );
};

export default AccessDenied;
