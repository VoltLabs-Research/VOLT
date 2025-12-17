import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import authApi from "@/services/api/auth";
import useAuthStore from "@/stores/authentication";
import { useFormValidation } from "@/hooks/useFormValidation";
import FormInput from "@/components/atoms/form/FormInput";
import {
  Github,
  LayoutGrid,
  Lock,
  ArrowLeft,
  CheckCircle2,
  Mail
} from "lucide-react";
import Title from "@/components/primitives/Title";
import Paragraph from "@/components/primitives/Paragraph";
import './SignIn.css';

const WireframeBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth / 2;
      canvas.height = window.innerHeight;
    };

    const lines = 40;
    const gap = 40;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 1;

      for (let i = 0; i < lines; i++) {
        ctx.beginPath();
        const alpha = (i / lines) * 0.3;
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;

        for (let x = 0; x <= canvas.width; x += 10) {
          const yBase = (i * gap) - 100;
          const amplitude = 30 + (i * 2);
          const frequency = 0.003;
          const speed = 0.015;
          const noise = Math.sin(x * frequency + time * speed + (i * 0.5));
          const y = yBase + (noise * amplitude) + (Math.sin(x * 0.01) * 20);

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      time++;
      animationFrameId = window.requestAnimationFrame(draw);
    };

    window.addEventListener('resize', resize);
    resize();
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="wireframe-canvas"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        opacity: 0.6,
        pointerEvents: 'none'
      }}
    />
  );
};

import Button from "@/components/primitives/Button";

