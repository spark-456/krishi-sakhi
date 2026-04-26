/**
 * App — Root Component & Router
 * ─────────────────────────────
 * ProtectedLayout wrapper applies consistent pb-20
 * to all BottomNav routes, preventing text overlap.
 */
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Public & Auth
import WelcomeScreen from './screens/WelcomeScreen';
import PhoneNumberLogin from './screens/PhoneNumberLogin';
import FarmerRegistrationFlow from './screens/FarmerRegistrationFlow';

// Farmer screens
import HomeDashboard from './screens/HomeDashboard';
import MyFarmsAndCropsList from './screens/MyFarmsAndCropsList';
import AddNewFarmScreen from './screens/AddNewFarmScreen';
import AIAssistantChatScreen from './screens/AIAssistantChatScreen';
import FarmActivityLogs from './screens/FarmActivityLogs';
import FarmFinanceTracker from './screens/FarmFinanceTracker';
import CropDiseaseDetectionCamera from './screens/CropDiseaseDetectionCamera';
import ProfileScreen from './screens/ProfileScreen';
import MoreMenu from './screens/MoreMenu';

// Community (SakhiNet)
import CommunityHub from './screens/CommunityHub';
import CoopGroupDetail from './screens/CoopGroupDetail';
import CreateCoopGroup from './screens/CreateCoopGroup';
import CreateHelpRequest from './screens/CreateHelpRequest';
import AddSharedResource from './screens/AddSharedResource';

// Blog
import BlogFeed from './screens/BlogFeed';
import BlogPostView from './screens/BlogPostView';

// Tickets
import MyTickets from './screens/MyTickets';
import CreateTicket from './screens/CreateTicket';

// Admin screens
import AdminDashboard from './screens/admin/AdminDashboard';
import AdminTicketQueue from './screens/admin/AdminTicketQueue';
import AdminNetworkGraph from './screens/admin/AdminNetworkGraph';
import AdminBlogList from './screens/admin/AdminBlogList';
import AdminBlogEditor from './screens/admin/AdminBlogEditor';
import AdminTicketDetail from './screens/admin/AdminTicketDetail';
import AdminFarmerDirectory from './screens/admin/AdminFarmerDirectory';
import AdminFarmerDetail from './screens/admin/AdminFarmerDetail';

// Guards & Layout
import BottomNavigation from './components/BottomNavigation';
import AuthGuard from './components/AuthGuard';
import AdminGuard from './components/AdminGuard';
import { ChatProvider } from './contexts/ChatContext';

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

const AdminLayout = ({ children }) => (
  <AuthGuard>
    <AdminGuard>
      {children}
    </AdminGuard>
  </AuthGuard>
);

const App = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-md bg-white min-h-screen shadow-2xl relative overflow-x-hidden">
        <ChatProvider>
          <Routes>
            {/* ── Public ── */}
            <Route path="/" element={<WelcomeScreen />} />
            <Route path="/login" element={<PhoneNumberLogin />} />

            {/* ── Registration ── */}
            <Route path="/register" element={<FarmerRegistrationFlow />} />

            {/* ── Core (BottomNav) ── */}
            <Route path="/dashboard" element={<ProtectedLayout><HomeDashboard /></ProtectedLayout>} />
            <Route path="/farms"     element={<ProtectedLayout><MyFarmsAndCropsList /></ProtectedLayout>} />
            <Route path="/assistant" element={<ProtectedLayout noBottomPad><AIAssistantChatScreen /></ProtectedLayout>} />
            <Route path="/community" element={<ProtectedLayout><CommunityHub /></ProtectedLayout>} />
            <Route path="/more"      element={<ProtectedLayout><MoreMenu /></ProtectedLayout>} />

            {/* ── Community sub-pages ── */}
            <Route path="/community/groups/:groupId"      element={<AuthGuard><CoopGroupDetail /></AuthGuard>} />
            <Route path="/community/create-group"         element={<AuthGuard><CreateCoopGroup /></AuthGuard>} />
            <Route path="/community/create-help"          element={<AuthGuard><CreateHelpRequest /></AuthGuard>} />
            <Route path="/community/add-resource"         element={<AuthGuard><AddSharedResource /></AuthGuard>} />

            {/* ── Blog ── */}
            <Route path="/blog"         element={<ProtectedLayout><BlogFeed /></ProtectedLayout>} />
            <Route path="/blog/:postId" element={<AuthGuard><BlogPostView /></AuthGuard>} />

            {/* ── Tickets ── */}
            <Route path="/tickets"     element={<ProtectedLayout><MyTickets /></ProtectedLayout>} />
            <Route path="/tickets/new" element={<AuthGuard><CreateTicket /></AuthGuard>} />

            {/* ── Other protected ── */}
            <Route path="/add-farm" element={<AuthGuard><AddNewFarmScreen /></AuthGuard>} />
            <Route path="/activity" element={<ProtectedLayout><FarmActivityLogs /></ProtectedLayout>} />
            <Route path="/profile"  element={<ProtectedLayout><ProfileScreen /></ProtectedLayout>} />
            <Route path="/finance"  element={<AuthGuard><FarmFinanceTracker /></AuthGuard>} />
            <Route path="/camera"   element={<AuthGuard><CropDiseaseDetectionCamera /></AuthGuard>} />

            {/* ── Admin Portal (admin role required) ── */}
            <Route path="/admin"                  element={<AdminLayout><AdminDashboard /></AdminLayout>} />
            <Route path="/admin/tickets"          element={<AdminLayout><AdminTicketQueue /></AdminLayout>} />
            <Route path="/admin/tickets/:ticketId" element={<AdminLayout><AdminTicketDetail /></AdminLayout>} />
            <Route path="/admin/farmers"          element={<AdminLayout><AdminFarmerDirectory /></AdminLayout>} />
            <Route path="/admin/farmers/:farmerId" element={<AdminLayout><AdminFarmerDetail /></AdminLayout>} />
            <Route path="/admin/network"          element={<AdminLayout><AdminNetworkGraph /></AdminLayout>} />
            <Route path="/admin/blog"             element={<AdminLayout><AdminBlogList /></AdminLayout>} />
            <Route path="/admin/blog/new"         element={<AdminLayout><AdminBlogEditor /></AdminLayout>} />
            <Route path="/admin/blog/:postId/edit" element={<AdminLayout><AdminBlogEditor /></AdminLayout>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ChatProvider>
      </div>
    </div>
  );
};

export default App;
