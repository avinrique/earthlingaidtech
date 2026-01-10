/* ==========================================================================
   EarthlingAidTech - 3D CUBE Navigation JavaScript
   Controls the cube rotation on scroll/swipe/click
   ========================================================================== */

class Cube3D {
    constructor() {
        this.currentFace = 1;
        this.totalFaces = 4;
        this.isAnimating = false;

        // Interaction Logic
        this.scrollAccumulator = 0; // Accumulates intention to rotate
        this.SCROLL_THRESHOLD = 50; // Pixels of "virtual" scroll needed to trigger
        this.scrollAccumulator = 0; // Accumulates intention to rotate
        this.SCROLL_THRESHOLD = 50; // Pixels of "virtual" scroll needed to trigger
        this.lastScrollTime = 0;

        // Edge Brake Logic (Stop-and-Go)
        this.wasAtEdge = false;
        this.edgeEntryTime = 0;
        this.EDGE_BRAKE_DURATION = 500; // ms to wait after hitting edge

        this.cube = document.querySelector('.cube');
        this.dots = document.querySelectorAll('.cube-nav__dot');
        this.progressBar = document.querySelector('.cube-progress__bar');
        this.prevBtn = document.querySelector('.cube-arrow--prev');
        this.nextBtn = document.querySelector('.cube-arrow--next');
        this.label = document.querySelector('.cube-label');
        this.scrollHint = document.querySelector('.scroll-hint');

        this.faceLabels = ['Home', 'Identity', 'Impact', 'Network'];

        if (!this.cube) return;

        this.init();
    }

    init() {
        document.body.classList.add('cube-mode');
        this.updateUI();

        // Main Scroll Handler
        window.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });

        // Touch/Swipe Logic
        window.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        window.addEventListener('touchend', (e) => this.handleTouchEnd(e));

        window.addEventListener('keydown', (e) => this.handleKeydown(e));

        // UI Controls
        this.dots.forEach((dot, i) => {
            dot.addEventListener('click', () => this.goToFace(i + 1));
        });

        if (this.prevBtn) this.prevBtn.addEventListener('click', () => this.prevFace());
        if (this.nextBtn) this.nextBtn.addEventListener('click', () => this.nextFace());
    }

    handleWheel(e) {
        if (this.isAnimating) {
            e.preventDefault();
            return;
        }

        const now = Date.now();
        // Prevent rapid re-triggers
        if (now - this.lastScrollTime < 500) {
            this.scrollAccumulator = 0;
            return;
        }

        const activeFace = document.querySelector(`.cube__face--${this.currentFace}`);
        if (!activeFace) return;

        let scrollContainer = activeFace.querySelector('.cube-face-content');
        if (!scrollContainer) scrollContainer = activeFace;

        const scrollTop = scrollContainer.scrollTop;
        const scrollHeight = scrollContainer.scrollHeight;
        const clientHeight = scrollContainer.clientHeight;

        // Looser detection for "At Edge" (5px buffer) covers precision issues
        const atTop = scrollTop <= 5;
        const atBottom = scrollTop + clientHeight >= scrollHeight - 5;

        // EDGE BRAKE LOGIC:
        // If we just hit the edge, STOP. User must pause or scroll again.
        if ((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0)) {
            if (!this.wasAtEdge) {
                // Just hit the edge!
                this.wasAtEdge = true;
                this.edgeEntryTime = now;
                this.scrollAccumulator = 0;
                e.preventDefault();
                return; // STOP!
            } else {
                // Already at edge. Check if cooldown passed.
                if (now - this.edgeEntryTime < this.EDGE_BRAKE_DURATION) {
                    this.scrollAccumulator = 0;
                    e.preventDefault();
                    return; // STILL WAITING
                }
                // Cooldown passed, ALLOW ROTATION logic below...
            }
        } else {
            // Not pushing against an edge
            this.wasAtEdge = false;
            this.scrollAccumulator = 0;
        }

        // SCROLL DOWN
        if (e.deltaY > 0) {
            if (atBottom) {
                // We are at the bottom -> Accumulate intent
                this.scrollAccumulator += e.deltaY;

                // Prevent overscroll bounce
                e.preventDefault();

                // Check Threshold
                if (this.scrollAccumulator > this.SCROLL_THRESHOLD) {
                    this.nextFace();
                    this.scrollAccumulator = 0;
                    this.lastScrollTime = now;
                }
            }
        }
        // SCROLL UP
        else if (e.deltaY < 0) {
            if (atTop) {
                // We are at the top -> Accumulate intent (deltaY is negative)
                this.scrollAccumulator += e.deltaY;

                e.preventDefault();

                // Check Threshold (negative)
                if (this.scrollAccumulator < -this.SCROLL_THRESHOLD) {
                    this.prevFace();
                    this.scrollAccumulator = 0;
                    this.lastScrollTime = now;
                }
            }
        }

        // Horizontal Support (Immediate)
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 20) {
            e.preventDefault();
            if (e.deltaX > 0) this.nextFace();
            else this.prevFace();
            this.scrollAccumulator = 0;
            this.lastScrollTime = now;
        }
    }

    handleTouchStart(e) {
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
    }

    handleTouchEnd(e) {
        if (this.isAnimating) return;

        const touchEndX = e.changedTouches[0].clientX;
        const deltaX = this.touchStartX - touchEndX;

        if (Math.abs(deltaX) > 50) {
            if (deltaX > 0) this.nextFace();
            else this.prevFace();
        }
    }

    handleKeydown(e) {
        if (this.isAnimating) return;
        switch (e.key) {
            case 'ArrowRight':
                e.preventDefault();
                this.nextFace();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.prevFace();
                break;
        }
    }

    nextFace() {
        if (this.currentFace < this.totalFaces) {
            this.goToFace(this.currentFace + 1);
        }
    }

    prevFace() {
        if (this.currentFace > 1) {
            this.goToFace(this.currentFace - 1);
        }
    }

    goToFace(faceNumber) {
        if (this.isAnimating) return;

        this.isAnimating = true;
        this.currentFace = faceNumber;
        this.scrollAccumulator = 0; // Reset intent

        this.cube.setAttribute('data-face', faceNumber);

        if (this.scrollHint) {
            this.scrollHint.style.opacity = '0';
            setTimeout(() => {
                if (this.scrollHint) this.scrollHint.style.display = 'none';
            }, 300);
        }

        this.updateUI();

        setTimeout(() => {
            this.isAnimating = false;
        }, 1200); // Slightly longer lock to prevent bounce
    }

    updateUI() {
        this.dots.forEach((dot, i) => dot.classList.toggle('active', i + 1 === this.currentFace));
        if (this.progressBar) {
            const progress = (this.currentFace / this.totalFaces) * 100;
            this.progressBar.style.width = `${progress}%`;
        }
        if (this.prevBtn) this.prevBtn.disabled = this.currentFace === 1;
        if (this.nextBtn) this.nextBtn.disabled = this.currentFace === this.totalFaces;
        if (this.label) this.label.textContent = this.faceLabels[this.currentFace - 1] || '';

        // Toggle active class on actual faces to manage pointer-events
        document.querySelectorAll('.cube__face').forEach(face => {
            face.classList.remove('active');
        });
        const activeFace = document.querySelector(`.cube__face--${this.currentFace}`);
        if (activeFace) activeFace.classList.add('active');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.cube3d = new Cube3D();
});
