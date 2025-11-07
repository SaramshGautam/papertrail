import React from "react";
import { useAuth } from "../../auth/AuthContext";

export default function Landing() {
  const { user } = useAuth();

  return (
    <div style={{ padding: "40px" }}>
      <h2>Welcome to PaperTrail{user ? `, ${user.name}` : ""}!</h2>
      <p>Navigate to Features, Prototype, or start capturing insights.</p>
    </div>
  );
}
