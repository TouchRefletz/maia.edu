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
      // 1. Ensure Messages Scroll to Bottom (so user sees context)
      if (messages) {
        // Only scroll if we were already near bottom or just opened keyboard
        // For now, force it to ensure visibility as requested
        messages.scrollTop = messages.scrollHeight;
      }

      // 2. Ensure Input is Visible
      if (inputWrapper) {
        // With resizes-content, bottom:0 should be fine.
        // We add a small delay to allow layout to settle
        requestAnimationFrame(() => {
          if (document.activeElement?.classList.contains("chat-input-field")) {
            document.activeElement.scrollIntoView({ block: "nearest" });
          }
        });
      }
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
