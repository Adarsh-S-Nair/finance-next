"use client";

import RouteTransition from "../../../components/RouteTransition";
import ResetPasswordForm from "../../../components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <RouteTransition>
      <ResetPasswordForm />
    </RouteTransition>
  );
}
