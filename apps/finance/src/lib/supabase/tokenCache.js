"use client";

/**
 * Global token cache that stores the latest Supabase access token.
 * Updated by onAuthStateChange (push-based, never blocks).
 * Read by authFetch and the window.fetch patch to avoid calling
 * getSession() which can deadlock due to Supabase's internal lock.
 */

let _accessToken = null;
let _listeners = [];

export function setAccessToken(token) {
  _accessToken = token;
  _listeners.forEach(fn => fn(token));
}

export function getAccessToken() {
  return _accessToken;
}

export function onTokenChange(fn) {
  _listeners.push(fn);
  return () => {
    _listeners = _listeners.filter(l => l !== fn);
  };
}
