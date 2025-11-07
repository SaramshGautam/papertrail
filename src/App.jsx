import React from "react";
import NavBar from "./components/NavBar/NavBar"; // Adjust path if NavBar is in a subfolder
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import Login from "./components/LoginPage/Login";
import Landing from "./components/LandingPage/Landing";

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <NavBar />
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/landing"
            element={
              <PrivateRoute>
                <Landing />
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
