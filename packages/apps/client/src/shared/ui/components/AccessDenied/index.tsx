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
            <div className='flex flex-col items-center gap-5 text-center max-w-md max-md:max-w-[90%]'>
                <ShieldOff size={28} className='shrink-0 text-muted' aria-hidden='true' />

                <div className='flex flex-col gap-2 text-center'>
                    <HeadingTag className='text-2xl font-semibold tracking-tight text-foreground text-balance' id={headingId}>
                        {title}
                    </HeadingTag>
                    <p className='text-sm text-muted text-pretty'>{description}</p>
                    {hasPermissionHint && (
                        <p className='text-xs text-muted text-pretty'>
                            {`Permission${requiredPermissions!.length > 1 ? 's' : ''} needed: ${requiredPermissions!.join(', ')}.`}
                            {` Ask ${contactHint ?? 'a team administrator'} to grant access.`}
                        </p>
                    )}
                </div>

                {(showBack || actions) && (
                    <div className='flex flex-row items-center justify-center gap-2'>
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
