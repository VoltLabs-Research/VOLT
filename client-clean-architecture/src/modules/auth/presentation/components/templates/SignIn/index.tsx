import { useState } from 'react';
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

const SignInPage = () => {
    const { step, goTo } = useStepper<Step>('email');
    const [isLoading, setIsLoading] = useState(false);

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

    const handleSubmit = form.handleSubmit(async () => {
        setIsLoading(true);
        try{
            if(step === 'email'){
                // TODO: const { exists } = await authApi.checkEmail(form.values.email);
                // goTo(exists ? 'password' : 'register');
                goTo('register');
            }
        }finally{
            setIsLoading(false);
        }
    });

    const { title, subtitle } = stepTitles[step];
    
    const goBack = () => {
        goTo('email');
    };

    const steps = [{
        key: 'email',
        content: (
            <EmailStep
                emailField={form.field('email')}
                isLoading={isLoading}
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
                isLoading={isLoading}
                onSubmit={handleSubmit}
                onBack={goBack} />
            )
    }, {
        key: 'password',
        content: (
            <PasswordStep
                email={form.values.email}
                passwordField={form.field('password')}
                isLoading={isLoading}
                onSubmit={handleSubmit}
                onBack={goBack} />
        )
    }];

    return (
        <Container className='w-max vh-max overflow-hidden'>
            <Container className='w-max vh-max sign-in-layout'>
                <Container className='sign-in-hero-section p-relative overflow-hidden content-between column'>
                    <WireframeBackground />
                    <Container className='sign-in-hero-overlay p-absolute inset-0' />
                    <Container className='d-flex column content-between h-max p-relative z-20'>
                        <Container />
                        <Container className='d-flex column gap-1-5 mb-3'>
                            <Title className='sign-in-hero-headline font-weight-6'>
                                Connect with<br />your VoltID
                            </Title>
                            <Paragraph className='color-secondary font-size-4 line-height-5'>
                                Everything your research needs, in one place. Collaborate seamlessly and connect your scientific stack.
                            </Paragraph>
                        </Container>
                    </Container>
                </Container>

                <Container className='d-flex column content-center vh-max p-1-5'>
                    <Container className='d-flex column gap-2 w-max' style={{ maxWidth: '26rem', margin: '0 auto' }}>
                        <Container>
                            <Title className='font-size-6 font-weight-6'>{title}</Title>
                            <Paragraph className='color-muted font-size-3 mt-05'>{subtitle}</Paragraph>
                        </Container>

                        <Stepper 
                            steps={steps} 
                            activeStep={step} />

                        <Paragraph className='text-center font-size-1 color-muted mt-3'>
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

export default SignInPage;