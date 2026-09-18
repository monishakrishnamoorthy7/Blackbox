import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";

import { auth } from "./firebase.js";

export async function signInWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();

    // Always show the Google account chooser
    provider.setCustomParameters({
      prompt: "select_account",
    });

    const result = await signInWithPopup(auth, provider);

    return {
      ok: true,
      user: result.user,
    };
  } catch (error) {
    console.error("Google sign-in error:", error);

    return {
      ok: false,
      message:
        error?.message ||
        "Google sign-in failed. Please try again.",
    };
  }
}

export async function signIn({ email, password }) {
  try {
    const result = await signInWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );

    return {
      ok: true,
      user: result.user,
    };
  } catch (error) {
    console.error("Email sign-in error:", error);

    let message = "Unable to sign in.";

    if (
      error.code === "auth/invalid-credential" ||
      error.code === "auth/wrong-password"
    ) {
      message = "Incorrect email or password.";
    } else if (error.code === "auth/user-not-found") {
      message = "No account found with this email.";
    } else if (error.code === "auth/invalid-email") {
      message = "Enter a valid email address.";
    } else if (error.code === "auth/too-many-requests") {
      message =
        "Too many attempts. Please try again later.";
    } else if (error.code === "auth/operation-not-allowed") {
      message =
        "Email/password sign-in is not enabled in Firebase.";
    }

    return {
      ok: false,
      message,
    };
  }
}

export function subscribeToAuth(callback) {
  return onAuthStateChanged(auth, callback);
}