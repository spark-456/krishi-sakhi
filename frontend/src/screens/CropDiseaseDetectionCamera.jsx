import React, { useState, useRef } from 'react';
import { Camera, Scan, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const CropDiseaseDetectionCamera = () => {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const [isScanning, setIsScanning] = useState(false);
    const [result, setResult] = useState(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState(null);

    const { session, user } = useAuth();
    const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        setImagePreviewUrl(URL.createObjectURL(file));
        setIsScanning(true);
        
        try {
            const formData = new FormData();
            formData.append('image', file, file.name);
            formData.append('farm_id', 'dummy-farm-id'); // Allow user selection later
            formData.append('farmer_id', user?.id || 'dummy-farmer-id');
            
            const resp = await fetch(`${API_BASE}/api/v1/scans/pest`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session?.access_token}` },
                body: formData,
            });
            const data = await resp.json();
            setResult({
                disease: data.disease || data.predicted_pest_or_disease || 'Unknown',
                confidence: data.confidence || `${Math.round((data.confidence_score||0) * 100)}%`,
                severity: data.severity || 'Unknown',
                treatment: data.treatment || data.treatment_hint || 'Consult Sakhi for treatment advice',
            });
        } catch (err) {
            console.error('Scan Error:', err);
            setResult({ 
                disease: 'Detection Failed', 
                confidence: '—', 
                severity: '—', 
                treatment: 'Please ensure the FastAPI backend is running locally.' 
            });
        } finally {
            setIsScanning(false);
        }
    };

    const handleCameraClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleRetake = () => {
        setResult(null);
        setImagePreviewUrl(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <div className="flex flex-col h-screen bg-black font-sans relative overflow-hidden">
            <div className="absolute top-0 w-full z-20 p-4 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent">
                <button onClick={() => navigate(-1)} className="p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors">
                    <X className="w-6 h-6" />
                </button>
                <div className="bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full text-white text-sm font-medium flex items-center gap-2">
                    <Scan className="w-4 h-4 text-green-400" /> Plant Scanner
                </div>
                <div className="w-10" />
            </div>

            <div className="flex-1 relative">
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                    <img
                        src="https://images.unsplash.com/photo-1620921575105-021021e1a533?q=80&w=600&auto=format&fit=crop"
                        alt="Fresh Mango"
                        className="w-full h-full max-w-sm max-h-[60vh] object-cover rounded-3xl shadow-2xl brightness-90 animate-fade-in"
                    />
                </div>
            </div>

            <div className="absolute bottom-0 w-full transition-transform duration-500 ease-in-out z-30 translate-y-0">
                <div className="bg-black/60 backdrop-blur-xl pb-10 pt-8 px-6 flex flex-col items-center border-t border-white/10 rounded-t-3xl">
                    <button
                        className="w-20 h-20 mb-4 rounded-full border-4 border-white flex items-center justify-center p-1 group disabled:opacity-50"
                    >
                        <div className="w-full h-full bg-white rounded-full flex items-center justify-center text-black">
                            <Camera className="w-8 h-8" />
                        </div>
                    </button>
                    <p className="text-white/70 text-sm font-medium">Camera Disabled for Demo</p>
                </div>
            </div>
        </div>
    );
};

export default CropDiseaseDetectionCamera;
