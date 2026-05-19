/**
 * Inline script that runs before hydration to apply the persisted theme
 * class to <html>, preventing a light/dark flash on first paint. Reads
 * the shared `zervo-theme` key written by ThemeProvider; also falls back
 * to the legacy `zervo-admin-theme` key once for users with the old
 * cache (can be removed after a few weeks).
 */
export function ThemeScript() {
  const js = `(function(){try{var t=localStorage.getItem('zervo-theme')||localStorage.getItem('zervo-admin-theme');if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
