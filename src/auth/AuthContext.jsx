import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // Firebase auth user
  const [profile, setProfile] = useState(null); // Firestore user profile
  const [loading, setLoading] = useState(true);

  // ✅ SIGN UP
  const signup = async (email, password, name) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    // Optional: store display name in Firebase Auth profile
    if (name) {
      await updateProfile(cred.user, { displayName: name });
    }

    // Create profile doc in Firestore
    await setDoc(doc(db, "users", cred.user.uid), {
      email: cred.user.email,
      name: name || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return cred.user;
  };

  // ✅ LOG IN
  const login = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  };

  // ✅ LOG OUT
  const logout = async () => {
    await signOut(auth);
  };

  // Keep user state in sync
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      if (!u) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        setProfile(snap.exists() ? snap.data() : null);
      } catch (e) {
        console.error("Failed to load profile:", e);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signup, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
