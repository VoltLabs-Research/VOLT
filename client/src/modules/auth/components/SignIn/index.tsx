import './SignIn.css';
import { signInSchema } from './validation-schema';
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
import { useAuthStore } from '@/modules/auth/stores/use-auth-store';
import EmailStep from '../EmailStep';
import PasswordStep from '../PasswordStep';
import RegisterStep from '../RegisterStep';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import Stack from '@/shared/presentation/primitives/Stack';
import Stepper from '@/shared/presentation/primitives/Stepper';
import useStepper from '@/shared/presentation/hooks/use-stepper';
import { zodResolver } from '@hookform/resolvers/zod';
import { buildBackendUrl } from '@/app/core/http/utilities/backend-origin';
import { sileo } from 'sileo';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { FormEvent } from 'react';
import type { OAuthProviderKey } from '@/modules/auth/api/dtos/oauth-providers';
import type { StepTitles } from '@/shared/presentation/primitives/Stepper';
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
    const oauthProvidersQuery = useOAuthProvidersQuery();
    const availableProviders = oauthProvidersQuery.data?.providers ?? [];
    const markAuthenticated = useAuthStore((state) => state.markAuthenticated);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { control, getValues, trigger, formState } = useForm<SignInForm>({
        resolver: zodResolver(signInSchema),
        defaultValues: {
            email: '',
            fullName: '',
            password: '',
            passwordConfirm: ''
        },
        mode: 'onTouched'
    });

    const getNextDestination = (): string => {
        const params = new URLSearchParams(window.location.search);
        const queryNext = params.get('next');

        return resolvePostAuthDestination({
            queryNext
        });
    };

    const handleOAuthRedirect = (provider: OAuthProviderKey) => {
        const next = getNextDestination();
        const callbackUrl = new URL(buildBackendUrl(`/api/auth/${provider}`));
        callbackUrl.searchParams.set('next', next);
        window.location.href = callbackUrl.toString();
    };

    const finalizeAuth = () => {
        const next = getNextDestination();
        const redirectPath = getPostAuthRedirectPath(next);

        clearPostAuthDestination();
        navigate(redirectPath);
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
        } catch {
            sileo.error({
                title: 'Something went wrong',
                description: 'Could not verify email. Please try again.'
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
                description: `Welcome back, ${result.user.firstName || result.user.username}!`
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
        try {
            setIsSubmitting(true);
            const [firstName, ...rest] = values.fullName.trim().split(/\s+/);
            const lastName = rest.join(' ');
            const result = await signUp.mutateAsync({
                email: values.email,
                firstName,
                lastName,
                password: values.password,
                passwordConfirm: values.passwordConfirm
            });
            sileo.success({
                title: 'Account created',
                description: `Welcome, ${result.user.firstName || result.user.username}!`
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

    const steps = [{
        key: SignInStep.Email,
        content: (
            <EmailStep
                control={control}
                isLoading={isSubmitting || formState.isSubmitting}
                onSubmit={handleSubmit}
                onOAuth={handleOAuthRedirect}
                availableProviders={availableProviders} />
            )
    }, {
        key: SignInStep.Password,
        content: (
            <PasswordStep
                email={getValues('email')}
                control={control}
                isLoading={isSubmitting || formState.isSubmitting}
                onSubmit={handleSubmit}
                onBack={goBack} />
        )
    }, {
        key: SignInStep.Register,
        content: (
            <RegisterStep
                email={getValues('email')}
                control={control}
                isLoading={isSubmitting || formState.isSubmitting}
                onSubmit={handleSubmit}
                onBack={goBack} />
            )
    }];

    const signInSteps = step === SignInStep.Register
        ? [steps[0], steps[2]]
        : [steps[0], steps[1]];

    return (
        <main className='sign-in-page screen-vh'>
            <Stack as='section' justify='center' p='1-5' className='sign-in-form-shell screen-vh' aria-labelledby='sign-in-form-title'>
                <Stack gap='2' width='max' className='sign-in-form-section'>
                    <Stack as='header' gap='05'>
                        <h1 id='sign-in-form-title' className='sign-in-form-title'>{title}</h1>
                        <p>{subtitle}</p>
                    </Stack>

                    <Stepper
                        steps={signInSteps}
                        activeStep={step} />

                    <p className='sign-in-consent text-center'>
                        By continuing with email or a social provider, you agree to our{' '}
                        <span className='sign-in-legal-text'>Terms</span> and{' '}
                        <span className='sign-in-legal-text'>Privacy Policy</span>.
                    </p>
                </Stack>
            </Stack>
        </main>
    );
};

export default SignInTemplate;
