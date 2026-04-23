"use client";

/**
 * Global token cache that stores the latest Supabase access token.
 * Updated by onAuthStateChange (push-based, never blocks).
 * Read by authFetch and the window.fetch patch to avoid calling
 * getSession() which can deadlock due to Supabase's internal lock.
 */

type TokenListener = (token: string | null) => void;

let _accessToken: string | null = null;
let _listeners: TokenListener[] = [];

export function setAccessToken(token: string | null): void {
  _accessToken = token;
  _listeners.forEach((fn) => fn(token));
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export function onTokenChange(fn: TokenListener): () => void {
  _listeners.push(fn);
  return () => {
    _listeners = _listeners.filter((l) => l !== fn);
  };
}
