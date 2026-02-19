/**
 * Mobile Viewport Handler
 * Fixes issues where virtual keyboard covers input or content on mobile devices.
 * Complements <meta name="viewport" content="... interactive-widget=resizes-content">
 */

export function initMobileViewportHandler() {
  if (!window.visualViewport) return;

  const viewport = window.visualViewport;

  const handleResize = () => {
    // Check if we are in chat mode
    const container = document.querySelector(".maia-ai-container.chat-mode");
    if (!container) return; // Only active in chat mode

    const inputWrapper = document.querySelector(".chat-input-wrapper");
    const messages = document.querySelector(".chat-messages");

    // Detect if keyboard is likely open (viewport height significantly smaller than screen height)
    // Note: interactive-widget=resizes-content handles the layout resize,
    // but we might need to force scroll or ensure visibility.
    const isKeyboardOpen = viewport.height < window.screen.height * 0.75;

    if (isKeyboardOpen) {
      // Aggressively force scroll to bottom to ensure visibility
      // We do this over several frames to handle layout transitions/animations
      let attempts = 0;
      const forceScroll = () => {
        if (messages) {
          messages.scrollTop = messages.scrollHeight;
        }

        // Ensure input is visible
        if (
          inputWrapper &&
          document.activeElement?.classList.contains("chat-input-field")
        ) {
          document.activeElement.scrollIntoView({ block: "nearest" });
        }

        attempts++;
        if (attempts < 15) {
          // Force for approx 250ms
          requestAnimationFrame(forceScroll);
        }
      };

      requestAnimationFrame(forceScroll);
    }
  };

  viewport.addEventListener("resize", handleResize);
  viewport.addEventListener("scroll", handleResize);

  console.log("[MobileViewport] Initialized handler");
}

// Auto-initialize if imported as side-effect
if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMobileViewportHandler);
  } else {
    initMobileViewportHandler();
  }
}
