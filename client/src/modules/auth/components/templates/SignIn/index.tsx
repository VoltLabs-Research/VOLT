import './SignIn.css';
import { signInSchema } from './validation-schema';
import { useCheckEmailMutation, useSignInMutation, useSignUpMutation } from '@/modules/auth/hooks/queries';
import { useAuthStore } from '@/modules/auth/stores/use-auth-store';
import WireframeBackground from '../../atoms/WireframeBackground';
import EmailStep from '../../molecules/EmailStep';
import PasswordStep from '../../molecules/PasswordStep';
import RegisterStep from '../../molecules/RegisterStep';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Stepper from '@/shared/presentation/components/Stepper';
import Title from '@/shared/presentation/components/Title';
import useStepper from '@/shared/presentation/hooks/use-stepper';
import useZodForm from '@/shared/presentation/hooks/use-zod-form';
import { buildBackendUrl } from '@/app/core/http/utilities/backend-origin';
import { sileo } from 'sileo';
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { FormEvent } from 'react';
import type { StepTitles } from '@/shared/presentation/components/Stepper';
import type { SignInForm } from './validation-schema';

interface SignInLocationState {
    from?: {
        pathname?: string;
        search?: string;
    };
};

const isSignInLocationState = (value: unknown): value is SignInLocationState => {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    return 'from' in value;
};

enum SignInStep {
    Email = 'email',
    Password = 'password',
    Register = 'register'
};

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
    const location = useLocation();
    const { step, goTo } = useStepper<SignInStep>(SignInStep.Email);
    const checkEmail = useCheckEmailMutation();
    const signIn = useSignInMutation();
    const signUp = useSignUpMutation();
    const markAuthenticated = useAuthStore((state) => state.markAuthenticated);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { control, getValues, trigger, formState } = useZodForm<SignInForm>({
        schema: signInSchema,
        defaultValues: {
            email: '',
            fullName: '',
            password: '',
            passwordConfirm: ''
        },
        mode: 'onTouched'
    });

    const getNextDestination = (): string => {
        const params = new URLSearchParams(location.search);
        const queryNext = params.get('next');
        if (queryNext) return queryNext;

        let stateFrom: SignInLocationState['from'];
        if (isSignInLocationState(location.state)) {
            stateFrom = location.state.from;
        }

        if (stateFrom?.pathname) {
            return stateFrom.pathname + (stateFrom.search ?? '');
        }

        return '/dashboard';
    };

    const handleOAuthRedirect = (provider: string) => {
        const next = getNextDestination();
        const callbackUrl = new URL(buildBackendUrl(`/api/auth/${provider}`));
        callbackUrl.searchParams.set('next', next);
        window.location.href = callbackUrl.toString();
    };

    const finalizeAuth = () => {
        const next = getNextDestination();
        const onboardingUrl = next === '/dashboard' ? '/onboarding' : `/onboarding?next=${encodeURIComponent(next)}`;
        navigate(onboardingUrl);
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
                onOAuth={handleOAuthRedirect} />
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
        <main className='sign-in-page'>
            <section className='sign-in-layout'>
                <section className='sign-in-hero-section p-relative overflow-hidden content-between column p-4' aria-labelledby='sign-in-hero-title'>
                    <WireframeBackground />
                    <Container className='sign-in-hero-overlay p-absolute inset-0' />
                    <Container className='d-flex column gap-1-5 sign-in-hero-text-container p-relative z-10'>
                        <Title as='h2' id='sign-in-hero-title' className='sign-in-hero-headline'>
                            Connect with<br />your VoltID
                        </Title>
                        <Paragraph className='sign-in-hero-description'>
                            Everything your research needs, in one place. Collaborate seamlessly and connect your scientific stack.
                        </Paragraph>
                    </Container>
                </section>

                <section className='sign-in-form-shell d-flex column content-center p-1-5' aria-labelledby='sign-in-form-title'>
                    <Container className='d-flex column gap-2 sign-in-form-section w-max'>
                        <header className='d-flex column gap-05'>
                            <Title as='h1' id='sign-in-form-title' className='sign-in-form-title'>{title}</Title>
                            <Paragraph>{subtitle}</Paragraph>
                        </header>

                        <Stepper
                            steps={signInSteps}
                            activeStep={step} />

                        <Paragraph className='sign-in-consent text-center'>
                            By continuing with email or a social provider, you agree to our{' '}
                            <span className='sign-in-legal-text'>Terms</span> and{' '}
                            <span className='sign-in-legal-text'>Privacy Policy</span>.
                        </Paragraph>
                    </Container>
                </section>
            </section>
        </main>
    );
};

export default SignInTemplate;
