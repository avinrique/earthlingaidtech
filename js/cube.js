/* ==========================================================================
   EarthlingAidTech - 3D CUBE Navigation JavaScript
   Controls the cube rotation on scroll/swipe/click
   ========================================================================== */

class Cube3D {
    constructor() {
        this.currentFace = 1;
        this.totalFaces = 6;
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

        this.faceLabels = ['Home', 'Identity', 'Services', 'Products', 'Innovation', 'Network'];

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

        // VELOCITY CHECK: Is the user scrolling efficiently/hard?
        // If so, we bypass the "Edge Brake" and allow immediate transition.
        const HARD_SCROLL_THRESHOLD = 45; // Lowered from 60 to make it easier to trigger
        const isHardScroll = Math.abs(e.deltaY) > HARD_SCROLL_THRESHOLD;

        // EDGE BRAKE LOGIC:
        // If we just hit the edge, STOP. User must pause or scroll again.
        // EXCEPTION 1: Face 1 (Hero) should transition directly (no brake)
        // EXCEPTION 2: Hard Scroll (Velocity Bypass)
        const hittingEdge = (atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0);

        if (this.currentFace !== 1 && hittingEdge && !isHardScroll) {
            // PEEK THRESHOLD CHECK: Only peek if scroll is "medium" strength
            const PEEK_THRESHOLD = 25; // Lowered from 35 to regain some responsiveness
            const magnitude = Math.abs(e.deltaY);

            if (magnitude < PEEK_THRESHOLD) {
                // Too slow? Ignore completely (no brake, no peek, just stop)
                this.scrollAccumulator = 0;
                e.preventDefault();
                return;
            }

            if (!this.wasAtEdge) {
                // Just hit the edge!
                this.wasAtEdge = true;
                this.edgeEntryTime = now;
                this.scrollAccumulator = 0;

                // VISUAL HINT: "Nod" towards the direction they are trying to go
                if (atBottom && e.deltaY > 0) this.triggerPeek(1); // Peek Next
                else if (atTop && e.deltaY < 0) this.triggerPeek(-1); // Peek Prev

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
        } else if (!hittingEdge) {
            // Not pushing against an edge (Normal scrolling inside face)
            this.wasAtEdge = false;
            this.scrollAccumulator = 0;
        }
        // IF Face 1 OR Hard Scroll -> Fall through to Accumulation (No brake, No reset)

        // SCROLL DOWN
        if (e.deltaY > 0) {
            if (atBottom) {
                // We are at the bottom -> Accumulate intent
                this.scrollAccumulator += e.deltaY;

                // Prevent overscroll bounce
                e.preventDefault();

                // Check Threshold
                // If hard scroll, add bonus accumulator to ensure instant trigger
                if (isHardScroll) this.scrollAccumulator += (this.SCROLL_THRESHOLD * 2);

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
                if (isHardScroll) this.scrollAccumulator -= (this.SCROLL_THRESHOLD * 2);

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

    triggerPeek(direction) {
        if (this.isAnimating) return;

        // Don't peek if there is no face in that direction
        if (direction > 0 && this.currentFace === this.totalFaces) return;
        if (direction < 0 && this.currentFace === 1) return;

        const baseAngle = (this.currentFace - 1) * -60;
        const peekAngle = baseAngle + (direction * -12); // Peek 12 degrees (Subtler nod)

        // Override CSS transition for a snappy peek
        this.cube.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        this.cube.style.transform = `translateZ(-86.6vw) rotateY(${peekAngle}deg)`;

        // Bounce back
        setTimeout(() => {
            this.cube.style.transform = `translateZ(-86.6vw) rotateY(${baseAngle}deg)`;

            // Clear inline styles after animation to return control to CSS classes
            setTimeout(() => {
                this.cube.style.transition = '';
                this.cube.style.transform = '';
            }, 300);
        }, 300);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.cube3d = new Cube3D();
});
