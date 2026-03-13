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
        const stateFrom = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
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
        key: SignInStep.Register,
        content: (
            <RegisterStep
                email={getValues('email')}
                control={control}
                isLoading={isSubmitting || formState.isSubmitting}
                onSubmit={handleSubmit}
                onBack={goBack} />
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
    }];

    return (
        <Container className='w-max vh-max overflow-hidden'>
            <Container className='w-max vh-max sign-in-layout'>
                <Container className='sign-in-hero-section p-relative overflow-hidden content-between column p-4'>
                    <WireframeBackground />
                    <Container className='sign-in-hero-overlay p-absolute inset-0' />
                    <Container className='d-flex column content-between h-max p-relative'>
                        <Container />
                        <Container className='d-flex column gap-1-5 sign-in-hero-text-container mb-3 z-10'>
                            <Title className='sign-in-hero-headline'>
                                Connect with<br />your VoltID
                            </Title>
                            <Paragraph className='sign-in-hero-description'>
                                Everything your research needs, in one place. Collaborate seamlessly and connect your scientific stack.
                            </Paragraph>
                        </Container>
                    </Container>
                </Container>

                <Container className='d-flex column content-center vh-max p-1-5'>
                    <Container className='d-flex column gap-2 sign-in-form-section w-max'>
                        <Container>
                            <Title className='sign-in-form-title'>{title}</Title>
                            <Paragraph className='color-muted font-size-3 mt-05'>{subtitle}</Paragraph>
                        </Container>

                        <Stepper
                            steps={steps}
                            activeStep={step} />

                        <Paragraph className='color-muted text-center mt-2 font-size-1'>
                            By clicking continue, you agree to our{' '}
                            <a href='#' className='sign-in-footer-link'>Terms</a> and{' '}
                            <a href='#' className='sign-in-footer-link'>Privacy Policy</a>.
                        </Paragraph>
                    </Container>
                </Container>
            </Container>
        </Container>
    );
};

export default SignInTemplate;
