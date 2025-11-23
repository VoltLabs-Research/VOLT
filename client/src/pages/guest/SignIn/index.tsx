import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import api from "@/api";
import useAuthStore from "@/stores/authentication";
import {
  Github,
  LayoutGrid,
  Lock,
  ArrowLeft,
  CheckCircle2,
  Mail
} from "lucide-react";
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

import Button from "@/components/atoms/Button";

const Input = ({ className = '', ...props }: any) => (
  <input className={`form-input ${className}`} {...props} />
);

export default function AuthPage() {
  const navigate = useNavigate();
  const { signIn, signUp, user, isLoading } = useAuthStore();

  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (step === "email" && email) {
        const { data } = await api.post('/auth/check-email', { email });
        if (data.data.exists) {
          setStep("password");
        } else {
          setStep("register");
        }
      } else if (step === "password") {
        await signIn({ email, password });
      } else if (step === "register") {
        await signUp({ email, firstName, lastName, password, passwordConfirm });
      }
    } catch (error) {
      console.error("Authentication error:", error);
    }
  };

  return (
    <div className="auth-page-wrapper">
      <div className="auth-layout">
        {/* Lado Izquierdo - ANIMACIÓN CANVAS + TEXTO MINIMALISTA */}
        <div className="hero-section">
          <div className="hero-background">
            <WireframeBackground />
            <div className="hero-overlay" />
          </div>

          <div className="hero-content-wrapper">
            <div className="hero-brand">
              <div className="brand-icon">
                <LayoutGrid size={24} color="white" />
              </div>
              <span>Volterra</span>
            </div>

            <div className="hero-text-container">
              <h2 className="hero-headline">
                Connect with<br />your VoltID
              </h2>
              <p className="hero-description">
                Accelerate your research with our platform. Secure, scalable, and built for modern teams.
              </p>
            </div>
          </div>
        </div>

        {/* Lado Derecho - Formulario */}
        <div className="form-section">
          <div className="form-bg-glow" />

          <div className="form-container">
            <div className="form-header">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <h1 className="form-title">
                    {step === "email" ? "Sign In or Join Now!" : step === "register" ? "Create Account" : "Welcome back"}
                  </h1>
                  <p className="form-subtitle">
                    {step === "email" ? "Login or create your account." : step === "register" ? "Enter your details to get started." : "Enter your password to continue."}
                  </p>
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
                    <Button className="btn btn-outline">
                      <Github size={20} style={{ marginRight: "0.75rem" }} />
                      Continue with GitHub
                    </Button>
                    <Button className="btn btn-outline">
                      <svg viewBox="0 0 24 24" width="20" height="20" style={{ marginRight: "0.75rem" }}>
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                      </svg>
                      Continue with Google
                    </Button>
                    <Button className="btn btn-outline">
                      <svg viewBox="0 0 23 23" width="20" height="20" style={{ marginRight: "0.75rem" }}>
                        <path fill="#f35325" d="M1 1h10v10H1z" />
                        <path fill="#81bc06" d="M12 1h10v10H12z" />
                        <path fill="#05a6f0" d="M1 12h10v10H1z" />
                        <path fill="#ffba08" d="M12 12h10v10H12z" />
                      </svg>
                      Continue with Microsoft
                    </Button>
                  </div>

                  <div className="divider">
                    <span>Or continue with email</span>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="input-group">
                      <div className="input-icon">
                        <Mail size={18} />
                      </div>
                      <Input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        type="email"
                        autoFocus
                      />
                    </div>
                    <Button type="submit" isLoading={isLoading} className="btn btn-primary">
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
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-zinc-500)' }}>Signing up as</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{email}</span>
                      </div>
                    </div>
                    <button onClick={() => setStep("email")} className="btn-ghost" style={{ height: 'auto', padding: '0.5rem' }}>Change</button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4 form-sign-up">
                    <Input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First Name"
                    />
                    <Input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last Name"
                    />
                    <Input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      type="password"
                    />
                    <Input
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      placeholder="Confirm Password"
                      type="password"
                    />
                    <Button type="submit" isLoading={isLoading} className="btn btn-primary">
                      Create Account
                    </Button>
                    <Button className="btn btn-ghost" onClick={() => setStep("email")} type="button">
                      <ArrowLeft size={16} style={{ marginRight: "0.5rem" }} /> Back
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
                  <div className="user-badge">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ background: 'var(--color-zinc-800)', borderRadius: '50%', padding: '4px' }}>
                        <CheckCircle2 size={16} color="#22c55e" />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-zinc-500)' }}>Logging in as</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{email}</span>
                      </div>
                    </div>
                    <button onClick={() => setStep("email")} className="btn-ghost" style={{ height: 'auto', padding: '0.5rem' }}>Change</button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="input-group">
                      <div className="input-icon"><Lock size={18} /></div>
                      <Input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        type="password"
                        autoFocus
                      />
                    </div>
                    <Button type="submit" isLoading={isLoading} className="btn btn-primary">
                      Sign In
                    </Button>
                    <Button className="btn btn-ghost" onClick={() => setStep("email")} type="button">
                      <ArrowLeft size={16} style={{ marginRight: "0.5rem" }} /> Back
                    </Button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            <p className="footer-text">
              By clicking continue, you agree to our <a href="#" className="footer-link">Terms</a> and <a href="#" className="footer-link">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}