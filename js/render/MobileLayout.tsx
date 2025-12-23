
import React, { useEffect, useRef } from 'react';
// @ts-ignore
import { esconderPainel, mostrarPainel } from '../viewer/sidebar.js';

export const MobileInteractableHeader: React.FC = () => {
    const headerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const header = headerRef.current;
        if (!header) return;

        // A referência ao sidebar e body deve ser obtida dinamicamente
        const sidebar = document.getElementById('viewerSidebar');
        const viewerBody = document.getElementById('viewerBody');

        if (!sidebar || !viewerBody) return;

        let startY = 0;
        let currentTranslate = 0;
        let isDragging = false;
        const PEEK_HEIGHT = 50;

        const getSheetHeight = () => sidebar.offsetHeight;

        // --- HANDLERS ---

        const handleClick = (e: MouseEvent) => {
            if (isDragging) return;
            e.preventDefault();
            e.stopPropagation();

            const isCollapsed = viewerBody.classList.contains('sidebar-collapsed');
            if (isCollapsed) {
                mostrarPainel();
            } else {
                esconderPainel();
            }
        };

        const handleTouchStart = (e: TouchEvent) => {
            const touch = e.touches[0];
            startY = touch.clientY;
            isDragging = false; // Reset flag

            const isCollapsed = viewerBody.classList.contains('sidebar-collapsed');
            currentTranslate = isCollapsed ? getSheetHeight() - PEEK_HEIGHT : 0;

            sidebar.style.transition = 'none';
        };

        const handleTouchMove = (e: TouchEvent) => {
            const touch = e.touches[0];
            const deltaY = touch.clientY - startY;
            const newTranslate = currentTranslate + deltaY;
            const maxTranslate = getSheetHeight() - PEEK_HEIGHT;

            if (newTranslate >= -20 && newTranslate <= maxTranslate + 20) {
                sidebar.style.transform = `translateY(${newTranslate}px)`;
                if (Math.abs(deltaY) > 5) {
                    isDragging = true;
                }
            }
        };

        const handleTouchEnd = (e: TouchEvent) => {
            sidebar.style.transition = '';
            sidebar.style.transform = '';

            const touch = e.changedTouches[0];
            const deltaY = touch.clientY - startY;

            if (Math.abs(deltaY) > 60) {
                if (deltaY > 0) esconderPainel();
                else mostrarPainel();
            }

            setTimeout(() => {
                isDragging = false;
            }, 50);
        };

        // --- ATTACH ---
        header.addEventListener('click', handleClick as EventListener);
        header.addEventListener('touchstart', handleTouchStart, { passive: true });
        header.addEventListener('touchmove', handleTouchMove, { passive: true });
        header.addEventListener('touchend', handleTouchEnd, { passive: true });

        // --- CLEANUP ---
        return () => {
            header.removeEventListener('click', handleClick as EventListener);
            header.removeEventListener('touchstart', handleTouchStart);
            header.removeEventListener('touchmove', handleTouchMove);
            header.removeEventListener('touchend', handleTouchEnd);
        };
    }, []);

    return (
        <div id="header-mobile-toggle" ref={headerRef}>
            <div className="drag-handle"></div>
        </div>
    );
};
