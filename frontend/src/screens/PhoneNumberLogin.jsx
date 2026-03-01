import React, { useState } from 'react';
import { Phone, ArrowRight, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PhoneNumberLogin = () => {
    const navigate = useNavigate();
    const [phone, setPhone] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const inputRefs = React.useRef([]);

    const handleSendOtp = (e) => {
        e.preventDefault();
        if (phone.length === 10) setOtpSent(true);
    };

    const handleOtpChange = (value, index) => {
        const newOtp = [...otp];
        newOtp[index] = value.substring(value.length - 1);
        setOtp(newOtp);

        // Move to next input if value is entered
        if (value && index < 5) {
            inputRefs.current[index + 1].focus();
        }
    };

    const handleKeyDown = (e, index) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1].focus();
        }
    };

    const handleVerify = () => {
        // Navigate to registration if new user, dashboard if returning
        navigate('/register');
    };

    return (
        <div className="flex flex-col min-h-screen bg-white font-sans">
            {/* Hero Illustration */}
            <div className="bg-gradient-to-b from-primary/20 to-transparent pt-12 pb-6 px-6 relative rounded-b-[3rem]">
                <div className="w-full max-w-xs mx-auto aspect-square bg-white shadow-xl rounded-full flex items-center justify-center p-8 relative z-10">
                    <div className="text-8xl">👩🏽‍🌾</div>
                    {/* Decorative floating elements */}
                    <div className="absolute top-4 right-4 bg-green-100 p-2 rounded-full shadow-sm animate-bounce">🌱</div>
                    <div className="absolute bottom-10 left-0 bg-yellow-100 p-2 rounded-full shadow-sm animate-pulse">☀️</div>
                </div>
            </div>

            {/* Content Form */}
            <div className="flex-1 px-6 pt-10 pb-12 flex flex-col">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Welcome to Krishi Sakhi</h1>
                    <p className="text-slate-500 font-medium">Your personalized smart farming companion</p>
                </div>

                {!otpSent ? (
                    <form onSubmit={handleSendOtp} className="space-y-6 flex-1 flex flex-col">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 ml-1">Mobile Number</label>
                            <div className="relative flex items-center">
                                <div className="absolute left-0 pl-4 flex items-center pointer-events-none">
                                    <span className="text-slate-500 font-medium">+91</span>
                                    <div className="h-5 w-px bg-slate-300 mx-3"></div>
                                </div>
                                <input
                                    type="tel"
                                    maxLength="10"
                                    className="w-full pl-20 pr-4 py-4 rounded-2xl border-2 border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-lg font-medium outline-none bg-slate-50"
                                    placeholder="Enter 10 digit number"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                                />
                                <Phone className="absolute right-4 text-slate-400 w-5 h-5 pointer-events-none" />
                            </div>
                        </div>

                        <div className="mt-auto pt-6 space-y-4">
                            <button
                                type="submit"
                                disabled={phone.length !== 10}
                                className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-bold text-lg shadow-[0_8px_30px_rgb(22,163,74,0.3)] hover:shadow-[0_8px_30px_rgb(22,163,74,0.4)] disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                            >
                                Get OTP
                                <ArrowRight className="w-5 h-5" />
                            </button>
                            <div className="flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
                                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                <span>Secure & OTP based login</span>
                            </div>
                        </div>
                    </form>
                ) : (
                    <div className="space-y-6 flex-1 flex flex-col animate-in slide-in-from-right-8 duration-300">
                        <div className="text-center">
                            <p className="text-sm font-medium text-slate-600 mb-6">
                                Enter the 6-digit code sent to <br /><span className="font-bold text-slate-900">+91 {phone}</span>
                                <button onClick={() => setOtpSent(false)} className="text-primary text-xs ml-2 underline">Edit</button>
                            </p>
                        </div>

                        <div className="flex justify-between gap-2 px-2">
                            {otp.map((digit, idx) => (
                                <input
                                    key={idx}
                                    ref={(el) => (inputRefs.current[idx] = el)}
                                    type="text"
                                    maxLength="1"
                                    className="w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 bg-slate-50 outline-none transition-all"
                                    placeholder="-"
                                    value={digit}
                                    onChange={(e) => handleOtpChange(e.target.value, idx)}
                                    onKeyDown={(e) => handleKeyDown(e, idx)}
                                />
                            ))}
                        </div>

                        <div className="text-center">
                            <p className="text-sm font-medium text-slate-500">Didn't receive code? <button className="text-primary font-bold">Resend in 0:45</button></p>
                        </div>

                        <div className="mt-auto pt-6">
                            <button
                                onClick={handleVerify}
                                className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-bold text-lg shadow-[0_8px_30px_rgb(22,163,74,0.3)] hover:shadow-[0_8px_30px_rgb(22,163,74,0.4)] transition-all"
                            >
                                Verify & Continue
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PhoneNumberLogin;
