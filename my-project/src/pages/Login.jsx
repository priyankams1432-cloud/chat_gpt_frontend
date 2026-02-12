import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();
        if (email && password) {
            console.log('Login successful!');
            localStorage.setItem('access_token', 'logged_in');
            localStorage.setItem('user_email', email);
            navigate('/dashboard');
        }
    };

    return (
        <div style={styles.pageWrapper}>
            <div style={styles.loginCard}>
                <div style={styles.headerArea}>
                    <div style={styles.iconBox}>
                        <svg style={{ width: '24px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h2 style={styles.title}>Welcome back</h2>
                    <p style={styles.subtitle}>Sign in to access your dashboard</p>
                </div>

                <form onSubmit={handleSubmit} style={styles.form}>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Email Address</label>
                        <input
                            type="email"
                            placeholder="you@example.com"
                            style={styles.input}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Password</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            style={styles.input}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" style={styles.signInBtn}>
                        Sign in
                    </button>
                </form>

                <p style={styles.footerText}>
                    Don't have an account? <Link to="/signup" style={styles.link}>Create one</Link>
                </p>
            </div>
        </div>
    );
};

export default Login;

const styles = {
    pageWrapper: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'radial-gradient(circle at center, #2e266f 0%, #161231 100%)',
        fontFamily: '"Inter", sans-serif',
    },
    loginCard: {
        width: '100%',
        maxWidth: '400px',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(12px)',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '40px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    },
    headerArea: { textAlign: 'center', marginBottom: '30px' },
    iconBox: {
        width: '48px', height: '48px', background: 'linear-gradient(135deg, #8a63ff, #6b3df9)',
        borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px',
    },
    title: { color: 'white', fontSize: '1.8rem', fontWeight: '600' },
    subtitle: { color: '#94a3b8', fontSize: '0.9rem', marginTop: '5px' },
    form: { display: 'flex', flexDirection: 'column', gap: '20px' },
    inputGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
    label: { color: '#cbd5e1', fontSize: '0.85rem' },
    input: {
        padding: '12px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.1)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'white', outline: 'none', fontSize: '0.95rem',
    },
    signInBtn: {
        padding: '12px', borderRadius: '12px', border: 'none',
        background: 'linear-gradient(90deg, #7c3aed 0%, #9061ff 100%)',
        color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem',
    },
    footerText: { textAlign: 'center', marginTop: '25px', color: '#94a3b8', fontSize: '0.85rem' },
    link: { color: '#8a63ff', textDecoration: 'none' },
};