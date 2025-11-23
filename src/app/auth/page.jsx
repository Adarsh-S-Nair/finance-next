"use client";
import Tabs from "../../components/ui/Tabs";
import LoginForm from "../../components/auth/LoginForm";
import SignupForm from "../../components/auth/SignupForm";
import RouteTransition from "../../components/RouteTransition"; // Assuming RouteTransition is in components/RouteTransition

export default function AuthPage() {
  return (
    <RouteTransition>
      <main className="relative min-h-[calc(100vh-5rem)] flex items-center justify-center px-6 py-16 bg-grid">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Sign in or create an account</h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">Modern finance for teams and individuals</p>
          </div>
          <Tabs
            tabs={[
              { key: "login", label: "Sign in", content: <LoginForm /> },
              { key: "signup", label: "Create account", content: <SignupForm /> },
            ]}
            initialKey="login"
          />
          <p className="mt-6 text-center text-xs text-[var(--color-muted)]">
            By continuing you agree to our Terms and Privacy Policy.
          </p>
        </div>
      </main>
    </RouteTransition>
  );
}


