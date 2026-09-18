const DEMO_CREDENTIALS = {
  "admin@blackbox.com": "admin123",
  "ops@blackbox.com": "blackbox123",
  "support@gmail.com": "google123",
};

export function signIn({ email, password, provider = "email" }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedPassword = String(password || "").trim();

  if (!normalizedEmail || !normalizedPassword) {
    return {
      ok: false,
      message: "Enter both your email and password to continue.",
    };
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(normalizedEmail)) {
    return {
      ok: false,
      message: "Enter a valid email address.",
    };
  }

  if (provider === "google" && !normalizedEmail.endsWith("@gmail.com")) {
    return {
      ok: false,
      message: "Google sign-in requires a valid Gmail address.",
    };
  }

  if (normalizedPassword.length < 6) {
    return {
      ok: false,
      message: "Password must be at least 6 characters long.",
    };
  }

  const expectedPassword = DEMO_CREDENTIALS[normalizedEmail];
  if (expectedPassword && expectedPassword !== normalizedPassword) {
    return {
      ok: false,
      message: "Incorrect password for this account.",
    };
  }

  return {
    ok: true,
    user: {
      email: normalizedEmail,
      provider,
    },
  };
}
