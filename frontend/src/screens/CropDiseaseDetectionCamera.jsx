import React, { useState } from 'react';
import { Camera, Scan, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const CropDiseaseDetectionCamera = () => {
    const navigate = useNavigate();
    const [isScanning, setIsScanning] = useState(false);
    const [result, setResult] = useState(null);

    const handleCapture = () => {
        setIsScanning(true);
        // Simulate AI model processing time
        setTimeout(() => {
            setIsScanning(false);
            setResult({
                disease: "Wheat Rust (Puccinia triticina)",
                confidence: "92%",
                severity: "Moderate",
                treatment: "Apply Azoxystrobin (Amistar) at 200ml/acre immediately. Ensure complete leaf coverage during spraying."
            });
        }, 2500);
    };

    const handleRetake = () => {
        setResult(null);
    };

    return (
        <div className="flex flex-col h-screen bg-black font-sans relative overflow-hidden">

            {/* Top Navigation Overlay */}
            <div className="absolute top-0 w-full z-20 p-4 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent">
                <button onClick={() => navigate(-1)} className="p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors">
                    <X className="w-6 h-6" />
                </button>
                <div className="bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full text-white text-sm font-medium flex items-center gap-2">
                    <Scan className="w-4 h-4 text-green-400" /> Plant Scanner
                </div>
                <div className="w-10" /> {/* Spacer for alignment */}
            </div>

            {/* Main Camera Viewport (Simulated) */}
            <div className="flex-1 relative">
                {/* Placeholder image for camera feed since we can't access real hardware in demo */}
                <div className="absolute inset-0 bg-slate-900 flex items-center justify-center overflow-hidden">
                    <img
                        src="https://images.unsplash.com/photo-1592843993358-1f481be80562?q=80&w=600&auto=format&fit=crop"
                        alt="Simulated Camera Feed"
                        className={`w-full h-full object-cover transition-all duration-700 ${isScanning ? 'blur-sm scale-105 brightness-50' : ''} ${result ? 'brightness-50' : ''}`}
                    />
                </div>

                {/* Scanning Overlay UI */}
                {!result && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        {/* Viewfinder Frame */}
                        <div className="w-64 h-64 border-2 border-white/30 relative">
                            <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-white"></div>
                            <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-white"></div>
                            <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-white"></div>
                            <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-white"></div>

                            {/* Scanning Animation */}
                            {isScanning && (
                                <div className="absolute top-0 left-0 w-full h-1 bg-green-400 shadow-[0_0_15px_rgba(74,222,128,1)] animate-scan"></div>
                            )}
                        </div>

                        {!isScanning && (
                            <p className="absolute bottom-1/4 text-white text-sm font-medium bg-black/50 px-4 py-2 rounded-full backdrop-blur-md">
                                Align the affected leaf within the frame
                            </p>
                        )}
                    </div>
                )}

                {isScanning && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10 pointer-events-none">
                        <Scan className="w-12 h-12 text-green-400 animate-pulse mb-4" />
                        <p className="font-bold text-lg">Analyzing Plant...</p>
                        <p className="text-white/70 text-sm">Identifying diseases using AI</p>
                    </div>
                )}
            </div>

            {/* Bottom Controls / Result Sheet */}
            <div className={`absolute bottom-0 w-full transition-transform duration-500 ease-in-out z-30 ${result ? 'translate-y-0' : 'translate-y-0'}`}>
                {!result ? (
                    <div className="bg-black/60 backdrop-blur-xl pb-10 pt-8 px-6 flex flex-col items-center border-t border-white/10 rounded-t-3xl">
                        <button
                            onClick={handleCapture}
                            disabled={isScanning}
                            className="w-20 h-20 mb-4 rounded-full border-4 border-white flex items-center justify-center p-1 group disabled:opacity-50"
                        >
                            <div className="w-full h-full bg-white rounded-full group-hover:scale-95 group-active:scale-90 transition-transform flex items-center justify-center text-black">
                                {isScanning ? <Scan className="w-8 h-8 animate-spin" /> : <Camera className="w-8 h-8" />}
                            </div>
                        </button>
                        <p className="text-white/70 text-sm font-medium">Tap to scan for diseases</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-t-3xl p-6 pb-safe relative animate-in slide-in-from-bottom-full duration-300">
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-12 h-1.5 bg-slate-300 rounded-full"></div>

                        <div className="flex items-start gap-4 mb-6 pt-2">
                            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-600">
                                <AlertCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 leading-tight mb-1">{result.disease}</h2>
                                <div className="flex items-center gap-3">
                                    <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded-md">Confidence: {result.confidence}</span>
                                    <span className="bg-rose-50 text-rose-600 text-xs font-bold px-2 py-1 rounded-md">Severity: {result.severity}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 mb-6">
                            <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-primary" /> Recommended Treatment
                            </h3>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                {result.treatment}
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleRetake}
                                className="flex-1 py-3.5 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                            >
                                Retake Photo
                            </button>
                            <button
                                onClick={() => navigate('/assistant')}
                                className="flex-1 py-3.5 rounded-xl font-bold text-white bg-primary hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                            >
                                Ask Sakhi More
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Internal Custom Styles for Scanning Line */}
            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-scan {
          animation: scan 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}} />
        </div>
    );
};

export default CropDiseaseDetectionCamera;
