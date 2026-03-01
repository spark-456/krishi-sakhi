import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import WelcomeScreen from './screens/WelcomeScreen';
import PhoneNumberLogin from './screens/PhoneNumberLogin';
import FarmerRegistrationFlow from './screens/FarmerRegistrationFlow';
import HomeDashboard from './screens/HomeDashboard';
import MyFarmsAndCropsList from './screens/MyFarmsAndCropsList';
import AddNewFarmScreen from './screens/AddNewFarmScreen';
import AIAssistantChatScreen from './screens/AIAssistantChatScreen';
import FarmActivityLogs from './screens/FarmActivityLogs';
import FarmFinanceTracker from './screens/FarmFinanceTracker';
import CropDiseaseDetectionCamera from './screens/CropDiseaseDetectionCamera';

import BottomNavigation from './components/BottomNavigation';

const App = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      {/* Mobile container constraint for PWA feel on desktop */}
      <div className="w-full max-w-md bg-white min-h-screen shadow-2xl relative overflow-x-hidden pb-24">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<WelcomeScreen />} />
          <Route path="/login" element={<PhoneNumberLogin />} />
          <Route path="/register" element={<FarmerRegistrationFlow />} />

          {/* Main App Routes */}
          <Route path="/dashboard" element={<><HomeDashboard /><BottomNavigation /></>} />
          <Route path="/farms" element={<><MyFarmsAndCropsList /><BottomNavigation /></>} />
          <Route path="/add-farm" element={<AddNewFarmScreen />} />
          <Route path="/assistant" element={<><AIAssistantChatScreen /><BottomNavigation /></>} />
          <Route path="/activity" element={<><FarmActivityLogs /><BottomNavigation /></>} />
          <Route path="/finance" element={<FarmFinanceTracker />} />
          <Route path="/camera" element={<CropDiseaseDetectionCamera />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
};

export default App;
