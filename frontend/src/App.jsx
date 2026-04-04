/**
 * App — Root Component & Router
 * ─────────────────────────────
 * MIMIC_DEV: ProtectedLayout wrapper applies consistent pb-20
 * to all BottomNav routes, preventing text overlap.
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
import ProfileScreen from './screens/ProfileScreen';

import BottomNavigation from './components/BottomNavigation';
import AuthGuard from './components/AuthGuard';

/**
 * ProtectedLayout — Single source of truth for BottomNav spacing.
 * All routes with BottomNav go through here so content never hides behind the bar.
 */
const ProtectedLayout = ({ children, noBottomPad }) => (
  <AuthGuard>
    <div className={noBottomPad ? '' : 'pb-20'}>
      {children}
    </div>
    <BottomNavigation />
  </AuthGuard>
);

const App = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-md bg-white min-h-screen shadow-2xl relative overflow-x-hidden">
        <Routes>
          {/* Public */}
          <Route path="/" element={<WelcomeScreen />} />
          <Route path="/login" element={<PhoneNumberLogin />} />

          {/* Registration */}
          <Route path="/register" element={
            <AuthGuard><FarmerRegistrationFlow /></AuthGuard>
          } />

          {/* Protected + BottomNav */}
          <Route path="/dashboard" element={
            <ProtectedLayout><HomeDashboard /></ProtectedLayout>
          } />
          <Route path="/farms" element={
            <ProtectedLayout><MyFarmsAndCropsList /></ProtectedLayout>
          } />
          <Route path="/add-farm" element={
            <AuthGuard><AddNewFarmScreen /></AuthGuard>
          } />
          <Route path="/assistant" element={
            <ProtectedLayout noBottomPad><AIAssistantChatScreen /></ProtectedLayout>
          } />
          <Route path="/activity" element={
            <ProtectedLayout><FarmActivityLogs /></ProtectedLayout>
          } />
          <Route path="/profile" element={
            <ProtectedLayout><ProfileScreen /></ProtectedLayout>
          } />
          <Route path="/finance" element={
            <AuthGuard><FarmFinanceTracker /></AuthGuard>
          } />
          <Route path="/camera" element={
            <AuthGuard><CropDiseaseDetectionCamera /></AuthGuard>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
};

export default App;
