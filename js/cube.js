/* ==========================================================================
   EarthlingAidTech - TRUE 3D CUBE Navigation
   4 side faces (left/right) + top & bottom (up/down)
   ========================================================================== */

class Cube3D {
    constructor() {
        this.currentFace = 1;
        this.totalFaces = 6;
        this.isAnimating = false;

        // Which side face we were on before going to top/bottom
        this.lastSideFace = 1;

        // Side faces are 1-4, top=5, bottom=6
        this.sideFaces = [1, 2, 3, 4];

        // Scroll accumulator
        this.scrollAccumulator = 0;
        this.SCROLL_THRESHOLD = 50;
        this.lastScrollTime = 0;

        // Edge brake
        this.wasAtEdge = false;
        this.edgeEntryTime = 0;
        this.EDGE_BRAKE_DURATION = 500;

        // DOM elements
        this.cube = document.querySelector('.cube');
        this.dots = document.querySelectorAll('.cube-nav__dot');
        this.progressBar = document.querySelector('.cube-progress__bar');
        this.prevBtn = document.querySelector('.cube-arrow--prev');
        this.nextBtn = document.querySelector('.cube-arrow--next');
        this.label = document.querySelector('.cube-label');
        this.scrollHint = document.querySelector('.scroll-hint');

        // Mini cube
        this.miniCube = document.querySelector('.mini-cube');
        this.miniCubeViewport = document.querySelector('.mini-cube-viewport');
        this.miniFaces = document.querySelectorAll('.mini-cube__face');

        // Mini cube drag state
        this.miniDragging = false;
        this.miniDragDidMove = false;
        this.miniDragStartX = 0;
        this.miniDragStartY = 0;
        this.miniDragBaseRotX = 0;
        this.miniDragBaseRotY = 0;
        this.miniRotX = -15;
        this.miniRotY = 25;
        this.miniDragThreshold = 5;
        this.miniDragSensitivity = 2.0;
        this.miniIsFreeRotated = false;

        // Bound handlers for cleanup
        this._onMiniMouseMove = this.onMiniMouseMove.bind(this);
        this._onMiniMouseUp = this.onMiniMouseUp.bind(this);
        this._onMiniTouchMove = this.onMiniTouchMove.bind(this);
        this._onMiniTouchEnd = this.onMiniTouchEnd.bind(this);

        this.faceLabels = ['Home', 'Identity', 'Services', 'Products', 'Innovation', 'Network'];

        // Cube transform angles per face: [rotateX, rotateY] matching CSS data-face selectors
        this.faceAngles = {
            1: [0, 0],       // front
            2: [0, -90],     // right
            3: [0, -180],    // back
            4: [0, 90],      // left
            5: [-90, 0],     // top
            6: [90, 0]       // bottom
        };

        if (!this.cube) return;
        this.init();
    }

