/**
 * App — Root Component & Router
 * ─────────────────────────────
 * Defines all routes. Protected routes wrapped in AuthGuard.
 * BottomNavigation shown on authenticated app screens.
 *
 * @see frontend-engineer.md §2 — Screen Inventory
 * @see frontend-engineer.md §5 — Auth Guard Pattern
 */
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
import AuthGuard from './components/AuthGuard';

const App = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      {/* Mobile container constraint for PWA feel on desktop */}
      <div className="w-full max-w-md bg-white min-h-screen shadow-2xl relative overflow-x-hidden pb-24">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<WelcomeScreen />} />
          <Route path="/login" element={<PhoneNumberLogin />} />

          {/* Registration — needs auth session but not full onboarding */}
          <Route path="/register" element={
            <AuthGuard><FarmerRegistrationFlow /></AuthGuard>
          } />

          {/* Protected App Routes */}
          <Route path="/dashboard" element={
            <AuthGuard><><HomeDashboard /><BottomNavigation /></></AuthGuard>
          } />
          <Route path="/farms" element={
            <AuthGuard><><MyFarmsAndCropsList /><BottomNavigation /></></AuthGuard>
          } />
          <Route path="/add-farm" element={
            <AuthGuard><AddNewFarmScreen /></AuthGuard>
          } />
          <Route path="/assistant" element={
            <AuthGuard><><AIAssistantChatScreen /><BottomNavigation /></></AuthGuard>
          } />
          <Route path="/activity" element={
            <AuthGuard><><FarmActivityLogs /><BottomNavigation /></></AuthGuard>
          } />
          <Route path="/finance" element={
            <AuthGuard><FarmFinanceTracker /></AuthGuard>
          } />
          <Route path="/camera" element={
            <AuthGuard><CropDiseaseDetectionCamera /></AuthGuard>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
};

export default App;
