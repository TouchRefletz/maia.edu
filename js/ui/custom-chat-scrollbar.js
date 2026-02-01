/**
 * Custom Chat Scrollbar - Mobile Only
 * Creates a visible scroll track on the right side of the chat
 * that stays above the fixed input bar.
 */

let scrollbarInitialized = false;
let messagesObserver = null;
let currentContainer = null;

/**
 * Get the scrollable container (chatMessages or similar)
 */
function getScrollableContainer() {
  // Try finding the chat messages container
  let container = document.getElementById("chatMessages");

  // If not found, try finding any scrollable container in chat mode
  if (!container) {
    const chatContainer = document.querySelector(
      ".maia-ai-container.chat-mode",
    );
    if (chatContainer) {
      container = chatContainer.querySelector(".chat-messages");
    }
  }

  return container;
}

/**
 * Initialize the custom scrollbar for mobile chat.
 * Should be called when entering chat mode.
 */
export function initCustomChatScrollbar() {
  // Only run on mobile (matching CSS media query)
  if (window.innerWidth > 900) return;

  const messagesContainer = getScrollableContainer();
  if (!messagesContainer) return;

  // If already initialized with same container, just update
  if (scrollbarInitialized && currentContainer === messagesContainer) {
    updateThumbPosition();
    return;
  }

  // Store reference
  currentContainer = messagesContainer;

  // Create scroll track element
  let scrollTrack = document.querySelector(".chat-scroll-track");
  if (!scrollTrack) {
    scrollTrack = document.createElement("div");
    scrollTrack.className = "chat-scroll-track";

    const scrollThumb = document.createElement("div");
    scrollThumb.className = "chat-scroll-thumb";
    scrollTrack.appendChild(scrollThumb);

    document.body.appendChild(scrollTrack);
  }

  const scrollThumb = scrollTrack.querySelector(".chat-scroll-thumb");

  // === Sync thumb with scroll position ===
  function updateThumbPosition() {
    const container = currentContainer || getScrollableContainer();
    if (!container) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = container;
    const trackHeight = scrollTrack.clientHeight;

    // Calculate visible ratio and thumb size
    const visibleRatio = clientHeight / scrollHeight;
    const thumbHeight = Math.max(40, trackHeight * visibleRatio); // Min 40px

    // Calculate thumb position
    const maxScroll = scrollHeight - clientHeight;
    const scrollRatio = maxScroll > 0 ? scrollTop / maxScroll : 0;
    const thumbTop = scrollRatio * (trackHeight - thumbHeight);

    scrollThumb.style.height = `${thumbHeight}px`;
    scrollThumb.style.top = `${thumbTop}px`;

    // Only hide thumb (not track) if no scroll needed
    if (scrollHeight <= clientHeight) {
      scrollThumb.style.opacity = "0.3";
      scrollTrack.style.pointerEvents = "none";
    } else {
      scrollThumb.style.opacity = "1";
      scrollTrack.style.pointerEvents = "auto";
    }
  }

  // Listen to scroll events
  messagesContainer.addEventListener("scroll", updateThumbPosition, {
    passive: true,
  });

  // === Drag functionality ===
  let isDragging = false;
  let startY = 0;
  let startScrollTop = 0;

  function handleDragStart(e) {
    e.preventDefault();
    isDragging = true;
    scrollThumb.classList.add("dragging");

    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    startY = clientY;
    startScrollTop = messagesContainer.scrollTop;

    document.addEventListener("mousemove", handleDragMove);
    document.addEventListener("mouseup", handleDragEnd);
    document.addEventListener("touchmove", handleDragMove, { passive: false });
    document.addEventListener("touchend", handleDragEnd);
  }

  function handleDragMove(e) {
    if (!isDragging) return;
    e.preventDefault();

    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const deltaY = clientY - startY;

    // Convert pixel delta to scroll delta
    const trackHeight = scrollTrack.clientHeight;
    const { scrollHeight, clientHeight } = messagesContainer;
    const thumbHeight = parseFloat(scrollThumb.style.height) || 40;

    const scrollableHeight = scrollHeight - clientHeight;
    const trackScrollableHeight = trackHeight - thumbHeight;

    if (trackScrollableHeight <= 0) return;

    const scrollDelta = (deltaY / trackScrollableHeight) * scrollableHeight;
    messagesContainer.scrollTop = startScrollTop + scrollDelta;
  }

  function handleDragEnd() {
    isDragging = false;
    scrollThumb.classList.remove("dragging");

    document.removeEventListener("mousemove", handleDragMove);
    document.removeEventListener("mouseup", handleDragEnd);
    document.removeEventListener("touchmove", handleDragMove);
    document.removeEventListener("touchend", handleDragEnd);
  }

  // Attach drag listeners
  scrollThumb.addEventListener("mousedown", handleDragStart);
  scrollThumb.addEventListener("touchstart", handleDragStart, {
    passive: false,
  });

  // === Track click to jump ===
  scrollTrack.addEventListener("click", (e) => {
    if (e.target === scrollThumb) return;

    const trackRect = scrollTrack.getBoundingClientRect();
    const clickY = e.clientY - trackRect.top;
    const trackHeight = scrollTrack.clientHeight;

    const { scrollHeight, clientHeight } = messagesContainer;
    const maxScroll = scrollHeight - clientHeight;

    const clickRatio = clickY / trackHeight;
    messagesContainer.scrollTo({
      top: clickRatio * maxScroll,
      behavior: "smooth",
    });
  });

  // === Resize observer for thumb updates ===
  if (typeof ResizeObserver !== "undefined") {
    const resizeObserver = new ResizeObserver(() => {
      updateThumbPosition();
    });
    resizeObserver.observe(messagesContainer);
  }

  // === Mutation observer for content changes ===
  if (typeof MutationObserver !== "undefined") {
    messagesObserver = new MutationObserver(() => {
      requestAnimationFrame(updateThumbPosition);
    });
    messagesObserver.observe(messagesContainer, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  // Initial update
  updateThumbPosition();
  scrollbarInitialized = true;

  // Make update function available globally for external calls
  window._updateChatScrollbar = updateThumbPosition;
}

/**
 * Destroy the custom scrollbar (when exiting chat mode)
 */
export function destroyCustomChatScrollbar() {
  const scrollTrack = document.querySelector(".chat-scroll-track");
  if (scrollTrack) {
    scrollTrack.remove();
  }

  if (messagesObserver) {
    messagesObserver.disconnect();
    messagesObserver = null;
  }

  currentContainer = null;
  scrollbarInitialized = false;
  delete window._updateChatScrollbar;
}

/**
 * Force update the scrollbar position (call after adding messages)
 */
export function updateChatScrollbar() {
  if (window._updateChatScrollbar) {
    requestAnimationFrame(window._updateChatScrollbar);
  }
}

// Auto-cleanup on resize (desktop mode)
window.addEventListener("resize", () => {
  if (window.innerWidth > 900) {
    destroyCustomChatScrollbar();
  }
});
