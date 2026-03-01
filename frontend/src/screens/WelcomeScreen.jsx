import React from 'react';
import { ArrowRight, Leaf } from 'lucide-react';
import { Link } from 'react-router-dom';

const WelcomeScreen = () => {
    return (
        <div className="flex flex-col min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 font-sans relative overflow-hidden">
            {/* Decorative Background Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-green-400/20 rounded-full blur-3xl mix-blend-multiply"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-80 h-80 bg-emerald-400/20 rounded-full blur-3xl mix-blend-multiply"></div>

            <main className="flex-1 flex flex-col pt-12 px-6 relative z-10">
                <div className="flex justify-end mb-8">
                    <Link to="/login" className="text-sm font-bold text-green-700 bg-white/50 backdrop-blur-md px-4 py-2 rounded-full border border-green-200 hover:bg-white/80 transition-colors shadow-sm">
                        Log In
                    </Link>
                </div>

                <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
                    {/* Logo area */}
                    <div className="w-20 h-20 bg-white rounded-2xl shadow-xl flex items-center justify-center mb-8 transform -rotate-6">
                        <Leaf className="w-10 h-10 text-primary" />
                    </div>

                    <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight leading-tight mb-4">
                        Cultivate <br /><span className="text-primary">Success</span> Together.
                    </h1>

                    <p className="text-lg text-slate-600 font-medium leading-relaxed mb-10">
                        Your AI-powered agricultural companion for disease detection, smart farming tips, and financial tracking.
                    </p>

                    <Link
                        to="/login"
                        className="w-full bg-primary text-white py-4 px-6 rounded-2xl font-bold text-lg shadow-[0_8px_30px_rgb(22,163,74,0.3)] hover:shadow-[0_8px_30px_rgb(22,163,74,0.4)] hover:-translate-y-0.5 transition-all flex items-center justify-between group"
                    >
                        Get Started
                        <div className="bg-white/20 p-2 rounded-xl group-hover:bg-white/30 transition-colors">
                            <ArrowRight className="w-5 h-5" />
                        </div>
                    </Link>
                </div>
            </main>

            {/* Decorative Bottom Graphic */}
            <div className="h-40 w-full relative z-0 opacity-80 pointer-events-none mt-auto">
                <svg viewBox="0 0 1440 320" className="absolute bottom-0 w-full h-full preserve-3d" preserveAspectRatio="none">
                    <path fill="#22c55e" fillOpacity="0.1" d="M0,160L48,170.7C96,181,192,203,288,186.7C384,171,480,117,576,117.3C672,117,768,171,864,197.3C960,224,1056,224,1152,213.3C1248,203,1344,181,1392,170.7L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
                    <path fill="#16a34a" fillOpacity="0.2" d="M0,224L60,213.3C120,203,240,181,360,181.3C480,181,600,203,720,218.7C840,235,960,245,1080,218.7C1200,192,1320,128,1380,96L1440,64L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"></path>
                </svg>
            </div>
        </div>
    );
};

export default WelcomeScreen;
