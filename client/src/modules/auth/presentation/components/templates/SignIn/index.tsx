import useForm from '@/shared/presentation/hooks/use-form';
import useStepper from '@/shared/presentation/hooks/use-stepper';
import Container from '@/shared/presentation/components/Container';
import Stepper, { StepTitles } from '@/shared/presentation/components/Stepper';
import WireframeBackground from '../../atoms/WireframeBackground';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';
import EmailStep from '../../molecules/EmailStep';
import RegisterStep from '../../molecules/RegisterStep';
import PasswordStep from '../../molecules/PasswordStep';
import { signInSchema, SignInForm } from './validation-schema';
import useAuthUseCases from '@/modules/auth/presentation/hooks/use-auth-use-cases';
import { useAuthStore } from '../../../stores/use-auth-store';
import { useNavigate } from 'react-router-dom';
import { showSuccess, showError } from '@/shared/presentation/hooks/toast';
import ApiError from '@/shared/errors/ApiError';
import './SignIn.css';

type Step = 'email' | 'password' | 'register';

const stepTitles: StepTitles<Step> = {
    email: {
        title: 'Sign In or Join Now!',
        subtitle: 'Login or create your account.'
    },
    password: {
        title: 'Welcome back',
        subtitle: 'Enter your password to continue.'
    },
    register: {
        title: 'Create Account',
        subtitle: 'Enter your details to get started.'
    }
};

const SignInTemplate = () => {
    const navigate = useNavigate();
    const { step, goTo } = useStepper<Step>('email');
    const { authRepository, signInUseCase, signUpUseCase } = useAuthUseCases();
    const setUser = useAuthStore((state) => state.setUser);

    const form = useForm<SignInForm>({
        initialValues: {
            email: '',
            fullName: '',
            password: '',
            passwordConfirm: ''
        },
        schema: signInSchema,
        validateOnChange: true
    });

    const handleOAuthRedirect = (provider: string) => {
        window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/${provider}`;
    };

    const finalizeAuth = () => {
        navigate('/dashboard');
    };

    const handleEmailStep = async () => {
        form.validateForm(['email']);
        if(form.errors.email){
            return;
        }
        try {
            const result = await authRepository.checkEmail(form.values.email);
            if(result.exists){
                goTo('password');
                return;
            }
            goTo('register');
        } catch(err) {
            showError({ title: 'Something went wrong', description: 'Could not verify email. Please try again.' });
        }
    };

    const handlePasswordStep = async () => {
        form.validateForm(['password']);
        if (form.errors.password) {
            return;
        }
        try {
            const result = await signInUseCase.execute({
                email: form.values.email,
                password: form.values.password
            });
            setUser(result.user);
            showSuccess({ title: 'Signed in successfully', description: `Welcome back, ${result.user.firstName || result.user.username}!` });
            finalizeAuth();
        } catch(err) {
            const message = err instanceof ApiError ? err.getFriendlyMessage() : 'Please check your credentials and try again.';
            showError({ title: 'Sign in failed', description: message });
        }
    };


    const handleRegisterStep = async () => {
        form.validateForm(['fullName', 'password', 'passwordConfirm']);
        if (form.errors.fullName || form.errors.password || form.errors.passwordConfirm) {
            return;
        }
        try {
            const [firstName, ...rest] = form.values.fullName.trim().split(/\s+/);
            const lastName = rest.join(' ');
            const result = await signUpUseCase.execute({
                email: form.values.email,
                firstName,
                lastName,
                password: form.values.password,
                passwordConfirm: form.values.passwordConfirm
            });
            setUser(result.user);
            showSuccess({ title: 'Account created', description: `Welcome, ${result.user.firstName || result.user.username}!` });
            finalizeAuth();
        } catch(err) {
            const message = err instanceof ApiError ? err.getFriendlyMessage() : 'Please check your details and try again.';
            showError({ title: 'Registration failed', description: message });
        }
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        
        if(step === 'email'){
            await handleEmailStep();
            return;
        }

        if(step === 'password'){
            await handlePasswordStep();
            return;
        }

        await handleRegisterStep();
    };

    const { title, subtitle } = stepTitles[step];
    
    const goBack = () => {
        goTo('email');
    };

    const steps = [{
        key: 'email',
        content: (
            <EmailStep
                emailField={form.field('email')}
                isLoading={form.isSubmitting}
                onSubmit={handleSubmit}
                onOAuth={handleOAuthRedirect} />
        )
    }, {
        key: 'register',
        content: (
            <RegisterStep
                email={form.values.email}
                fullNameField={form.field('fullName')}
                passwordField={form.field('password')}
                passwordConfirmField={form.field('passwordConfirm')}
                isLoading={form.isSubmitting}
                onSubmit={handleSubmit}
                onBack={goBack} />
            )
    }, {
        key: 'password',
        content: (
            <PasswordStep
                email={form.values.email}
                passwordField={form.field('password')}
                isLoading={form.isSubmitting}
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
