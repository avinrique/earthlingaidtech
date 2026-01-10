/* ==========================================================================
   EarthlingAidTech - 3D CUBE Navigation JavaScript
   Controls the cube rotation on scroll/swipe/click
   ========================================================================== */

class Cube3D {
    constructor() {
        this.currentFace = 1;
        this.totalFaces = 4;
        this.isAnimating = false;
        this.touchStartX = 0;
        this.touchStartY = 0;

        this.cube = document.querySelector('.cube');
        this.dots = document.querySelectorAll('.cube-nav__dot');
        this.progressBar = document.querySelector('.cube-progress__bar');
        this.prevBtn = document.querySelector('.cube-arrow--prev');
        this.nextBtn = document.querySelector('.cube-arrow--next');
        this.label = document.querySelector('.cube-label');
        this.scrollHint = document.querySelector('.scroll-hint');

        this.faceLabels = ['Home', 'About Us', 'Our Work', 'Contact'];

        if (!this.cube) return;

        this.init();
    }

    init() {
        // Set initial state
        document.body.classList.add('cube-mode');
        this.updateUI();

        // Scroll/wheel to rotate
        window.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });

        // Touch swipe support
        window.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        window.addEventListener('touchend', (e) => this.handleTouchEnd(e));

        // Keyboard navigation
        window.addEventListener('keydown', (e) => this.handleKeydown(e));

        // Navigation dots
        this.dots.forEach((dot, i) => {
            dot.addEventListener('click', () => this.goToFace(i + 1));
        });

        // Arrow buttons
        if (this.prevBtn) {
            this.prevBtn.addEventListener('click', () => this.prevFace());
        }
        if (this.nextBtn) {
            this.nextBtn.addEventListener('click', () => this.nextFace());
        }
    }

    handleWheel(e) {
        e.preventDefault();

        if (this.isAnimating) return;

        // Determine direction based on horizontal scroll or vertical scroll
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;

        if (delta > 30) {
            this.nextFace();
        } else if (delta < -30) {
            this.prevFace();
        }
    }

    handleTouchStart(e) {
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
    }

    handleTouchEnd(e) {
        if (this.isAnimating) return;

        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const deltaX = this.touchStartX - touchEndX;
        const deltaY = this.touchStartY - touchEndY;

        // Use horizontal swipe primarily
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
            if (deltaX > 0) {
                this.nextFace();
            } else {
                this.prevFace();
            }
        }
    }

    handleKeydown(e) {
        if (this.isAnimating) return;

        switch (e.key) {
            case 'ArrowRight':
            case 'ArrowDown':
                e.preventDefault();
                this.nextFace();
                break;
            case 'ArrowLeft':
            case 'ArrowUp':
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
        if (faceNumber === this.currentFace || this.isAnimating) return;
        if (faceNumber < 1 || faceNumber > this.totalFaces) return;

        this.isAnimating = true;
        this.currentFace = faceNumber;

        // Rotate the cube
        this.cube.setAttribute('data-face', faceNumber);

        // Hide scroll hint after first rotation
        if (this.scrollHint && faceNumber > 1) {
            this.scrollHint.style.opacity = '0';
            setTimeout(() => {
                this.scrollHint.style.display = 'none';
            }, 300);
        }

        // Update UI
        this.updateUI();

        // Reset animation lock
        setTimeout(() => {
            this.isAnimating = false;
        }, 800);
    }

    updateUI() {
        // Update dots
        this.dots.forEach((dot, i) => {
            dot.classList.toggle('active', i + 1 === this.currentFace);
        });

        // Update progress bar
        if (this.progressBar) {
            const progress = (this.currentFace / this.totalFaces) * 100;
            this.progressBar.style.width = `${progress}%`;
        }

        // Update arrows
        if (this.prevBtn) {
            this.prevBtn.disabled = this.currentFace === 1;
        }
        if (this.nextBtn) {
            this.nextBtn.disabled = this.currentFace === this.totalFaces;
        }

        // Update label
        if (this.label) {
            this.label.textContent = this.faceLabels[this.currentFace - 1] || '';
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new Cube3D();
});
