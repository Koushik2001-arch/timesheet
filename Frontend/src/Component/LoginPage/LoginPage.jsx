import React, { useState, useEffect } from 'react';
import emailjs from '@emailjs/browser';
import './LoginPage.css';
 
const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [empId, setEmpId] = useState('');
  const [name, setName] = useState(''); // ADDED
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [mode, setMode] = useState('login');
  const [isLoading, setIsLoading] = useState(false);
 
  const apiUrl = 'http://localhost:5000/api/auth';
 
  useEffect(() => {
    // Initialize EmailJS
    emailjs.init('7GYBQXMTl3qKogPnT');
   
    // Check for reset token in URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const action = params.get('action');
   
    if (token && action === 'reset') {
      setMode('reset');
      // Store token in session storage
      sessionStorage.setItem('resetToken', token);
     
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);
 
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);
 
    try {
      if (mode === 'login') {
        if (!email || !pass) {
          throw new Error('Email and password required');
        }
 
        const res = await fetch(`${apiUrl}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: pass }),
        });
 
        const data = await res.json();
       
        if (res.ok) {
          localStorage.setItem('token', data.token);
          // Store user info in localStorage
          const payload = JSON.parse(atob(data.token.split('.')[1]));
          localStorage.setItem('userDetails', JSON.stringify(payload));
          window.location.href = '/dashboard';
        } else {
          throw new Error(data.message || 'Login failed');
        }
      }
 
      if (mode === 'admin') {
        if (!empId || !pass) {
          throw new Error('Admin EMP ID and password required');
        }
 
        const res = await fetch(`${apiUrl}/admin-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ empId, password: pass }),
        });
 
        const data = await res.json();
       
        if (res.ok) {
          localStorage.setItem('token', data.token);
          window.location.href = '/admin-dashboard';
        } else {
          throw new Error(data.message || 'Admin login failed');
        }
      }
 
      if (mode === 'signup') {
        if (!empId || !email || !pass || !name) { // UPDATED
          throw new Error('All fields required');
        }
 
        if (pass.length < 8) {
          throw new Error('Password must be at least 8 characters');
        }
 
        const res = await fetch(`${apiUrl}/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ empId, email, password: pass, name }), // UPDATED
        });
 
        const data = await res.json();
       
        if (res.ok) {
          setSuccessMessage('✓ Request sent to admin. Wait for approval.');
          setEmpId('');
          setEmail('');
          setPass('');
          setName(''); // ADDED
        } else {
          throw new Error(data.message || 'Signup failed');
        }
      }
 
      if (mode === 'forgot') {
        if (!empId && !email) {
          throw new Error('Provide EMP ID or Email');
        }
 
        const res = await fetch(`${apiUrl}/request-reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ empId, email }),
        });
 
        const data = await res.json();
       
        if (res.ok) {
          setSuccessMessage('✓ Reset request sent to admin. They will email you a reset link.');
          setEmpId('');
          setEmail('');
        } else {
          throw new Error(data.message || 'Reset request failed');
        }
      }
 
      if (mode === 'reset') {
        const token = sessionStorage.getItem('resetToken');
       
        if (!token) {
          throw new Error('Invalid reset link');
        }
 
        if (!pass || !confirmPass) {
          throw new Error('Both password fields are required');
        }
 
        if (pass !== confirmPass) {
          throw new Error('Passwords do not match');
        }
 
        if (pass.length < 8) {
          throw new Error('Password must be at least 8 characters');
        }
 
        const res = await fetch(`${apiUrl}/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, newPassword: pass }),
        });
 
        const data = await res.json();
       
        if (res.ok) {
          setSuccessMessage('✓ Password updated successfully! Redirecting to login...');
          sessionStorage.removeItem('resetToken');
         
          setTimeout(() => {
            setMode('login');
            setPass('');
            setConfirmPass('');
            setEmpId('');
          }, 2000);
        } else {
          throw new Error(data.message || 'Password reset failed');
        }
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };
 
  const switchMode = (newMode) => {
    setMode(newMode);
    setErrorMessage('');
    setSuccessMessage('');
    setEmail('');
    setPass('');
    setConfirmPass('');
    setEmpId('');
    setName(''); // ADDED
  };
 
  return (
    <div className="login-wrapper">
      <div className="login-left">
        <h1 className="promo-title">
          WELCOME <span className="brand">AROHAK</span>
        </h1>
        <p className="promo-text">
          Attitude determines altitude. Join AROHAK to soar high with the right attitude and mindset for success.
        </p>
      </div>
      <div className="login-right">
        <form onSubmit={handleSubmit} className="login-form">
          <h2 className="form-title">
            {mode === 'login' && 'AROHAK TIME SHEET'}
            {mode === 'signup' && 'Sign Up'}
            {mode === 'forgot' && 'Forgot Password'}
            {mode === 'reset' && 'Set New Password'}
            {mode === 'admin' && 'Admin Login'}
          </h2>
 
          {mode === 'login' && (
            <>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="form-input"
                required
                disabled={isLoading}
              />
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="Password"
                className="form-input"
                required
                disabled={isLoading}
              />
            </>
          )}
 
          {mode === 'admin' && (
            <>
              <input
                type="text"
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                placeholder="Admin EMP ID"
                className="form-input"
                required
                disabled={isLoading}
              />
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="Password"
                className="form-input"
                required
                disabled={isLoading}
              />
            </>
          )}
 
          {mode === 'signup' && (
            <>
              <input
                type="text"
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                placeholder="EMP ID"
                className="form-input"
                required
                disabled={isLoading}
              />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full Name"
                className="form-input"
                required
                disabled={isLoading}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="form-input"
                required
                disabled={isLoading}
              />
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="Password (min 8 characters)"
                className="form-input"
                required
                minLength="8"
                disabled={isLoading}
              />
            </>
          )}
 
          {mode === 'forgot' && (
            <>
              <input
                type="text"
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                placeholder="EMP ID (optional)"
                className="form-input"
                disabled={isLoading}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="form-input"
                disabled={isLoading}
              />
              <p style={{ fontSize: '12px', color: '#666', marginTop: '-5px', marginBottom: '10px' }}>
                Provide at least one field
              </p>
            </>
          )}
 
          {mode === 'reset' && (
            <>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="New Password (min 8 characters)"
                className="form-input"
                required
                minLength="8"
                disabled={isLoading}
              />
              <input
                type="password"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                placeholder="Confirm New Password"
                className="form-input"
                required
                disabled={isLoading}
              />
            </>
          )}
 
          <button type="submit" className="form-button" disabled={isLoading}>
            {isLoading ? 'Processing...' : (
              mode === 'login' ? 'Login' :
              mode === 'signup' ? 'Sign Up' :
              mode === 'forgot' ? 'Send Request' :
              mode === 'reset' ? 'Update Password' :
              'Admin Login'
            )}
          </button>
 
          {successMessage && <p className="form-success">{successMessage}</p>}
          {errorMessage && <p className="form-error">{errorMessage}</p>}
 
          {mode !== 'reset' && (
            <>
              <div className="form-divider">or</div>
              <div className="social-login">
                <button type="button" className="form-request" onClick={() => switchMode('login')}>
                  Login
                </button>
                <button type="button" className="form-request" onClick={() => switchMode('signup')}>
                  Sign Up
                </button>
                <button type="button" className="form-request" onClick={() => switchMode('forgot')}>
                  Forgot Password
                </button>
                <button type="button" className="form-request" onClick={() => switchMode('admin')}>
                  Admin Sign In
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
 
 
 
 
export default LoginPage;
 