import './SignIn.css';
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
import { Stepper, Button } from '@voltstack/bravais';
import type { StepTitles } from '@voltstack/bravais';
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

const stepTitles: StepTitles<SignInStep> = {
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

    return (
        <main className='sign-in-page screen-vh'>
            <section className='flex flex-col justify-center p-6 sign-in-form-shell screen-vh' aria-labelledby='sign-in-form-title'>
                <div className='flex flex-col gap-8 w-full sign-in-form-section'>
                    <header className='flex flex-col gap-2'>
                        <h1 className='text-base font-medium text-foreground sign-in-form-title' id='sign-in-form-title'>{title}</h1>
                        <p>{subtitle}</p>
                    </header>

                    <Stepper
                        steps={signInSteps}
                        activeStep={step} />

                    <p className='text-center sign-in-consent'>
                        By continuing with email or a social provider, you agree to our{' '}
                        <span className='sign-in-legal-text'>Terms</span> and{' '}
                        <span className='sign-in-legal-text'>Privacy Policy</span>.
                    </p>

                    {!isEndpointPinnedByEnv() && (
                        <Button
                            variant='ghost'
                            intent='neutral'
                            size='sm'
                            block
                            onClick={resetBackendEndpoint}
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
