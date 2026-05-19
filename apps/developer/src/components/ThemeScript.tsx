/**
 * Inline script that runs before hydration to apply the persisted theme
 * class to <html>, preventing a light/dark flash on first paint. Reads
 * the shared `zervo-theme` key written by ThemeProvider (same key used
 * across admin and finance).
 */
export function ThemeScript() {
  const js = `(function(){try{var t=localStorage.getItem('zervo-theme');if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
