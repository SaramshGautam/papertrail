import React from "react";
import NavBar from "./components/NavBar/NavBar"; // Adjust path if NavBar is in a subfolder
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import Login from "./components/LoginPage/Login";
import Landing from "./components/LandingPage/Landing";
import HomePage from "./components/HomePage/HomePage";
import PaperPage from "./components/PaperPage/PaperPage";
import WritingPage from "./components/WritingPage/WritingPage";
import About from "./components/About/About";

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/papertrail/login" replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/papertrail">
        <NavBar />
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/landing"
            element={
              <PrivateRoute>
                <Landing />
              </PrivateRoute>
            }
          />
          <Route
            path="/home/:projectId"
            element={
              <PrivateRoute>
                <HomePage />
              </PrivateRoute>
            }
          />
          <Route
            path="/paper/:projectId"
            element={
              <PrivateRoute>
                <PaperPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/writing/:projectId"
            element={
              <PrivateRoute>
                <WritingPage />
              </PrivateRoute>
            }
          />
          {/* Add more protected routes here */}
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
