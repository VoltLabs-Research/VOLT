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
import { ErrorSurface } from '@/shared/contracts/errors';
import { reportError } from '@/shared/errors/core/report-error';
import { Button } from '@heroui/react';
import { useStepper } from '@/shared/ui/hooks/use-stepper';
import { buildBackendUrl, isEndpointPinnedByEnv } from '@/app/core/http/utils/backend-origin';
import { resetBackendEndpoint } from '@/modules/auth/services/endpoint-session';
import { sileo } from 'sileo';
import { useState } from 'react';
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

    let stepContent = (
        <EmailStep
            control={control}
            isLoading={isSubmitting}
            onSubmit={handleSubmit}
            onOAuth={handleOAuthRedirect}
            availableProviders={availableProviders} />
    );

    if (step === SignInStep.Password) {
        stepContent = (
            <PasswordStep
                email={getValues('email')}
                control={control}
                isLoading={isSubmitting}
                onSubmit={handleSubmit}
                onBack={goBack} />
        );
    }

    if (step === SignInStep.Register) {
        stepContent = (
            <RegisterStep
                email={getValues('email')}
                control={control}
                isLoading={isSubmitting}
                onSubmit={handleSubmit}
                onBack={goBack} />
        );
    }

    return (
        <main className='flex min-h-dvh items-center justify-center bg-background px-4 py-18' aria-labelledby='sign-in-form-title'>
            <div className='flex w-full max-w-sm flex-col gap-6'>
                {/* Keyed by step, so each step rises in with its own title. */}
                <div key={step} className='flex flex-col gap-6 animate-in fade-in-0 slide-in-from-bottom-3 duration-280 ease-out-fluid'>
                    <header className='flex flex-col gap-2'>
                        <h1 className='text-3xl font-semibold tracking-[-0.03em] text-foreground' id='sign-in-form-title'>{title}</h1>
                        <p className='text-base text-muted'>{subtitle}</p>
                    </header>
                    {stepContent}
                </div>

                <div className='flex flex-col items-center gap-3'>
                    <p className='text-center text-xs text-muted'>
                        By continuing with email or a social provider, you agree to our{' '}
                        <span className='text-foreground'>Terms</span> and{' '}
                        <span className='text-foreground'>Privacy Policy</span>.
                    </p>

                    {!isEndpointPinnedByEnv() && (
                        <Button
                            variant='ghost'
                            size='sm'
                            onPress={() => void resetBackendEndpoint()}
                        >
                            Change server
                        </Button>
                    )}
                </div>
            </div>
        </main>
    );
};

export default SignInTemplate;
