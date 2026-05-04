/**
 * CropDiseaseDetectionCamera — Soil Scanner
 * ──────────────────────────────────────────
 * Lets the user pick/capture a soil image → calls /scans/soil-with-advisory
 * → shows ML loading → redirects to /assistant with the soil result pre-loaded.
 */
import React, { useState, useRef, useCallback } from 'react';
import { Camera, Scan, X, Loader2, ScanLine, Leaf } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { API_BASE } from '../lib/apiBase';

const SOIL_EMOJI = {
    alluvial: '🌾',
    black: '⚫',
    clay: '🟤',
    loam: '🌿',
    red: '🔴',
    sandy: '⚪',
};

const CropDiseaseDetectionCamera = () => {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const videoRef = useRef(null);
    const streamRef = useRef(null);

    const [phase, setPhase] = useState('idle'); // idle | scanning | result | error
    const [scanMode, setScanMode] = useState('soil'); // 'soil' | 'pest'
    const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
    const [scanResult, setScanResult] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');

    const { session, user } = useAuth();

    /** Shared handler: receives a File and POSTs to /scans/soil-with-advisory */
    const processSoilImage = useCallback(async (file) => {
        if (!file) return;

        setImagePreviewUrl(URL.createObjectURL(file));
        setPhase('scanning');
        setErrorMsg('');

        try {
            const formData = new FormData();
            formData.append('image', file, file.name || 'soil.jpg');
            // farm_id is optional in soil-with-advisory - omit to skip DB storage if none
            // formData.append('farm_id', '');

            const endpoint = scanMode === 'pest' ? '/scans/pest' : '/scans/soil-with-advisory';
            const resp = await fetch(`${API_BASE}/api/v1${endpoint}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session?.access_token}`,
                },
                body: formData,
            });

            if (!resp.ok) {
                const errData = await resp.json().catch(() => ({}));
                throw new Error(errData.detail || `Server error ${resp.status}`);
            }

            const data = await resp.json();
            setScanResult(data);
            setPhase('result');
        } catch (err) {
            console.error('[Soil Scanner] Error:', err);
            setErrorMsg(err.message || 'Scan failed. Ensure the backend is running.');
            setPhase('error');
        }
    }, [session, scanMode]);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) processSoilImage(file);
    };

    const handleRetake = () => {
        setPhase('idle');
        setImagePreviewUrl(null);
        setScanResult(null);
        setErrorMsg('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Camera Stream Logic
    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            streamRef.current = stream;
        } catch (err) {
            console.warn('Camera permission denied or not available:', err);
            // Fallback: It will just be a black box, users can still use gallery
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };

    React.useEffect(() => {
        if (phase === 'idle') {
            startCamera();
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [phase]);

    const handleCapture = () => {
        if (!videoRef.current || !streamRef.current) {
            // Fallback if camera stream failed: just trigger the old file input 
            // Wait, we removed the camera input. Let's just alert if no camera.
            alert("Camera not available. Please use the Gallery upload.");
            return;
        }
        
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
            if (!blob) return;
            const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
            processSoilImage(file);
        }, 'image/jpeg', 0.8);
    };

    const handleAskSakhi = () => {
        if (!scanResult) return;
        navigate('/assistant', {
            state: Object.assign({}, 
                scanMode === 'soil' ? {
                    soilScanResult: {
                        soilClass: scanResult.predicted_soil_class,
                        confidence: scanResult.confidence_pct,
                        description: scanResult.description,
                        tip: scanResult.tip,
                        advisoryText: scanResult.advisory_text,
                    }
                } : {
                    pestScanResult: scanResult,
                    prefillMessage: `I scanned my crop and the likely issue is ${scanResult.predicted_pest_or_disease || scanResult.disease}. How serious is it and what should I do today?`,
                }
            )
        });
    };

    const handleRaiseTicketFromScan = () => {
        if (!scanResult || scanMode !== 'pest') return;
        navigate('/assistant', {
            state: {
                pestScanResult: scanResult,
                prefillMessage: `Create a support ticket for my crop issue. The scan suggests ${scanResult.predicted_pest_or_disease || scanResult.disease}. Include that I need guidance urgently if needed.`,
                autoSendPrefill: true,
            }
        });
    };

    /* ─── IDLE / CAMERA UI ─────────────────────────────────── */
    if (phase === 'idle') {
        return (
            <div className="flex flex-col h-screen bg-black font-sans relative overflow-hidden">
                {/* Hidden input for Gallery */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                />

                {/* Top bar */}
                <div className="absolute top-0 w-full z-20 p-4 flex justify-between items-center bg-gradient-to-b from-black/70 to-transparent">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                    <div className="bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full text-white text-sm font-medium flex items-center gap-2">
                        <ScanLine className="w-4 h-4 text-green-400" />
                        {scanMode === 'pest' ? 'Pest & Disease' : 'Soil Scanner'}
                    </div>
                    <div className="w-10" />
                </div>

                {/* Preview area */}
                <div className="flex-1 relative flex flex-col items-center justify-center -mt-8">
                    <div className="flex bg-white/10 rounded-full p-1 mb-6 backdrop-blur-md border border-white/20 z-20">
                        <button 
                            onClick={() => setScanMode('soil')}
                            className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${scanMode === 'soil' ? 'bg-green-500 text-white shadow-lg' : 'text-white/60 hover:text-white'}`}
                        >
                            Soil Type
                        </button>
                        <button 
                            onClick={() => setScanMode('pest')}
                            className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${scanMode === 'pest' ? 'bg-green-500 text-white shadow-lg' : 'text-white/60 hover:text-white'}`}
                        >
                            Pest Scan
                        </button>
                    </div>

                    <div className="relative w-72 h-72 rounded-3xl overflow-hidden shadow-2xl border-2 border-white/20 bg-zinc-900">
                        <video 
                            ref={videoRef} 
                            autoPlay 
                            playsInline 
                            muted
                            className="w-full h-full object-cover"
                        />
                        {/* Scanning overlay animation */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-48 h-48 border-2 border-green-400 rounded-xl relative">
                                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-green-400 rounded-tl-sm" />
                                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-green-400 rounded-tr-sm" />
                                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-green-400 rounded-bl-sm" />
                                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-green-400 rounded-br-sm" />
                            </div>
                        </div>
                    </div>
                    <p className="absolute bottom-6 text-white/60 text-sm text-center px-6">
                        Position {scanMode === 'pest' ? 'leaf/crop' : 'soil'} clearly in frame, then capture or upload
                    </p>
                </div>

                {/* Bottom controls */}
                <div className="absolute bottom-0 w-full z-30">
                    <div className="bg-black/70 backdrop-blur-xl pb-10 pt-6 px-6 border-t border-white/10 rounded-t-3xl">
                        <div className="flex items-center justify-center gap-6">
                            {/* Gallery */}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex flex-col items-center gap-1.5 text-white/70 hover:text-white transition-colors"
                            >
                                <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
                                    <Leaf className="w-5 h-5" />
                                </div>
                                <span className="text-xs font-medium">Gallery</span>
                            </button>

                            {/* Camera capture */}
                            <button
                                onClick={handleCapture}
                                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center hover:scale-105 transition-transform active:scale-95"
                            >
                                <div className="w-full h-full bg-white rounded-full flex items-center justify-center text-black m-1">
                                    <Camera className="w-8 h-8" />
                                </div>
                            </button>

                            {/* Placeholder for symmetry */}
                            <div className="w-12 h-12" />
                        </div>
                        <p className="text-center text-white/50 text-xs mt-4 font-medium">
                            Tap camera to capture • Gallery to upload
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    /* ─── SCANNING / ML LOADING ────────────────────────────── */
    if (phase === 'scanning') {
        return (
            <div className="flex flex-col h-screen bg-black items-center justify-center font-sans relative overflow-hidden">
                {imagePreviewUrl && (
                    <img
                        src={imagePreviewUrl}
                        alt="Scanning"
                        className="absolute inset-0 w-full h-full object-cover brightness-30 blur-sm"
                    />
                )}
                <div className="relative z-10 flex flex-col items-center gap-6 px-8">
                    {/* Animated scanning ring */}
                    <div className="relative w-32 h-32">
                        <div className="absolute inset-0 rounded-full border-4 border-green-400/30 animate-ping" />
                        <div className="absolute inset-0 rounded-full border-4 border-green-400 animate-spin border-t-transparent" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Scan className="w-10 h-10 text-green-400" />
                        </div>
                    </div>
                    <div className="text-center">
                        <h2 className="text-white text-2xl font-bold tracking-tight mb-2">
                            ML Loading...
                        </h2>
                        <p className="text-white/60 text-sm leading-relaxed">
                            {scanMode === 'pest' ? 'Analyzing plant health and disease signals' : 'Classifying soil type and preparing'}<br />
                            {scanMode === 'pest' ? 'from your crop image' : 'your personalised advisory from Sakhi'}
                        </p>
                    </div>
                    <div className="flex gap-1.5 mt-2">
                        {[0, 1, 2].map((i) => (
                            <div
                                key={i}
                                className="w-2 h-2 rounded-full bg-green-400 animate-bounce"
                                style={{ animationDelay: `${i * 150}ms` }}
                            />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    /* ─── ERROR ────────────────────────────────────────────── */
    if (phase === 'error') {
        return (
            <div className="flex flex-col h-screen bg-black items-center justify-center font-sans p-8">
                {imagePreviewUrl && (
                    <img
                        src={imagePreviewUrl}
                        alt="Failed"
                        className="absolute inset-0 w-full h-full object-cover brightness-20 blur-sm"
                    />
                )}
                <div className="relative z-10 flex flex-col items-center gap-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center">
                        <X className="w-8 h-8 text-red-400" />
                    </div>
                    <h2 className="text-white text-xl font-bold">Scan Failed</h2>
                    <p className="text-white/60 text-sm">{errorMsg}</p>
                    <button
                        onClick={handleRetake}
                        className="mt-4 px-8 py-3 bg-white text-black font-semibold rounded-2xl hover:bg-white/90 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    /* ─── RESULT ───────────────────────────────────────────── */
    const isPest = scanMode === 'pest';
    const soilEmoji = isPest ? '🐛' : (SOIL_EMOJI[scanResult?.predicted_soil_class] || '🌱');
    
    let label = 'Unknown';
    if (isPest) {
        label = scanResult?.predicted_pest_or_disease || scanResult?.disease || scanResult?.predicted_disease || 'Unknown Pest';
        label = label.charAt(0).toUpperCase() + label.slice(1);
    } else if (scanResult?.predicted_soil_class) {
        label = scanResult.predicted_soil_class.charAt(0).toUpperCase() + scanResult.predicted_soil_class.slice(1) + ' Soil';
    }

    return (
        <div className="flex flex-col h-screen bg-black font-sans relative overflow-hidden">
            {/* Blurred preview background */}
            {imagePreviewUrl && (
                <img
                    src={imagePreviewUrl}
                    alt="Soil"
                    className="absolute inset-0 w-full h-full object-cover brightness-40 blur-xl"
                />
            )}

            {/* Top bar */}
            <div className="absolute top-0 w-full z-20 p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
                <button
                    onClick={handleRetake}
                    className="p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>
                <div className="bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full text-white text-sm font-medium flex items-center gap-2">
                    <ScanLine className="w-4 h-4 text-green-400" />
                    Scan Complete
                </div>
                <div className="w-10" />
            </div>

            {/* Preview image (small) */}
            <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-6 pt-16 pb-4">
                {imagePreviewUrl && (
                    <div className="w-36 h-36 rounded-2xl overflow-hidden border-2 border-white/30 shadow-2xl mb-6">
                        <img src={imagePreviewUrl} alt="Soil sample" className="w-full h-full object-cover" />
                    </div>
                )}

                {/* Result card */}
                <div className="w-full bg-black/60 backdrop-blur-xl rounded-3xl border border-white/10 p-6 shadow-2xl">
                    {/* Soil type header */}
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-14 h-14 rounded-2xl bg-green-500/20 border border-green-500/40 flex items-center justify-center text-3xl flex-shrink-0">
                            {soilEmoji}
                        </div>
                        <div>
                            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">
                                {isPest ? 'Detected Issue' : 'Detected Soil Type'}
                            </p>
                            <h2 className="text-white text-2xl font-bold">{label}</h2>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <div className="h-1.5 rounded-full bg-green-500" style={{ width: `${scanResult?.confidence_pct || scanResult?.confidence || 87}%`, maxWidth: '80px' }} />
                                <span className="text-green-400 text-xs font-bold">{scanResult?.confidence_pct || scanResult?.confidence || 87}% confidence</span>
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="bg-white/5 rounded-2xl p-4 mb-3">
                        <p className="text-white/80 text-sm leading-relaxed">{scanResult?.description}</p>
                    </div>

                    {/* Tip */}
                    <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-3">
                        <p className="text-green-300 text-xs font-semibold mb-1">💡 Management Tip</p>
                        <p className="text-green-100 text-sm leading-relaxed">{scanResult?.tip}</p>
                    </div>
                </div>
            </div>

            {/* CTA buttons */}
            <div className="relative z-10 px-6 pb-10 pt-2 flex flex-col gap-3">
                <button
                    onClick={handleAskSakhi}
                    className="w-full py-4 bg-green-500 hover:bg-green-400 active:scale-95 text-white font-bold text-base rounded-2xl transition-all shadow-lg shadow-green-500/30 flex items-center justify-center gap-2"
                >
                    <span>👩🏽‍🌾</span>
                    Ask Sakhi for Detailed Advisory
                </button>
                {isPest && (
                    <button
                        onClick={handleRaiseTicketFromScan}
                        className="w-full py-3 bg-amber-500/90 hover:bg-amber-500 active:scale-95 text-white font-semibold text-sm rounded-2xl transition-all"
                    >
                        Raise Support Ticket from This Scan
                    </button>
                )}
                <button
                    onClick={handleRetake}
                    className="w-full py-3 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-semibold text-sm rounded-2xl transition-all border border-white/10"
                >
                    Scan Another Image
                </button>
            </div>
        </div>
    );
};

export default CropDiseaseDetectionCamera;
