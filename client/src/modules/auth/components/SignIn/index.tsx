import {
    useCheckEmailMutation,
    useOAuthProvidersQuery,
    useSignInMutation,
    useSignUpMutation
} from '@/modules/auth/hooks/queries';
import {
    clearPostAuthDestination,
    getPostAuthRedirectPath,
    resolvePostAuthDestination
} from '@/modules/auth/services/post-auth-destination-storage';
import { useAuthStore } from '@/modules/auth/store/use-auth-store';
import EmailStep from '../EmailStep';
import PasswordStep from '../PasswordStep';
import RegisterStep from '../RegisterStep';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import { Button } from '@heroui/react';
import { useStepper } from '@/shared/ui/hooks/use-stepper';
import { usePrefersReducedMotion } from '@/shared/ui/hooks/use-prefers-reduced-motion';
import { buildBackendUrl, isEndpointPinnedByEnv } from '@/app/core/http/utils/backend-origin';
import { resetBackendEndpoint } from '@/modules/auth/services/endpoint-session';
import { AnimatePresence, motion } from 'framer-motion';
import { sileo } from 'sileo';
import { useEffect, useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { FormEvent } from 'react';
import type { OAuthProviderId } from '@volt/contracts/modules/auth/domain';
import type { SignInForm } from './validation-schema';
import { useNavigate } from 'react-router-dom';
enum SignInStep {
    Email = 'email',
    Password = 'password',
    Register = 'register'
}

/*
 * bravais's `Stepper` in its standalone mode (no indicators) was one
 * AnimatePresence-wrapped panel that slid the outgoing step out before sliding
 * the incoming one in, with the direction derived from the step's index moving
 * forward or backward. There is no HeroUI equivalent, so the chrome is restated
 * here — the variants, the `mode='wait'` exchange, the 0.25s timing, the
 * reduced-motion opt-out and the focusable panel are all the originals.
 */
type StepDirection = 'forward' | 'backward';

const stepVariants = {
    enter: (direction: StepDirection) => ({
        x: direction === 'forward' ? 20 : -20,
        opacity: 0
    }),
    center: {
        x: 0,
        opacity: 1
    },
    exit: (direction: StepDirection) => ({
        x: direction === 'forward' ? -20 : 20,
        opacity: 0
    })
};

const staticStepVariants = {
    enter: { x: 0, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: 0, opacity: 0 }
};

interface StepTitle {
    title: string;
    subtitle: string;
}

const stepTitles: Record<SignInStep, StepTitle> = {
    [SignInStep.Email]: {
        title: 'Sign In or Join Now!',
        subtitle: 'Login or create your account.'
    },
    [SignInStep.Password]: {
        title: 'Welcome back',
        subtitle: 'Enter your password to continue.'
    },
    [SignInStep.Register]: {
        title: 'Create Account',
        subtitle: 'Enter your details to get started.'
    }
};

const SignInTemplate = () => {
    const navigate = useNavigate();
    const { step, goTo } = useStepper<SignInStep>(SignInStep.Email);
    const prefersReducedMotion = usePrefersReducedMotion();
    const panelBaseId = useId();
    const [previousStep, setPreviousStep] = useState<SignInStep>(SignInStep.Email);

    useEffect(() => {
        setPreviousStep(step);
    }, [step]);

    const checkEmail = useCheckEmailMutation();
    const signIn = useSignInMutation();
    const signUp = useSignUpMutation();
    const availableProviders = useOAuthProvidersQuery().data?.providers ?? [];
    const markAuthenticated = useAuthStore((state) => state.markAuthenticated);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { control, getValues, trigger } = useForm<SignInForm>({
        defaultValues: {
            email: '',
            fullName: '',
            password: '',
            passwordConfirm: ''
        },
        mode: 'onTouched'
    });

    const getNextDestination = (): string => {
        return resolvePostAuthDestination({
            queryNext: new URLSearchParams(window.location.search).get('next')
        });
    };

    const handleOAuthRedirect = (provider: OAuthProviderId) => {
        const callbackUrl = new URL(buildBackendUrl(`/api/auth/${provider}`));
        callbackUrl.searchParams.set('next', getNextDestination());
        window.location.href = callbackUrl.toString();
    };

    const finalizeAuth = () => {
        clearPostAuthDestination();
        navigate(getPostAuthRedirectPath(getNextDestination()));
    };

    const handleEmailStep = async () => {
        const isEmailValid = await trigger('email');
        if (!isEmailValid) return;

        const values = getValues();
        try {
            const result = await checkEmail.mutateAsync({ email: values.email });
            if (result.exists) {
                goTo(SignInStep.Password);
                return;
            }
            goTo(SignInStep.Register);
        } catch (err: unknown) {
            reportError(err, {
                surface: ErrorSurface.Toast,
                fallbackTitle: 'Could not verify email',
                fallbackDescription: 'Please check your connection and try again.'
            });
        }
    };

    const handlePasswordStep = async () => {
        const isPasswordValid = await trigger('password');
        if (!isPasswordValid) return;

        const values = getValues();
        try {
            setIsSubmitting(true);
            const result = await signIn.mutateAsync({
                email: values.email,
                password: values.password
            });
            sileo.success({
                title: 'Signed in successfully',
                description: `Welcome back, ${result.user.firstName}!`
            });
            markAuthenticated(result.token);
            finalizeAuth();
        } catch (err: unknown) {
            reportError(err, {
                surface: ErrorSurface.Toast,
                fallbackTitle: 'Sign in failed',
                fallbackDescription: 'Please check your credentials and try again.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRegisterStep = async () => {
        const areFieldsValid = await trigger(['fullName', 'password', 'passwordConfirm']);
        if (!areFieldsValid) return;

        const values = getValues();

        if (values.password.length < 8) {
            sileo.error({
                title: 'Password too short',
                description: 'Your password must be at least 8 characters.'
            });
            return;
        }

        if (values.password !== values.passwordConfirm) {
            sileo.error({
                title: 'Passwords do not match',
                description: 'Please make sure both password fields are identical.'
            });
            return;
        }

        try {
            setIsSubmitting(true);
            const [firstName, ...rest] = values.fullName.trim().split(/\s+/);
            const lastName = rest.join(' ');
            const result = await signUp.mutateAsync({
                email: values.email,
                firstName,
                lastName,
                password: values.password
            });
            sileo.success({
                title: 'Account created',
                description: `Welcome, ${result.user.firstName}!`
            });
            markAuthenticated(result.token);
            finalizeAuth();
        } catch (err: unknown) {
            reportError(err, {
                surface: ErrorSurface.Toast,
                fallbackTitle: 'Registration failed',
                fallbackDescription: 'Please check your details and try again.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = async (e?: FormEvent) => {
        e?.preventDefault();

        if (step === SignInStep.Email) {
            await handleEmailStep();
            return;
        }

        if (step === SignInStep.Password) {
            await handlePasswordStep();
            return;
        }

        await handleRegisterStep();
    };

    const { title, subtitle } = stepTitles[step];

    const goBack = () => {
        goTo(SignInStep.Email);
    };

    const signInSteps = [{
        key: SignInStep.Email,
        content: (
            <EmailStep
                control={control}
                isLoading={isSubmitting}
                onSubmit={handleSubmit}
                onOAuth={handleOAuthRedirect}
                availableProviders={availableProviders} />
        )
    }, step === SignInStep.Register ? {
        key: SignInStep.Register,
        content: (
            <RegisterStep
                email={getValues('email')}
                control={control}
                isLoading={isSubmitting}
                onSubmit={handleSubmit}
                onBack={goBack} />
        )
    } : {
        key: SignInStep.Password,
        content: (
            <PasswordStep
                email={getValues('email')}
                control={control}
                isLoading={isSubmitting}
                onSubmit={handleSubmit}
                onBack={goBack} />
        )
    }];

    const activeStepIndex = signInSteps.findIndex((candidate) => candidate.key === step);
    const previousStepIndex = signInSteps.findIndex((candidate) => candidate.key === previousStep);
    const direction: StepDirection = activeStepIndex >= previousStepIndex ? 'forward' : 'backward';

    return (
        <main className='min-h-dvh bg-background'>
            <section className='relative flex min-h-dvh flex-col justify-center bg-background p-6 max-sm:p-4' aria-labelledby='sign-in-form-title'>
                <div className='mx-auto flex w-full max-w-[26rem] flex-col gap-8'>
                    <header className='flex flex-col gap-2'>
                        <h1 className='text-[2rem] font-bold tracking-[-0.03em] text-foreground max-lg:text-[1.75rem]' id='sign-in-form-title'>{title}</h1>
                        <p>{subtitle}</p>
                    </header>

                    <div className='w-full'>
                        <AnimatePresence mode='wait' custom={direction} initial={false}>
                            <motion.div
                                key={step}
                                custom={direction}
                                variants={prefersReducedMotion ? staticStepVariants : stepVariants}
                                initial='enter'
                                animate='center'
                                exit='exit'
                                transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
                                className='w-full [will-change:opacity,transform]'
                                id={`${panelBaseId}-${step}-panel`}
                                tabIndex={0}
                            >
                                {signInSteps[activeStepIndex]?.content}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    <p className='border-t border-border/70 pt-2 text-center text-sm leading-[1.6] text-muted'>
                        By continuing with email or a social provider, you agree to our{' '}
                        <span className='font-medium text-foreground'>Terms</span> and{' '}
                        <span className='font-medium text-foreground'>Privacy Policy</span>.
                    </p>

                    {!isEndpointPinnedByEnv() && (
                        <Button
                            variant='ghost'
                            size='sm'
                            fullWidth
                            onPress={resetBackendEndpoint}
                        >
                            Change server
                        </Button>
                    )}
                </div>
            </section>
        </main>
    );
};

export default SignInTemplate;