export default function AuthPage() {
  const navigate = useNavigate();
  const { signIn, signUp, user, isLoading } = useAuthStore();

  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const { errors, validate, checkField, clearError } = useFormValidation({
    email: {
      required: true,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: 'Please enter a valid email address'
    },
    password: {
      required: true,
      minLength: 8,
      maxLength: 16,
      message: 'Password must be between 8 and 16 characters'
    },
    firstName: {
      required: true,
      minLength: 4,
      maxLength: 16,
      message: 'First name must be between 4 and 16 characters'
    },
    lastName: {
      required: true,
      minLength: 4,
      maxLength: 16,
      message: 'Last name must be between 4 and 16 characters'
    },
    passwordConfirm: {
      required: true,
      validate: (value, formData) => value === formData?.password || 'Passwords do not match'
    }
  });

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (step === "email") {
        if (!validate({ email }, ['email'])) return;

        const result = await authApi.checkEmail(email);
        if (result.exists) {
          setStep("password");
        } else {
          setStep("register");
        }
      } else if (step === "password") {
        if (!validate({ email, password }, ['email', 'password'])) return;
        await signIn({ email, password });
      } else if (step === "register") {
        if (!validate({ email, firstName, lastName, password, passwordConfirm }, ['email', 'firstName', 'lastName', 'password', 'passwordConfirm'])) return;
        await signUp({ email, firstName, lastName, password, passwordConfirm });
      }
    } catch (error) {
      console.error("Authentication error:", error);
    }
  };

  const handleInputChange = (setter: (val: string) => void, field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setter(value);

    const formData = field === 'passwordConfirm' ? { password } : undefined;
    checkField(field, value, formData);
  };

  return (
    <div className="auth-page-wrapper w-max vh-max overflow-hidden">
      <div className="auth-layout w-max vh-max">
        <div className="hero-section p-relative overflow-hidden content-between column">
          <div className="hero-background p-absolute inset-0">
            <WireframeBackground />
            <div className="hero-overlay p-absolute inset-0" />
          </div>

          <div className="d-flex column content-between h-max hero-content-wrapper p-relative h-max">
            <div className="d-flex items-center gap-075 hero-brand font-size-5">
              <div className="brand-icon d-flex flex-center">
                <LayoutGrid size={24} color="white" />
              </div>
              <span>Volterra</span>
            </div>

            <div className="d-flex column gap-1-5 hero-text-container mb-3">
              <Title className="hero-headline">
                Connect with<br />your VoltID
              </Title>
              <Paragraph className="hero-description font-size-4 font-weight-4">
                Everything your research needs, in one place. Collaborate seamlessly and connect your scientific stack.
              </Paragraph>
            </div>
          </div>
        </div>

        <div className="d-flex column form-section p-relative gap-1 vh-max">
          <div className="form-bg-glow p-absolute" />

          <div className="d-flex column content-center gap-2 flex-1 form-container p-relative w-max">
            <div className="form-header">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Title className="form-title font-size-6">
                    {step === "email" ? "Sign In or Join Now!" : step === "register" ? "Create Account" : "Welcome back"}
                  </Title>
                  <Paragraph className="form-subtitle font-size-3">
                    {step === "email" ? "Login or create your account." : step === "register" ? "Enter your details to get started." : "Enter your password to continue."}
                  </Paragraph>
                </motion.div>
              </AnimatePresence>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {step === "email" ? (
                <motion.div
                  key="step-email"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <div className="space-y-4">
                    <Button
                      variant="outline"
                      intent="white"
                      size="lg"
                      block
                      leftIcon={<Github size={20} />}
                      onClick={() => window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/github`}
                    >
                      Continue with GitHub
                    </Button>
                    <Button
                      variant="outline"
                      intent="white"
                      size="lg"
                      block
                      leftIcon={
                        <svg viewBox="0 0 24 24" width="20" height="20">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                      }
                      onClick={() => window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/google`}
                    >
                      Continue with Google
                    </Button>
                    <Button
                      variant="outline"
                      intent="white"
                      size="lg"
                      block
                      leftIcon={
                        <svg viewBox="0 0 23 23" width="20" height="20">
                          <path fill="#f35325" d="M1 1h10v10H1z" />
                          <path fill="#81bc06" d="M12 1h10v10H12z" />
                          <path fill="#05a6f0" d="M1 12h10v10H1z" />
                          <path fill="#ffba08" d="M12 12h10v10H12z" />
                        </svg>
                      }
                      onClick={() => window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/microsoft`}
                    >
                      Continue with Microsoft
                    </Button>
                  </div>

                  <div className="d-flex items-center divider font-size-1">
                    <span>Or continue with email</span>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <div className="input-group p-relative">
                        <div className="input-icon d-flex flex-center p-absolute">
                          <Mail size={18} />
                        </div>
                        <FormInput
                          variant="auth"
                          value={email}
                          onChange={handleInputChange(setEmail, 'email')}
                          placeholder="name@example.com"
                          type="email"
                          autoFocus
                          error={errors.email}
                        />
                      </div>
                    </div>
                    <Button type="submit" isLoading={isLoading} variant="solid" intent="white" block>
                      Continue
                    </Button>
                  </form>
                </motion.div>
              ) : step === "register" ? (
                <motion.div
                  key="step-register"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  <div className="user-badge">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <CheckCircle2 size={20} color="#22c55e" />
                      <div className="d-flex column">
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-zinc-500)' }}>Signing up as</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{email}</span>
                      </div>
                    </div>
                    <Button variant="ghost" intent="white" size="sm" onClick={() => setStep("email")}>Change</Button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4 form-sign-up">
                    <FormInput
                      variant="auth"
                      value={firstName}
                      onChange={handleInputChange(setFirstName, 'firstName')}
                      placeholder="First Name"
                      error={errors.firstName}
                    />
                    <FormInput
                      variant="auth"
                      value={lastName}
                      onChange={handleInputChange(setLastName, 'lastName')}
                      placeholder="Last Name"
                      error={errors.lastName}
                    />
                    <FormInput
                      variant="auth"
                      value={password}
                      onChange={handleInputChange(setPassword, 'password')}
                      placeholder="Password"
                      type="password"
                      error={errors.password}
                    />
                    <FormInput
                      variant="auth"
                      value={passwordConfirm}
                      onChange={handleInputChange(setPasswordConfirm, 'passwordConfirm')}
                      placeholder="Confirm Password"
                      type="password"
                      error={errors.passwordConfirm}
                    />
                    <Button type="submit" isLoading={isLoading} variant="solid" intent="white" block>
                      Create Account
                    </Button>
                    <Button variant="ghost" intent="white" block leftIcon={<ArrowLeft size={16} />} onClick={() => setStep("email")}>
                      Back
                    </Button>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="step-password"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  <div className="d-flex content-between items-center user-badge">
                    <div className="d-flex items-center gap-075">
                      <div style={{ background: 'var(--color-zinc-800)', borderRadius: '50%', padding: '4px' }}>
                        <CheckCircle2 size={16} color="#22c55e" />
                      </div>
                      <div className="d-flex column">
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-zinc-500)' }}>Logging in as</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{email}</span>
                      </div>
                    </div>
                    <Button variant="ghost" intent="white" size="sm" onClick={() => setStep("email")}>Change</Button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <div className="input-group p-relative">
                        <div className="input-icon d-flex flex-center p-absolute"><Lock size={18} /></div>
                        <FormInput
                          variant="auth"
                          value={password}
                          onChange={handleInputChange(setPassword, 'password')}
                          placeholder="Password"
                          type="password"
                          autoFocus
                          error={errors.password}
                        />
                      </div>
                    </div>
                    <Button type="submit" isLoading={isLoading} variant="solid" intent="white" block>
                      Sign In
                    </Button>
                    <Button variant="ghost" intent="white" block leftIcon={<ArrowLeft size={16} />} onClick={() => setStep("email")}>
                      Back
                    </Button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            <Paragraph className="footer-text text-center">
              By clicking continue, you agree to our <a href="#" className="footer-link">Terms</a> and <a href="#" className="footer-link">Privacy Policy</a>.
            </Paragraph>
          </div>
        </div>
      </div>
    </div>
  );
}
