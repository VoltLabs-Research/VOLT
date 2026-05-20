import { EarlyAccessSubscriptionSource } from '@/modules/early-access/api/service';
import { useCreateEarlyAccessSubscriptionMutation } from '@/modules/early-access/hooks/queries';
import {
    getDiscoverTeamEmailPromptState,
    setDiscoverTeamEmailPromptState
} from '@/modules/early-access/services/discover-team-email-prompt-storage';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { reportError, ErrorSurface } from '@/shared/errors/core';
import Button from '@/shared/presentation/primitives/Button';
import Heading from '@/shared/presentation/primitives/Heading';
import Text from '@/shared/presentation/primitives/Text';
import { Bell, CheckCircle2, Mail, X } from 'lucide-react';
import { sileo } from 'sileo';
import { useCallback, useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import './DiscoverTeamEmailPrompt.css';

interface DiscoverTeamEmailPromptProps {
    teamId: string;
    teamName: string;
}

const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

const getReferrer = (): string | undefined => {
    if (typeof window === 'undefined') {
        return undefined;
    }

    return window.location.href;
};

const DiscoverTeamEmailPrompt = ({
    teamId,
    teamName: _teamName
}: DiscoverTeamEmailPromptProps) => {
    const currentUser = useCurrentUser();
    const createSubscription = useCreateEarlyAccessSubscriptionMutation();
    const inputId = useId();
    const statusId = useId();
    const titleId = useId();
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const description = "Be among the first users to use VOLT with your device. We'll notify you and give you access.";

    useEffect(() => {
        const state = getDiscoverTeamEmailPromptState(teamId);
        const shouldShow = state !== 'dismissed' && state !== 'subscribed';

        setIsVisible(shouldShow);
        setIsSubmitted(state === 'subscribed');
        setError(null);
    }, [teamId]);

    useEffect(() => {
        if (email || !currentUser?.email) {
            return;
        }

        setEmail(currentUser.email);
    }, [currentUser?.email, email]);

    const dismiss = useCallback(() => {
        setDiscoverTeamEmailPromptState(teamId, isSubmitted ? 'subscribed' : 'dismissed');
        setIsVisible(false);
    }, [isSubmitted, teamId]);

    const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const normalizedEmail = email.trim().toLowerCase();
        if (!isValidEmail(normalizedEmail)) {
            setError('Enter a valid email address.');
            return;
        }

        try {
            const result = await createSubscription.mutateAsync({
                teamId,
                email: normalizedEmail,
                source: EarlyAccessSubscriptionSource.DiscoverTeam,
                referrer: getReferrer()
            });

            setEmail(result.email);
            setIsSubmitted(true);
            setIsVisible(false);
            setError(null);
            setDiscoverTeamEmailPromptState(teamId, 'subscribed');
            sileo.success({
                title: result.alreadySubscribed ? 'You are already on the list' : 'You are on the list',
                description: 'We will keep you posted about VOLT access.'
            });
        } catch (err) {
            reportError(err, {
                surface: ErrorSurface.Toast,
                fallbackTitle: 'Could not save your email',
                fallbackDescription: 'Please try again in a moment.'
            });
        }
    }, [createSubscription, email, teamId]);

    if (!isVisible) {
        return null;
    }

    return (
        <aside
            className='discover-team-email-prompt'
            aria-labelledby={titleId}
            aria-describedby={statusId}
        >
            <div className='discover-team-email-prompt__shell'>
                <div className='discover-team-email-prompt__icon' aria-hidden='true'>
                    {isSubmitted ? <CheckCircle2 size={18} /> : <Bell size={18} />}
                </div>
                <div className='discover-team-email-prompt__copy'>
                    <Heading
                        id={titleId}
                        level={2}
                        size='sm'
                        weight='semibold'
                        className='discover-team-email-prompt__title'
                    >
                        {isSubmitted ? 'You are on the VOLT list' : 'Stay up to date about VOLT'}
                    </Heading>
                    <Text
                        id={statusId}
                        as='p'
                        size='sm'
                        tone='muted'
                        className='discover-team-email-prompt__description'
                    >
                        {isSubmitted ? 'We will notify you when access opens for your team.' : description}
                    </Text>
                    <div className='discover-team-email-prompt__links'>
                        <a
                            className='discover-team-email-prompt__link'
                            href='https://github.com/voltlabs-research'
                            target='_blank'
                            rel='noopener noreferrer'
                        >
                            GitHub
                        </a>
                        <span className='discover-team-email-prompt__links-separator' aria-hidden='true'>
                            •
                        </span>
                        <a
                            className='discover-team-email-prompt__link'
                            href='https://docs.voltcloud.dev'
                            target='_blank'
                            rel='noopener noreferrer'
                        >
                            Documentation
                        </a>
                    </div>
                </div>
                {isSubmitted ? (
                    <Button
                        type='button'
                        variant='soft'
                        intent='neutral'
                        size='sm'
                        onClick={dismiss}
                        className='discover-team-email-prompt__done'
                    >
                        Done
                    </Button>
                ) : (
                    <form className='discover-team-email-prompt__form' onSubmit={handleSubmit}>
                        <div className='discover-team-email-prompt__field'>
                            <Mail size={14} aria-hidden='true' />
                            <input
                                id={inputId}
                                type='email'
                                value={email}
                                onChange={(event) => {
                                    setEmail(event.target.value);
                                    if (error) setError(null);
                                }}
                                placeholder='you@company.com'
                                autoComplete='email'
                                inputMode='email'
                                aria-label='Email address'
                                aria-invalid={error ? true : undefined}
                                aria-describedby={error ? `${inputId}-error` : undefined}
                                disabled={createSubscription.isPending}
                            />
                        </div>
                        {error && (
                            <Text
                                id={`${inputId}-error`}
                                as='span'
                                size='xs'
                                className='discover-team-email-prompt__error'
                                role='status'
                            >
                                {error}
                            </Text>
                        )}
                        <Button
                            type='submit'
                            variant='solid'
                            intent='brand'
                            size='md'
                            isLoading={createSubscription.isPending}
                            className='discover-team-email-prompt__submit'
                        >
                            Notify me
                        </Button>
                    </form>
                )}
                <Button
                    type='button'
                    variant='ghost'
                    intent='neutral'
                    iconOnly
                    size='sm'
                    aria-label='Dismiss email prompt'
                    title='Dismiss'
                    onClick={dismiss}
                    className='discover-team-email-prompt__close'
                >
                    <X size={18} />
                </Button>
            </div>
        </aside>
    );
};

export default DiscoverTeamEmailPrompt;
