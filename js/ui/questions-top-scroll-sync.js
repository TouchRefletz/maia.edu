/**
 * Questions & Filters Unified Scroll Synchronization (FINAL FIX V2)
 * ──────────────────────────────────────────────
 * Syncs BOTH Horizontal and Vertical custom scrollbars.
 * Includes horizontal "Glow" (Hint) logic.
 */

let questionsScrollbarInitialized = false;
let currentQuestionsContainer = null;

/**
 * Get the main scroll container
 */
function getBankScrollContainer() {
    return document.querySelector(".bank-layout");
}

/**
 * Create or get the H-track
 */
function ensureHTrack() {
    let track = document.querySelector(".questions-top-scroll-track");
    if (!track) {
        track = document.createElement("div");
        track.className = "questions-top-scroll-track";
        track.innerHTML = '<div class="questions-top-scroll-thumb"></div>';
        document.body.appendChild(track);
    }
    return track;
}

/**
 * Create or get the V-track
 */
function ensureVTrack() {
    let track = document.querySelector(".questions-vertical-scroll-track");
    if (!track) {
        track = document.createElement("div");
        track.className = "questions-vertical-scroll-track";
        track.innerHTML = '<div class="questions-vertical-scroll-thumb"></div>';
        document.body.appendChild(track);
    }
    return track;
}

/**
 * Initialize all premium scroll components for Questions
 */
export function initQuestionsTopScrollSync() {
    const container = getBankScrollContainer();
    if (!container) return;

    const hTrack = ensureHTrack();
    const vTrack = ensureVTrack();
    const hThumb = hTrack.querySelector(".questions-top-scroll-thumb");
    const vThumb = vTrack.querySelector(".questions-vertical-scroll-thumb");

    function updateBars() {
        if (!container) return;
        
        const { scrollLeft, scrollWidth, clientWidth, scrollTop, scrollHeight, clientHeight } = container;

        // 1. HORIZONTAL SYNC
        const hTrackWidth = hTrack.clientWidth;
        if (scrollWidth > clientWidth + 5) {
            hTrack.classList.add("active");
            const hRatio = clientWidth / scrollWidth;
            const hThumbW = Math.max(80, hTrackWidth * hRatio);
            const hMaxSc = scrollWidth - clientWidth;
            const hScRatio = scrollLeft / hMaxSc;
            hThumb.style.width = `${hThumbW}px`;
            hThumb.style.left = `${hScRatio * (hTrackWidth - hThumbW)}px`;

            // Update Glow Hints
            container.classList.toggle("has-h-glow-left", scrollLeft > 10);
            container.classList.toggle("has-h-glow-right", scrollLeft < hMaxSc - 10);
        } else {
            hTrack.classList.remove("active");
            container.classList.remove("has-h-glow-left", "has-h-glow-right");
        }

        // 2. VERTICAL SYNC
        const vTrackHeight = vTrack.clientHeight;
        if (scrollHeight > clientHeight + 5) {
            vTrack.classList.add("active");
            const vRatio = clientHeight / scrollHeight;
            const vThumbH = Math.max(60, vTrackHeight * vRatio);
            const vMaxSc = scrollHeight - clientHeight;
            const vScRatio = scrollTop / vMaxSc;
            vThumb.style.height = `${vThumbH}px`;
            vThumb.style.top = `${vScRatio * (vTrackHeight - vThumbH)}px`;
        } else {
            vTrack.classList.remove("active");
        }
    }

    if (questionsScrollbarInitialized && currentQuestionsContainer === container) {
        updateBars();
        return;
    }

    currentQuestionsContainer = container;
    
    // --- Scroll Events ---
    container.addEventListener("scroll", updateBars, { passive: true });

    // --- Drag Logic (V & H) ---
    function setupDrag(thumb, track, isVertical) {
        let isDragging = false;
        let startPos = 0;
        let startScroll = 0;

        function handleStart(e) {
            if (!e.touches) e.preventDefault();
            isDragging = true;
            thumb.classList.add("dragging");
            track.classList.add("dragging");
            startPos = isVertical ? (e.touches ? e.touches[0].clientY : e.clientY) : (e.touches ? e.touches[0].clientX : e.clientX);
            startScroll = isVertical ? container.scrollTop : container.scrollLeft;

            const moveHandler = (ev) => {
                if (!isDragging) return;
                if (ev.touches) ev.preventDefault();
                const currentPos = isVertical ? (ev.touches ? ev.touches[0].clientY : ev.clientY) : (ev.touches ? ev.touches[0].clientX : ev.clientX);
                const delta = currentPos - startPos;
                const trackDim = isVertical ? track.clientHeight : track.clientWidth;
                const thumbDim = isVertical ? parseFloat(thumb.style.height) : parseFloat(thumb.style.width);
                const contentSize = isVertical ? container.scrollHeight : container.scrollWidth;
                const clientSize = isVertical ? container.clientHeight : container.clientWidth;
                const scrollable = contentSize - clientSize;
                const trackScrollable = trackDim - thumbDim;
                if (trackScrollable > 0) {
                    if (isVertical) container.scrollTop = startScroll + (delta / trackScrollable) * scrollable;
                    else container.scrollLeft = startScroll + (delta / trackScrollable) * scrollable;
                }
            };

            const endHandler = () => {
                isDragging = false;
                thumb.classList.remove("dragging");
                track.classList.remove("dragging");
                document.removeEventListener("mousemove", moveHandler);
                document.removeEventListener("mouseup", endHandler);
                document.removeEventListener("touchmove", moveHandler);
                document.removeEventListener("touchend", endHandler);
            };

            document.addEventListener("mousemove", moveHandler);
            document.addEventListener("mouseup", endHandler);
            document.addEventListener("touchmove", moveHandler, { passive: false });
            document.addEventListener("touchend", endHandler);
        }

        thumb.addEventListener("mousedown", handleStart);
        thumb.addEventListener("touchstart", handleStart, { passive: false });
    }

    setupDrag(hThumb, hTrack, false);
    setupDrag(vThumb, vTrack, true);

    // --- Observer ---
    if (typeof ResizeObserver !== "undefined") {
        const ro = new ResizeObserver(() => requestAnimationFrame(updateBars));
        ro.observe(container);
    }

    requestAnimationFrame(updateBars);
    questionsScrollbarInitialized = true;
}

export function destroyQuestionsTopScrollSync() {
    document.querySelectorAll(".questions-top-scroll-track, .questions-vertical-scroll-track").forEach(el => el.remove());
    questionsScrollbarInitialized = false;
    currentQuestionsContainer = null;
}
