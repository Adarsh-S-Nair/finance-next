"use client";

import { motion } from "framer-motion";

const LOGO_MASK_STYLE = {
  WebkitMaskImage: "url(/logo.svg)",
  maskImage: "url(/logo.svg)",
  WebkitMaskSize: "contain",
  maskSize: "contain",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "center",
  maskPosition: "center",
};

export default function AuthLoadingScreen() {
  return (
    <>
      {/* Force the light background onto html/body so the user doesn't
          catch a flash of the previous page's theme before hydration. */}
      <style>{`html, body { background: #ffffff !important; }`}</style>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white">
        <motion.span
          aria-hidden
          className="block h-20 w-20 bg-zinc-900"
          style={LOGO_MASK_STYLE}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{
            scale: [0.7, 1, 1, 0.7],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 2.4,
            times: [0, 0.35, 0.65, 1],
            ease: [0.22, 1, 0.36, 1],
            repeat: Infinity,
            repeatDelay: 0.1,
          }}
        />
      </div>
    </>
  );
}
