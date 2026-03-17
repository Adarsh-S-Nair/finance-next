"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FiArrowRight, FiCheck, FiLock, FiShield, FiStar } from "react-icons/fi";
import Button from "../ui/Button";
import PlaidLinkModal from "../PlaidLinkModal";

function Step({ number, title, description, active }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid gap-3 sm:grid-cols-[36px_minmax(0,1fr)] sm:items-start"
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${active ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"}`}>
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
  const [isConnected, setIsConnected] = useState(false);

  const firstName = useMemo(() => {
    if (!userName) return "there";
    return String(userName).split(" ")[0];
  }, [userName]);

  return (
    <>
      <div className="mx-auto max-w-5xl">
        <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 lg:p-10">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-start">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600"
              >
                <FiStar className="h-3.5 w-3.5" />
                First-time setup
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 }}
                className="mt-5 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl"
              >
                Hey {firstName} — let&apos;s connect your accounts.
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="mt-4 max-w-2xl text-base leading-7 text-zinc-600"
              >
                Keep this short and easy: connect your bank, credit card, or investment account and Zentari will take care of the rest.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                className="mt-8 flex flex-col gap-3 sm:flex-row"
              >
                <Button onClick={() => setShowLinkModal(true)} className="h-11 px-5">
                  Connect an account
                  <FiArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <div className="inline-flex h-11 items-center rounded-md border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-600">
                  Usually takes under a minute
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16 }}
                className="mt-10 space-y-6"
              >
                <Step number="1" title="Choose an account type" description="Pick checking, credit card, or investment accounts — whatever you want to start with." active />
                <Step number="2" title="Connect securely with Plaid" description="Sign in through your institution’s normal flow. Credentials never pass through the app directly." active />
                <Step number="3" title="Review your dashboard" description="Once your first institution is linked, your balances and transactions will start showing up automatically." active />
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6"
            >
              <div className="text-sm font-semibold text-zinc-900">What to expect</div>
              <div className="mt-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-white text-zinc-700 ring-1 ring-zinc-200">
                    <FiLock className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-900">Secure connection</div>
                    <div className="mt-1 text-sm leading-6 text-zinc-600">Bank linking happens through Plaid’s hosted flow.</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-white text-zinc-700 ring-1 ring-zinc-200">
                    <FiShield className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-900">Minimal setup</div>
                    <div className="mt-1 text-sm leading-6 text-zinc-600">You only need one institution to get started. Add the rest later.</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-white text-emerald-600 ring-1 ring-zinc-200">
                    <FiCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-900">Automatic sync</div>
                    <div className="mt-1 text-sm leading-6 text-zinc-600">Balances and transactions should populate right after your first connection.</div>
                  </div>
                </div>
              </div>

              {isConnected && (
                <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Nice — your first account is connected.
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      <PlaidLinkModal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onSuccess={(data) => {
          setIsConnected(true);
          setShowLinkModal(false);
          onComplete?.(data);
        }}
      />
    </>
  );
}
