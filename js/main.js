/* ==========================================================================
   EarthlingAidTech - Main JavaScript
   GSAP Animations & Interactions
   ========================================================================== */

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Initialize Hero Animation directly
    initHeroAnimation();

    // Organic touches can stay as they don't depend on scroll
});

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

