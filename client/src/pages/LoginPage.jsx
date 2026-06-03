import React, { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, ArrowRight, RefreshCw, ChevronLeft } from 'lucide-react';
import { sendOTP, verifyOTP, resetOtp, selectAuthLoading } from '@/store/slices/authSlice';
import toast from 'react-hot-toast';

const SERVICES_PREVIEW = ['AC Repair', 'Home Cleaning', 'Plumbing', 'Electrical', 'Pest Control', 'Painting'];

export default function LoginPage() {
  const dispatch = useDispatch();
  const loading = useSelector(selectAuthLoading);
  const { otpSent, otpPhone } = useSelector(s => s.auth);

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [role, setRole] = useState('customer');
  const [name, setName] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const otpRefs = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (otpSent) startResendTimer();
    return () => clearInterval(timerRef.current);
  }, [otpSent]);

  function startResendTimer() {
    setResendTimer(30);
    timerRef.current = setInterval(() => {
      setResendTimer(t => { if (t <= 1) { clearInterval(timerRef.current); return 0; } return t - 1; });
    }, 1000);
  }

  function handlePhoneChange(e) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(val);
  }

  function handleSendOTP(e) {
    e.preventDefault();
    if (phone.length !== 10) return toast.error('Enter a valid 10-digit number');
    dispatch(sendOTP({ phone, role }));
  }

  function handleOTPChange(index, value) {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
    if (newOtp.every(d => d) && newOtp.join('').length === 6) {
      handleVerify(newOtp.join(''));
    }
  }

  function handleOTPKeyDown(index, e) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleVerify(code) {
    const otpCode = code || otp.join('');
    if (otpCode.length !== 6) return toast.error('Enter the complete 6-digit OTP');
    const payload = { phone: otpPhone, otp: otpCode, role };
    if (name.trim()) payload.name = name.trim();
    dispatch(verifyOTP(payload));
  }

  function handleResend() {
    if (resendTimer > 0) return;
    dispatch(sendOTP({ phone: otpPhone, role }));
  }

  function handleBack() {
    dispatch(resetOtp());
    setOtp(['', '', '', '', '', '']);
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-primary-700 via-primary-600 to-blue-500">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-16 text-white">
        <div>
          <div className="text-3xl font-bold tracking-tight mb-2">⚡ ServiceHub</div>
          <p className="text-primary-200 text-sm">Professional Home Services</p>
        </div>
        <div>
          <h1 className="text-5xl font-bold leading-tight mb-6">
            Your home,<br />
            <span className="text-blue-200">expertly cared for.</span>
          </h1>
          <p className="text-primary-100 text-lg mb-10">
            Book trusted professionals for AC repair, cleaning, plumbing, and 50+ services — at your doorstep.
          </p>
          <div className="flex flex-wrap gap-2">
            {SERVICES_PREVIEW.map(s => (
              <span key={s} className="bg-white/15 backdrop-blur-sm text-white text-sm px-3 py-1.5 rounded-full border border-white/20">
                {s}
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-8 text-sm text-primary-200">
          <div><div className="text-2xl font-bold text-white">10M+</div>Happy Customers</div>
          <div><div className="text-2xl font-bold text-white">50K+</div>Verified Pros</div>
          <div><div className="text-2xl font-bold text-white">4.8★</div>Avg. Rating</div>
        </div>
      </div>

      {/* Right panel — auth form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-8 text-center lg:hidden">
            <div className="text-2xl font-bold text-primary-700">⚡ ServiceHub</div>
          </div>

          <AnimatePresence mode="wait">
            {!otpSent ? (
              <motion.div key="phone" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-2xl font-bold text-slate-900 mb-1">Welcome back!</h2>
                <p className="text-slate-500 text-sm mb-8">Enter your phone number to continue</p>

                {/* Role selector */}
                <div className="flex bg-slate-100 rounded-xl p-1 mb-6 gap-1">
                  {[{ id: 'customer', label: '👤 Customer' }, { id: 'provider', label: '🔧 Provider' }].map(r => (
                    <button
                      key={r.id}
                      onClick={() => setRole(r.id)}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                        role === r.id ? 'bg-white shadow text-primary-700' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSendOTP} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
                    <div className="flex items-center border-2 border-slate-200 rounded-xl focus-within:border-primary-500 transition-colors">
                      <span className="pl-4 pr-2 text-slate-500 font-medium text-sm">+91</span>
                      <div className="w-px h-5 bg-slate-200 mx-1" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={handlePhoneChange}
                        placeholder="9876543210"
                        className="flex-1 py-3 pr-4 bg-transparent outline-none text-slate-900 font-medium placeholder:text-slate-400"
                        maxLength={10}
                        autoFocus
                      />
                      <Phone size={18} className="text-slate-400 mr-4" />
                    </div>
                  </div>

                  {role === 'provider' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Your Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Full name"
                        className="input-field"
                      />
                    </div>
                  )}

                  <button type="submit" disabled={loading || phone.length !== 10} className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base">
                    {loading ? <span className="animate-spin">↻</span> : <>Get OTP <ArrowRight size={18} /></>}
                  </button>
                </form>

                <p className="text-center text-xs text-slate-400 mt-6">
                  By continuing, you agree to our{' '}
                  <a href="#" className="text-primary-600 underline">Terms</a> &{' '}
                  <a href="#" className="text-primary-600 underline">Privacy Policy</a>
                </p>
              </motion.div>
            ) : (
              <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <button onClick={handleBack} className="flex items-center gap-1 text-slate-500 hover:text-slate-700 mb-6 text-sm">
                  <ChevronLeft size={16} /> Back
                </button>
                <h2 className="text-2xl font-bold text-slate-900 mb-1">Enter OTP</h2>
                <p className="text-slate-500 text-sm mb-8">
                  Sent to <span className="font-semibold text-slate-700">+91 {otpPhone}</span>
                </p>

                <div className="flex gap-3 justify-center mb-8">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => otpRefs.current[i] = el}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOTPChange(i, e.target.value)}
                      onKeyDown={e => handleOTPKeyDown(i, e)}
                      className={`w-12 h-14 text-center text-xl font-bold border-2 rounded-xl outline-none transition-all
                        ${digit ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 bg-slate-50'}
                        focus:border-primary-500`}
                      autoFocus={i === 0}
                    />
                  ))}
                </div>

                <button
                  onClick={() => handleVerify()}
                  disabled={loading || otp.join('').length !== 6}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base mb-4"
                >
                  {loading ? <span className="animate-spin">↻</span> : 'Verify OTP'}
                </button>

                <div className="text-center">
                  {resendTimer > 0 ? (
                    <p className="text-slate-400 text-sm">Resend OTP in {resendTimer}s</p>
                  ) : (
                    <button onClick={handleResend} className="text-primary-600 text-sm font-medium flex items-center gap-1 mx-auto hover:underline">
                      <RefreshCw size={14} /> Resend OTP
                    </button>
                  )}
                </div>

                {import.meta.env.DEV && (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                    <p className="text-xs text-amber-700 font-medium">Dev mode: OTP is <strong>123456</strong></p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
