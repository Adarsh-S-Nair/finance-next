"use client";

/**
 * PlaidOAuthHandler
 *
 * Detects when the user returns from an OAuth bank redirect (e.g. Chase) by
 * checking for `?oauth_state_id=` in the URL on mount. When present it:
 *  1. Shows a full-screen loading overlay.
 *  2. Fetches a fresh link token from /api/plaid/link-token.
 *  3. Opens Plaid Link with `receivedRedirectUri` so it can complete the
 *     OAuth handshake automatically.
 *  4. On success, exchanges the public token as normal.
 *  5. Cleans up the URL param so a refresh doesn't re-trigger.
 *
 * Mount this once inside AppShell so it covers every page.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { usePlaidLink, PlaidLinkError, PlaidLinkOnExitMetadata } from "react-plaid-link";
import { FiCheckCircle, FiLoader, FiXCircle } from "react-icons/fi";
import { authFetch } from "../lib/api/fetch";
import { useAccounts } from "./providers/AccountsProvider";

type Status = "idle" | "loading" | "ready" | "success" | "error";

function OAuthOverlay({ status, errorMsg }: { status: Status; errorMsg: string | null }) {
  if (status === "idle") return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-950/70 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl text-center">
        {(status === "loading" || status === "ready") && (
          <>
            <FiLoader className="mx-auto mb-4 h-10 w-10 animate-spin text-zinc-900" />
            <p className="text-base font-medium text-zinc-900">Completing bank connection…</p>
            <p className="mt-1 text-sm text-zinc-500">Please wait while we finalize your account link.</p>
          </>
        )}
        {status === "success" && (
          <>
            <FiCheckCircle className="mx-auto mb-4 h-10 w-10 text-emerald-500" />
            <p className="text-base font-medium text-zinc-900">Account connected!</p>
            <p className="mt-1 text-sm text-zinc-500">Your data is syncing now.</p>
          </>
        )}
        {status === "error" && (
          <>
            <FiXCircle className="mx-auto mb-4 h-10 w-10 text-red-500" />
            <p className="text-base font-medium text-zinc-900">Connection failed</p>
            <p className="mt-1 text-sm text-zinc-500">{errorMsg || "Something went wrong. Please try again."}</p>
            <button
              onClick={() => window.location.replace(window.location.pathname)}
              className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
            >
              Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Inner component that can call usePlaidLink once we have a token. */
function PlaidOAuthLinker({
  linkToken,
  receivedRedirectUri,
  onSuccess,
  onExit,
}: {
  linkToken: string;
  receivedRedirectUri: string;
  onSuccess: (publicToken: string) => void;
  onExit: (err: PlaidLinkError | null) => void;
}) {
  const openCalledRef = useRef(false);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    receivedRedirectUri,
    onSuccess: (publicToken) => onSuccess(publicToken),
    onExit: (err: PlaidLinkError | null, _metadata: PlaidLinkOnExitMetadata) => onExit(err),
  });

  useEffect(() => {
    if (ready && !openCalledRef.current) {
      openCalledRef.current = true;
      open();
    }
  }, [ready, open]);

  return null;
}

export default function PlaidOAuthHandler() {
  const { addAccount, refreshAccounts } = useAccounts();
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [receivedRedirectUri, setReceivedRedirectUri] = useState<string | null>(null);

  // Strip oauth_state_id from the URL without a navigation
  const cleanUrl = useCallback(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has("oauth_state_id")) {
        url.searchParams.delete("oauth_state_id");
        window.history.replaceState({}, "", url.toString());
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSuccess = useCallback(
    async (publicToken: string) => {
      cleanUrl();
      try {
        const response = await authFetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicToken }),
        });

        if (!response.ok) {
          throw new Error("Failed to exchange token");
        }

        const data = await response.json();
        if (data.accounts) {
          data.accounts.forEach((account: object) => addAccount(account));
        }
        await refreshAccounts();
        setStatus("success");

        // Auto-dismiss overlay after 2 s
        setTimeout(() => setStatus("idle"), 2000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to complete connection";
        setErrorMsg(msg);
        setStatus("error");
      }
    },
    [addAccount, refreshAccounts, cleanUrl]
  );

  const handleExit = useCallback(
    (err: PlaidLinkError | null) => {
      cleanUrl();
      if (err) {
        const msg =
          (err as PlaidLinkError & { display_message?: string; error_message?: string }).display_message ||
          (err as PlaidLinkError & { error_message?: string }).error_message ||
          "Bank connection was cancelled or failed.";
        setErrorMsg(msg);
        setStatus("error");
      } else {
        // User closed without error — just dismiss quietly
        setStatus("idle");
      }
    },
    [cleanUrl]
  );

  // Detect oauth_state_id on mount (client-side only)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("oauth_state_id")) return;

    // We have an OAuth return — capture the full redirect URI before we change anything
    const redirectUri = window.location.href;
    setReceivedRedirectUri(redirectUri);
    setStatus("loading");

    (async () => {
      try {
        const response = await authFetch("/api/plaid/link-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || "Failed to create link token");
        }

        const data = await response.json();
        setLinkToken(data.link_token);
        setStatus("ready");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to prepare connection";
        setErrorMsg(msg);
        setStatus("error");
        cleanUrl();
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <OAuthOverlay status={status} errorMsg={errorMsg} />
      {status === "ready" && linkToken && receivedRedirectUri && (
        <PlaidOAuthLinker
          linkToken={linkToken}
          receivedRedirectUri={receivedRedirectUri}
          onSuccess={handleSuccess}
          onExit={handleExit}
        />
      )}
    </>
  );
}
