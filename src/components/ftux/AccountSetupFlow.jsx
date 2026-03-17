"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FiArrowRight } from "react-icons/fi";
import Button from "../ui/Button";
import PlaidLinkModal from "../PlaidLinkModal";

function Step({ number, title, description }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid gap-3 sm:grid-cols-[32px_minmax(0,1fr)] sm:items-start"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-700">
        {number}
      </div>
      <div>
        <div className="text-sm font-semibold text-zinc-900">{title}</div>
        <div className="mt-1 text-sm leading-6 text-zinc-600">{description}</div>
      </div>
    </motion.div>
  );
}

export default function AccountSetupFlow({ userName, onComplete = null }) {
  const [showLinkModal, setShowLinkModal] = useState(false);

  const firstName = useMemo(() => {
    if (!userName) return "there";
    return String(userName).split(" ")[0];
  }, [userName]);

  return (
    <>
      <div className="mx-auto flex min-h-[calc(100vh-160px)] w-full max-w-3xl items-center px-5 py-16 sm:px-6 lg:px-8">
        <div className="w-full">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl"
          >
            Hey {firstName} — let&apos;s connect your first account.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            className="mt-5 max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg"
          >
            Start with one bank, credit card, or investment account. Once it&apos;s connected, your dashboard will populate automatically.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Button onClick={() => setShowLinkModal(true)} className="h-11 px-5">
              Connect an account
              <FiArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <div className="text-sm text-zinc-500">Usually takes under a minute.</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="mt-12 max-w-2xl space-y-6 border-t border-zinc-200 pt-8"
          >
            <Step number="1" title="Choose an account type" description="Pick whatever you want to start with — checking, credit card, or investments." />
            <Step number="2" title="Connect securely with Plaid" description="Use your institution’s normal sign-in flow. Credentials never pass through the app directly." />
            <Step number="3" title="Come back to a populated dashboard" description="Once the first institution is linked, balances and transactions should start showing up automatically." />
          </motion.div>
        </div>
      </div>

      <PlaidLinkModal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onSuccess={(data) => {
          setShowLinkModal(false);
          onComplete?.(data);
        }}
      />
    </>
  );
}
