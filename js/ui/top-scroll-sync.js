/**
 * Top Mirror Scrollbar Synchronization
 * ───────────────────────────────────────────
 * Creates a premium horizontal scroll indicator at the top of #chatMessages.
 * Works on ANY viewport where horizontal overflow exists.
 */

let topScrollbarInitialized = false;
let syncMutationObserver = null;
let currentSyncedContainer = null;

function getScrollContainer() {
    return document.getElementById("chatMessages");
}

function ensureTopTrack() {
    let track = document.querySelector(".chat-top-scroll-track");
    if (!track) {
        track = document.createElement("div");
        track.className = "chat-top-scroll-track";

        const thumb = document.createElement("div");
        thumb.className = "chat-top-scroll-thumb";
        track.appendChild(thumb);

        // Append to .maia-ai-container for fixed position relative to page
        const container = document.querySelector(".maia-ai-container");
        if (container) {
            container.appendChild(track);
        }
    }
    return track;
}

export function initTopScrollSync() {
    const container = getScrollContainer();
    if (!container) return;

    const track = ensureTopTrack();
    const thumb = track.querySelector(".chat-top-scroll-thumb");

    function updateTopThumb() {
        const { scrollLeft, scrollWidth, clientWidth } = container;
        const trackWidth = track.clientWidth;

        // If no horizontal overflow, hide
        if (scrollWidth <= clientWidth + 4) {
            track.classList.remove("active");
            return;
        }

        track.classList.add("active");

        // Use clientWidth/scrollWidth ratio as on custom-chat-scrollbar.js
        const visibleRatio = clientWidth / scrollWidth;
        const thumbWidth = Math.max(60, trackWidth * visibleRatio); // Min length 60px

        const maxScroll = scrollWidth - clientWidth;
        const scrollRatio = maxScroll > 0 ? scrollLeft / maxScroll : 0;
        const thumbLeft = scrollRatio * (trackWidth - thumbWidth);

        thumb.style.width = `${thumbWidth}px`;
        thumb.style.left = `${thumbLeft}px`;
    }

    if (topScrollbarInitialized && currentSyncedContainer === container) {
        updateTopThumb();
        return;
    }

    currentSyncedContainer = container;
    
    // --- Events ---
    container.addEventListener("scroll", updateTopThumb, { passive: true });

    // --- Dragging (Mirroring the logic of custom-chat-scrollbar.js) ---
    let isDragging = false;
    let startX = 0;
    let startScrollLeft = 0;

    function handleStart(e) {
        e.preventDefault();
        isDragging = true;
        thumb.classList.add("dragging");
        track.classList.add("dragging");

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        startX = clientX;
        startScrollLeft = container.scrollLeft;

        document.addEventListener("mousemove", handleMove);
        document.addEventListener("touchmove", handleMove, { passive: false });
        document.addEventListener("mouseup", handleEnd);
        document.addEventListener("touchend", handleEnd);
    }

    function handleMove(e) {
        if (!isDragging) return;
        e.preventDefault();

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const deltaX = clientX - startX;

        const trackWidth = track.clientWidth;
        const thumbWidth = parseFloat(thumb.style.width) || 60;
        const scrollableContent = container.scrollWidth - container.clientWidth;
        const scrollableTrack = trackWidth - thumbWidth;

        if (scrollableTrack <= 0) return;

        const scrollDelta = (deltaX / scrollableTrack) * scrollableContent;
        container.scrollLeft = startScrollLeft + scrollDelta;
    }

    function handleEnd() {
        isDragging = false;
        thumb.classList.remove("dragging");
        track.classList.remove("dragging");

        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("touchmove", handleMove);
        document.removeEventListener("mouseup", handleEnd);
        document.removeEventListener("touchend", handleEnd);
    }

    thumb.addEventListener("mousedown", handleStart);
    thumb.addEventListener("touchstart", handleStart, { passive: false });

    // --- Click track to jump ---
    track.addEventListener("click", (e) => {
        if (e.target === thumb) return;
        const rect = track.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const ratio = clickX / track.clientWidth;
        const targetScroll = ratio * (container.scrollWidth - container.clientWidth);
        container.scrollTo({ left: targetScroll, behavior: "smooth" });
    });

    // --- Observers ---
    if (typeof ResizeObserver !== "undefined") {
        const ro = new ResizeObserver(updateTopThumb);
        ro.observe(container);
    }

    if (typeof MutationObserver !== "undefined") {
        syncMutationObserver = new MutationObserver(() => requestAnimationFrame(updateTopThumb));
        syncMutationObserver.observe(container, { childList: true, subtree: true, characterData: true });
    }

    window.addEventListener("resize", updateTopThumb);
    
    updateTopThumb();
    topScrollbarInitialized = true;
}

export function destroyTopScrollSync() {
    const track = document.querySelector(".chat-top-scroll-track");
    if (track) track.remove();

    if (syncMutationObserver) {
        syncMutationObserver.disconnect();
        syncMutationObserver = null;
    }

    topScrollbarInitialized = false;
    currentSyncedContainer = null;
}
