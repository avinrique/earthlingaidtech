/* ==========================================================================
   EarthlingAidTech - Main JavaScript
   GSAP Animations & Interactions
   ========================================================================== */

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Initialize GSAP ScrollTrigger
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);
        initScrollAnimations();
    } else {
        // Fallback: Show all elements if GSAP isn't loaded
        document.querySelectorAll('.fade-in').forEach(el => {
            el.classList.add('visible');
        });
    }

    // Initialize other interactions
    initSmoothScroll();
    initHeroAnimation();
});

/* ===== Scroll Animations ===== */
function initScrollAnimations() {
    // Fade in elements on scroll
    const fadeElements = document.querySelectorAll('.fade-in');

    fadeElements.forEach((el, index) => {
        // Get stagger delay if exists
        let delay = 0;
        for (let i = 1; i <= 5; i++) {
            if (el.classList.contains(`stagger-${i}`)) {
                delay = i * 0.1;
                break;
            }
        }

        gsap.fromTo(el,
            {
                opacity: 0,
                y: 30
            },
            {
                opacity: 1,
                y: 0,
                duration: 0.8,
                delay: delay,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: el,
                    start: 'top 85%',
                    toggleActions: 'play none none none'
                }
            }
        );
    });

    // Parallax effect for sections
    gsap.utils.toArray('.section').forEach(section => {
        gsap.fromTo(section,
            { opacity: 0.8 },
            {
                opacity: 1,
                scrollTrigger: {
                    trigger: section,
                    start: 'top bottom',
                    end: 'top center',
                    scrub: true
                }
            }
        );
    });

    // Service cards stagger animation
    const serviceCards = document.querySelectorAll('.service-card');
    if (serviceCards.length > 0) {
        gsap.fromTo(serviceCards,
            {
                opacity: 0,
                y: 40,
                scale: 0.95
            },
            {
                opacity: 1,
                y: 0,
                scale: 1,
                duration: 0.6,
                stagger: 0.1,
                ease: 'power2.out',
                scrollTrigger: {
                    trigger: '.services__grid',
                    start: 'top 80%'
                }
            }
        );
    }

    // Stats counter animation
    const statNumbers = document.querySelectorAll('.stat-card__number');
    statNumbers.forEach(stat => {
        const text = stat.textContent;
        const number = parseInt(text);

        if (!isNaN(number)) {
            gsap.fromTo(stat,
                { innerText: 0 },
                {
                    innerText: number,
                    duration: 2,
                    ease: 'power1.out',
                    snap: { innerText: 1 },
                    scrollTrigger: {
                        trigger: stat,
                        start: 'top 85%'
                    },
                    onUpdate: function () {
                        stat.textContent = Math.ceil(this.targets()[0].innerText) + (text.includes('+') ? '+' : '');
                    }
                }
            );
        }
    });

    // Why us items
    const whyUsItems = document.querySelectorAll('.why-us__item');
    if (whyUsItems.length > 0) {
        gsap.fromTo(whyUsItems,
            {
                opacity: 0,
                x: -20
            },
            {
                opacity: 1,
                x: 0,
                duration: 0.5,
                stagger: 0.1,
                ease: 'power2.out',
                scrollTrigger: {
                    trigger: '.why-us__list',
                    start: 'top 80%'
                }
            }
        );
    }

    // Leadership cards
    const leaderCards = document.querySelectorAll('.leader-card');
    if (leaderCards.length > 0) {
        gsap.fromTo(leaderCards,
            {
                opacity: 0,
                y: 30
            },
            {
                opacity: 1,
                y: 0,
                duration: 0.8,
                stagger: 0.2,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: '.leadership__grid',
                    start: 'top 80%'
                }
            }
        );
    }

    // Client logos
    const clientLogos = document.querySelectorAll('.client-logo');
    if (clientLogos.length > 0) {
        gsap.fromTo(clientLogos,
            {
                opacity: 0,
                scale: 0.8
            },
            {
                opacity: 0.8,
                scale: 1,
                duration: 0.5,
                stagger: 0.1,
                ease: 'back.out(1.7)',
                scrollTrigger: {
                    trigger: '.clients__logos',
                    start: 'top 85%'
                }
            }
        );
    }
}

/* ===== Hero Animation ===== */
function initHeroAnimation() {
    if (typeof gsap === 'undefined') return;

    const heroContent = document.querySelector('.hero__content');
    if (!heroContent) return;

    // Initial hero animation
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    tl.fromTo('.hero__headline',
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 1.2 }
    )
        .fromTo('.hero__subtext',
            { opacity: 0, y: 30 },
            { opacity: 1, y: 0, duration: 1 },
            '-=0.6'
        )
        .fromTo('.hero__ctas',
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.8 },
            '-=0.5'
        );
}

/* ===== Smooth Scroll ===== */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));

            if (target) {
                const offset = 80; // Account for any fixed header
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/* ===== Button Hover Effects ===== */
document.addEventListener('DOMContentLoaded', () => {
    // Add magnetic effect to buttons
    const buttons = document.querySelectorAll('.btn');

    buttons.forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;

            btn.style.transform = `translateY(-2px) translate(${x * 0.1}px, ${y * 0.1}px)`;
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.transform = '';
        });
    });
});

