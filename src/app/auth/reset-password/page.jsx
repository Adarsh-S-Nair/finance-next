"use client";

import { useState } from "react";
import RouteTransition from "../../../components/RouteTransition";
import ResetPasswordForm from "../../../components/auth/ResetPasswordForm";
import { LandingNav } from "../../page";

export default function ResetPasswordPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <RouteTransition>
      <LandingNav menuOpen={menuOpen} setMenuOpen={setMenuOpen} showLinks={false} bgClass="bg-white" />
      <ResetPasswordForm />
    </RouteTransition>
  );
}
