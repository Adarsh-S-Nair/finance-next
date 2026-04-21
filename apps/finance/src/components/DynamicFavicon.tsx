"use client";

import { useEffect } from "react";

export default function DynamicFavicon() {
  useEffect(() => {
    const updateFavicon = async () => {
      try {
        // Fetch the logo SVG
        const response = await fetch('/logo.svg');
        const svgText = await response.text();

        // Get the current accent color from CSS variable
        let accentColor = getComputedStyle(document.documentElement)
          .getPropertyValue('--color-accent')
          .trim();

        if (!accentColor) return;

        // Check if accent color is the default light color in dark mode (#fafafa / rgb(250, 250, 250))
        // If so, we force the background to be dark (#18181b) to maintain visibility and the "dark" look
        const isDefaultLight = accentColor.toLowerCase() === '#fafafa' ||
          accentColor === 'rgb(250, 250, 250)';

        if (isDefaultLight) {
          accentColor = '#18181b';
        }

        // Create a parser to manipulate the SVG
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, "image/svg+xml");
        const originalSvg = doc.querySelector("svg");

        if (originalSvg) {
          // 1. Clean up original logo: remove fills so we can control it
          const elementsWithFill = doc.querySelectorAll('[fill]');
          elementsWithFill.forEach(el => el.removeAttribute('fill'));

          // Also remove style attributes that might contain fill
          const elementsWithStyle = doc.querySelectorAll('[style]');
          elementsWithStyle.forEach(el => el.removeAttribute('style'));

          // Get the inner content of the logo
          const logoContent = originalSvg.innerHTML;

          // 2. Construct new SVG with circle background
          // We assume standard 1024x1024 based on the file check
          const newSvgString = `
            <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
              <circle cx="512" cy="512" r="512" fill="${accentColor}" />
              <g transform="translate(102, 102) scale(0.8)" fill="#ffffff">
                ${logoContent}
              </g>
            </svg>
          `;

          // 3. Create data URI
          const dataUri = `data:image/svg+xml;base64,${btoa(newSvgString)}`;

          // 4. Update favicon link
          let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
          }
          link.href = dataUri;
        }
      } catch (error) {
        console.error("Failed to update dynamic favicon:", error);
      }
    };

    // Initial update
    updateFavicon();

    const observer = new MutationObserver(() => {
      updateFavicon();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