/* ===== Card Hover Glow Effect ===== */
document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.service-card, .stat-card');

    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });
});

/* ===== Prepzer0 Visual Animation ===== */
document.addEventListener('DOMContentLoaded', () => {
    const visual = document.querySelector('#prepzer0-visual svg');
    if (!visual || typeof gsap === 'undefined') return;

    // Animate orbiting nodes
    const orbitNodes = visual.querySelectorAll('circle:not(:first-child):not(:nth-child(2)):not(:nth-child(3))');

    orbitNodes.forEach((node, i) => {
        gsap.to(node, {
            rotation: 360,
            transformOrigin: '100px 100px',
            duration: 20 + i * 5,
            repeat: -1,
            ease: 'none'
        });
    });

    // Pulse center
    gsap.to(visual.querySelector('circle:nth-child(3)'), {
        scale: 1.1,
        opacity: 0.6,
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        transformOrigin: '100px 100px'
    });
});

/* ==========================================================================
   CUBE SCROLL EFFECT
   3D cube-like transitions - SIDEWAYS rotation
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Check for reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof gsap === 'undefined') return;

    // Get all sections for cube effect
    const sections = document.querySelectorAll('.section, .hero, .footer');

    sections.forEach((section, index) => {
        // Add cube class
        section.classList.add('cube-section');

        // Alternate direction for each section (left/right)
        const direction = index % 2 === 0 ? 1 : -1;

        // Create scroll-triggered 3D SIDEWAYS rotation
        gsap.fromTo(section,
            {
                rotateY: 15 * direction,  // Rotate from side
                x: 100 * direction,       // Slide from side
                z: -80,
                opacity: 0.6,
                transformOrigin: direction > 0 ? 'left center' : 'right center'
            },
            {
                rotateY: 0,
                x: 0,
                z: 0,
                opacity: 1,
                ease: 'power2.out',
                scrollTrigger: {
                    trigger: section,
                    start: 'top 90%',
                    end: 'top 30%',
                    scrub: 1,
                    // Rotate out to opposite side when leaving
                    onLeave: () => {
                        gsap.to(section, {
                            rotateY: -8 * direction,
                            x: -50 * direction,
                            transformOrigin: direction > 0 ? 'right center' : 'left center',
                            duration: 0.4
                        });
                    },
                    onEnterBack: () => {
                        gsap.to(section, {
                            rotateY: 0,
                            x: 0,
                            duration: 0.4
                        });
                    }
                }
            }
        );
    });
});

/* ==========================================================================
   ORGANIC DESIGN TOUCHES
   Make animations feel more human and less AI-generated
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Add subtle random delays to elements for organic feel
    const organicElements = document.querySelectorAll('.service-card, .client-logo, .why-us__item, .stat-card');

    organicElements.forEach((el, i) => {
        // Add slight random rotation for imperfection
        const randomRotate = (Math.random() - 0.5) * 0.5; // -0.25 to 0.25 degrees
        el.style.transform = `rotate(${randomRotate}deg)`;

        // Randomize hover timing
        const randomDuration = 200 + Math.random() * 100; // 200-300ms
        el.style.transitionDuration = `${randomDuration}ms`;
    });

    // Organic floating for hero orbs - varied speeds
    const orbs = document.querySelectorAll('.hero__orb');
    orbs.forEach((orb, i) => {
        const randomDuration = 6 + Math.random() * 6; // 6-12 seconds
        const randomDelay = Math.random() * -8;
        orb.style.animationDuration = `${randomDuration}s`;
        orb.style.animationDelay = `${randomDelay}s`;
    });

    // Add breathing effect to buttons on hover
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            btn.style.animation = 'breathe 2s ease-in-out infinite';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.animation = '';
        });
    });
});

// Add breathing keyframes dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes breathe {
        0%, 100% { transform: scale(1) translateY(-2px); }
        50% { transform: scale(1.02) translateY(-3px); }
    }
`;
document.head.appendChild(style);

/* ===== Parallax depth on mouse move ===== */
document.addEventListener('DOMContentLoaded', () => {
    const hero = document.querySelector('.hero');
    if (!hero) return;

    let mouseX = 0, mouseY = 0;
    let currentX = 0, currentY = 0;

    document.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX / window.innerWidth - 0.5) * 20;
        mouseY = (e.clientY / window.innerHeight - 0.5) * 10;
    });

    // Smooth follow with lerp
    function animateParallax() {
        currentX += (mouseX - currentX) * 0.05;
        currentY += (mouseY - currentY) * 0.05;

        const orbs = document.querySelector('.hero__orbs');
        if (orbs) {
            orbs.style.transform = `translate(${currentX}px, ${currentY}px)`;
        }

        requestAnimationFrame(animateParallax);
    }
    animateParallax();
});