    init() {
        document.body.classList.add('cube-mode');
        this.updateUI();

        // Scroll
        window.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });

        // Touch
        window.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        window.addEventListener('touchend', (e) => this.handleTouchEnd(e));

        // Keyboard
        window.addEventListener('keydown', (e) => this.handleKeydown(e));

        // Dot nav
        this.dots.forEach((dot, i) => {
            dot.addEventListener('click', () => this.goToFace(i + 1));
        });

        if (this.prevBtn) this.prevBtn.addEventListener('click', () => this.navigate('left'));
        if (this.nextBtn) this.nextBtn.addEventListener('click', () => this.navigate('right'));

        // Mini cube face clicks
        this.miniFaces.forEach(face => {
            face.addEventListener('click', () => {
                const faceNum = parseInt(face.dataset.face);
                if (faceNum) this.goToFace(faceNum);
            });
        });

        // Mini cube drag-to-rotate
        this.initMiniCubeDrag();
    }

    // Determine navigation direction from scroll
    handleWheel(e) {
        if (this.isAnimating) {
            e.preventDefault();
            return;
        }

        const now = Date.now();
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

        const atTop = scrollTop <= 5;
        const atBottom = scrollTop + clientHeight >= scrollHeight - 5;

        const absX = Math.abs(e.deltaX);
        const absY = Math.abs(e.deltaY);

        // Horizontal scroll -> side navigation (left/right)
        if (absX > absY && absX > 20) {
            e.preventDefault();
            if (e.deltaX > 0) this.navigate('right');
            else this.navigate('left');
            this.scrollAccumulator = 0;
            this.lastScrollTime = now;
            return;
        }

        // Vertical scroll
        const HARD_SCROLL_THRESHOLD = 45;
        const isHardScroll = absY > HARD_SCROLL_THRESHOLD;
        const hittingEdge = (atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0);

        if (this.currentFace !== 1 && hittingEdge && !isHardScroll) {
            const PEEK_THRESHOLD = 25;
            if (absY < PEEK_THRESHOLD) {
                this.scrollAccumulator = 0;
                e.preventDefault();
                return;
            }

            if (!this.wasAtEdge) {
                this.wasAtEdge = true;
                this.edgeEntryTime = now;
                this.scrollAccumulator = 0;

                if (atBottom && e.deltaY > 0) this.triggerPeek('down');
                else if (atTop && e.deltaY < 0) this.triggerPeek('up');

                e.preventDefault();
                return;
            } else {
                if (now - this.edgeEntryTime < this.EDGE_BRAKE_DURATION) {
                    this.scrollAccumulator = 0;
                    e.preventDefault();
                    return;
                }
            }
        } else if (!hittingEdge) {
            this.wasAtEdge = false;
            this.scrollAccumulator = 0;
        }

        // Scroll down
        if (e.deltaY > 0 && atBottom) {
            this.scrollAccumulator += e.deltaY;
            e.preventDefault();
            if (isHardScroll) this.scrollAccumulator += this.SCROLL_THRESHOLD * 2;
            if (this.scrollAccumulator > this.SCROLL_THRESHOLD) {
                this.navigate('down');
                this.scrollAccumulator = 0;
                this.lastScrollTime = now;
            }
        }
        // Scroll up
        else if (e.deltaY < 0 && atTop) {
            this.scrollAccumulator += e.deltaY;
            e.preventDefault();
            if (isHardScroll) this.scrollAccumulator -= this.SCROLL_THRESHOLD * 2;
            if (this.scrollAccumulator < -this.SCROLL_THRESHOLD) {
                this.navigate('up');
                this.scrollAccumulator = 0;
                this.lastScrollTime = now;
            }
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

        // Determine dominant swipe direction
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            if (Math.abs(deltaX) > 50) {
                if (deltaX > 0) this.navigate('right');
                else this.navigate('left');
            }
        } else {
            if (Math.abs(deltaY) > 50) {
                if (deltaY > 0) this.navigate('down');
                else this.navigate('up');
            }
        }
    }

    handleKeydown(e) {
        if (this.isAnimating) return;
        switch (e.key) {
            case 'ArrowRight':
                e.preventDefault();
                this.navigate('right');
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.navigate('left');
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.navigate('up');
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.navigate('down');
                break;
        }
    }

    /**
     * Navigation logic:
     * - Left/Right: cycle through side faces 1 -> 2 -> 3 -> 4 -> 1
     * - Up: go to face 5 (top) from any side face
     * - Down: go to face 6 (bottom) from any side face
     * - From top/bottom, up/down returns to last side face
     */
    navigate(direction) {
        const isSide = this.sideFaces.includes(this.currentFace);
        const isTop = this.currentFace === 5;
        const isBottom = this.currentFace === 6;

        let targetFace = this.currentFace;

        if (direction === 'right') {
            if (isSide) {
                const idx = this.sideFaces.indexOf(this.currentFace);
                targetFace = this.sideFaces[(idx + 1) % 4];
            } else {
                // From top/bottom, go right returns to side
                targetFace = this.lastSideFace;
            }
        } else if (direction === 'left') {
            if (isSide) {
                const idx = this.sideFaces.indexOf(this.currentFace);
                targetFace = this.sideFaces[(idx + 3) % 4];
            } else {
                targetFace = this.lastSideFace;
            }
        } else if (direction === 'up') {
            if (isSide) {
                targetFace = 5;
            } else if (isBottom) {
                targetFace = this.lastSideFace;
            }
            // Already at top -> do nothing
        } else if (direction === 'down') {
            if (isSide) {
                targetFace = 6;
            } else if (isTop) {
                targetFace = this.lastSideFace;
            }
            // Already at bottom -> do nothing
        }

        if (targetFace !== this.currentFace) {
            // Remember side face before leaving
            if (isSide) {
                this.lastSideFace = this.currentFace;
            }
            this.goToFace(targetFace);
        }
    }

    goToFace(faceNumber) {
        if (this.isAnimating || faceNumber === this.currentFace) return;

        // Track last side face
        if (this.sideFaces.includes(this.currentFace)) {
            this.lastSideFace = this.currentFace;
        }

        this.isAnimating = true;
        this.currentFace = faceNumber;
        this.scrollAccumulator = 0;

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
        }, 1200);
    }

    updateUI() {
        // Dots
        this.dots.forEach((dot, i) => dot.classList.toggle('active', i + 1 === this.currentFace));

        // Progress bar
        if (this.progressBar) {
            const progress = (this.currentFace / this.totalFaces) * 100;
            this.progressBar.style.width = `${progress}%`;
        }

        // Arrow buttons
        if (this.prevBtn) this.prevBtn.disabled = false;
        if (this.nextBtn) this.nextBtn.disabled = false;

        // Label
        if (this.label) this.label.textContent = this.faceLabels[this.currentFace - 1] || '';

        // Active face pointer events
        document.querySelectorAll('.cube__face').forEach(face => face.classList.remove('active'));
        const activeFace = document.querySelector(`.cube__face--${this.currentFace}`);
        if (activeFace) activeFace.classList.add('active');

        // Mini cube sync
        this.updateMiniCube();
    }

    updateMiniCube() {
        if (!this.miniCube) return;

        const angles = this.faceAngles[this.currentFace];
        // Rotate mini cube to show active face, with a slight tilt for 3D feel
        const rx = angles[0] + 15;
        const ry = angles[1] - 25;
        this.miniCube.style.transform = `rotateX(${-rx}deg) rotateY(${-ry}deg)`;

        // Sync drag state so next drag starts from the correct base
        this.miniRotX = -rx;
        this.miniRotY = -ry;
        this.miniIsFreeRotated = false;
        this.miniCube.classList.remove('dragging');

        // Highlight active face
        this.miniFaces.forEach(face => {
            const faceNum = parseInt(face.dataset.face);
            face.classList.toggle('active', faceNum === this.currentFace);
        });
    }

    // ===== Mini Cube Drag-to-Rotate =====

    initMiniCubeDrag() {
        if (!this.miniCubeViewport) return;

        // Mouse events on viewport
        this.miniCubeViewport.addEventListener('mousedown', (e) => this.onMiniMouseDown(e));

        // Touch events on viewport
        this.miniCubeViewport.addEventListener('touchstart', (e) => this.onMiniTouchStart(e), { passive: false });

        // Capture-phase click suppressor on each face — blocks navigation click after drag
        this.miniFaces.forEach(face => {
            face.addEventListener('click', (e) => {
                if (this.miniDragDidMove) {
                    e.stopImmediatePropagation();
                    e.preventDefault();
                }
            }, true); // capture phase
        });
    }

    onMiniMouseDown(e) {
        e.preventDefault();
        this.miniDragging = true;
        this.miniDragDidMove = false;
        this.miniDragStartX = e.clientX;
        this.miniDragStartY = e.clientY;
        this.miniDragBaseRotX = this.miniRotX;
        this.miniDragBaseRotY = this.miniRotY;

        document.addEventListener('mousemove', this._onMiniMouseMove);
        document.addEventListener('mouseup', this._onMiniMouseUp);
    }

    onMiniMouseMove(e) {
        if (!this.miniDragging) return;

        const dx = e.clientX - this.miniDragStartX;
        const dy = e.clientY - this.miniDragStartY;

        // Check threshold before committing to drag
        if (!this.miniDragDidMove && Math.abs(dx) < this.miniDragThreshold && Math.abs(dy) < this.miniDragThreshold) {
            return;
        }

        this.miniDragDidMove = true;
        this.miniIsFreeRotated = true;
        this.miniCube.classList.add('dragging');

        // Horizontal drag → Y-axis rotation, vertical drag → X-axis rotation
        this.miniRotY = this.miniDragBaseRotY + dx * this.miniDragSensitivity;
        this.miniRotX = this.miniDragBaseRotX - dy * this.miniDragSensitivity;

        this.miniCube.style.transform = `rotateX(${this.miniRotX}deg) rotateY(${this.miniRotY}deg)`;
    }

    onMiniMouseUp(e) {
        this.miniDragging = false;
        document.removeEventListener('mousemove', this._onMiniMouseMove);
        document.removeEventListener('mouseup', this._onMiniMouseUp);

        // If dragged, navigate to whichever face ended up facing the viewer
        if (this.miniDragDidMove) {
            const frontFace = this.getFrontFace();
            this.goToFace(frontFace);
        }
    }

    onMiniTouchStart(e) {
        if (e.touches.length !== 1) return;
        e.preventDefault(); // prevent scroll/zoom

        this.miniDragging = true;
        this.miniDragDidMove = false;
        this.miniDragStartX = e.touches[0].clientX;
        this.miniDragStartY = e.touches[0].clientY;
        this.miniDragBaseRotX = this.miniRotX;
        this.miniDragBaseRotY = this.miniRotY;

        document.addEventListener('touchmove', this._onMiniTouchMove, { passive: false });
        document.addEventListener('touchend', this._onMiniTouchEnd);
    }

    onMiniTouchMove(e) {
        if (!this.miniDragging) return;
        e.preventDefault();

        const touch = e.touches[0];
        const dx = touch.clientX - this.miniDragStartX;
        const dy = touch.clientY - this.miniDragStartY;

        if (!this.miniDragDidMove && Math.abs(dx) < this.miniDragThreshold && Math.abs(dy) < this.miniDragThreshold) {
            return;
        }

        this.miniDragDidMove = true;
        this.miniIsFreeRotated = true;
        this.miniCube.classList.add('dragging');

        this.miniRotY = this.miniDragBaseRotY + dx * this.miniDragSensitivity;
        this.miniRotX = this.miniDragBaseRotX - dy * this.miniDragSensitivity;

        this.miniCube.style.transform = `rotateX(${this.miniRotX}deg) rotateY(${this.miniRotY}deg)`;
    }

    onMiniTouchEnd(e) {
        this.miniDragging = false;
        document.removeEventListener('touchmove', this._onMiniTouchMove);
        document.removeEventListener('touchend', this._onMiniTouchEnd);

        if (this.miniDragDidMove) {
            // Dragged — navigate to whichever face ended up facing the viewer
            const frontFace = this.getFrontFace();
            this.goToFace(frontFace);
        } else {
            // Tap — navigate to the tapped face
            const touch = e.changedTouches[0];
            const el = document.elementFromPoint(touch.clientX, touch.clientY);
            if (el) {
                const face = el.closest('.mini-cube__face');
                if (face) {
                    const faceNum = parseInt(face.dataset.face);
                    if (faceNum) this.goToFace(faceNum);
                }
            }
        }
    }

    // Determine which mini cube face is most facing the viewer based on current rotation
    getFrontFace() {
        // Face normals in cube local space
        const normals = [
            [1, 0, 0, 1],    // face 1: front (+Z)
            [2, 1, 0, 0],    // face 2: right (+X)
            [3, 0, 0, -1],   // face 3: back (-Z)
            [4, -1, 0, 0],   // face 4: left (-X)
            [5, 0, -1, 0],   // face 5: top (-Y in CSS 3D)
            [6, 0, 1, 0]     // face 6: bottom (+Y in CSS 3D)
        ];

        const ax = this.miniRotX * Math.PI / 180;
        const ay = this.miniRotY * Math.PI / 180;

        let bestFace = 1;
        let bestZ = -Infinity;

        for (const [face, nx, ny, nz] of normals) {
            // Apply rotateY(ay) first
            const x1 = nx * Math.cos(ay) + nz * Math.sin(ay);
            const y1 = ny;
            const z1 = -nx * Math.sin(ay) + nz * Math.cos(ay);

            // Then rotateX(ax)
            const z2 = y1 * Math.sin(ax) + z1 * Math.cos(ax);

            if (z2 > bestZ) {
                bestZ = z2;
                bestFace = face;
            }
        }

        return bestFace;
    }

    triggerPeek(direction) {
        if (this.isAnimating) return;

        const angles = this.faceAngles[this.currentFace];
        let peekX = angles[0];
        let peekY = angles[1];

        // Nudge slightly toward the target direction
        if (direction === 'down') peekX += 8;
        else if (direction === 'up') peekX -= 8;
        else if (direction === 'right') peekY -= 8;
        else if (direction === 'left') peekY += 8;

        this.cube.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        this.cube.style.transform = `translateZ(-50vw) rotateX(${peekX}deg) rotateY(${peekY}deg)`;

        setTimeout(() => {
            const orig = this.faceAngles[this.currentFace];
            this.cube.style.transform = `translateZ(-50vw) rotateX(${orig[0]}deg) rotateY(${orig[1]}deg)`;

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
