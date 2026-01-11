import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Provider } from "react-redux";
import store from "./redux/store";

import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";

import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import NotFound from "./pages/OtherPage/NotFound";
import UserProfiles from "./pages/UserProfiles";
import Users from "./pages/Users";
import Drivers from "./pages/Drivers";
import Operators from "./pages/Operators";
import Bookings from "./pages/Bookings";
import Notifications from "./pages/Notifications";
import AdminLogs from "./pages/AdminLogs";
import LostFound from "./pages/LostFound";
import Leaderboard from "./pages/Leaderboard";
import RulesRegulations from "./pages/RulesRegulations";
import Complaints from "./pages/Complaints";
import Videos from "./pages/UiElements/Videos";
import Images from "./pages/UiElements/Images";
import Alerts from "./pages/UiElements/Alerts";
import Badges from "./pages/UiElements/Badges";
import Avatars from "./pages/UiElements/Avatars";
import Buttons from "./pages/UiElements/Buttons";
import LineChart from "./pages/Charts/LineChart";
import BarChart from "./pages/Charts/BarChart";
import Calendar from "./pages/Calendar";
import Announcements from "./pages/Announcements";
import BasicTables from "./pages/Tables/BasicTables";
import FormElements from "./pages/Forms/FormElements";
import Blank from "./pages/Blank";
import About from "./pages/About";
import LiveDriversMap from "./pages/LiveDriversMap";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Home from "./pages/Dashboard/Home";

export default function App() {
  return (
    <Provider store={store}>
      <AuthProvider>
        <Router>
          <ScrollToTop />

          <Routes>
            {/* Dashboard Layout - Protected Routes (Admin Only) */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Home />} />

              {/* Other Pages */}
              <Route path="/profile" element={<UserProfiles />} />
              <Route path="/users" element={<Users />} />
              <Route path="/drivers" element={<Drivers />} />
              <Route path="/operators" element={<Operators />} />
              <Route path="/bookings" element={<Bookings />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/admin-logs" element={<AdminLogs />} />
              <Route path="/lost-found" element={<LostFound />} />
              <Route path="/complaints" element={<Complaints />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/rules-regulations" element={<RulesRegulations />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/announcements" element={<Announcements />} />
              <Route path="/live-tracking" element={<LiveDriversMap />} />
              <Route path="/blank" element={<Blank />} />
              <Route path="/about" element={<About />} />

              {/* Forms */}
              <Route path="/form-elements" element={<FormElements />} />

              {/* Tables */}
              <Route path="/basic-tables" element={<BasicTables />} />

              {/* UI Elements */}
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/avatars" element={<Avatars />} />
              <Route path="/badge" element={<Badges />} />
              <Route path="/buttons" element={<Buttons />} />
              <Route path="/images" element={<Images />} />
              <Route path="/videos" element={<Videos />} />

              {/* Charts */}
              <Route path="/line-chart" element={<LineChart />} />
              <Route path="/bar-chart" element={<BarChart />} />
            </Route>

            {/* Auth Pages - Public */}
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />

            {/* Fallback */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </AuthProvider>
    </Provider>
  );
}
