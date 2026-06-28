/**
 * Earthling Aidtech — single source of truth for site content.
 * Copy is derived from the company brief (app.txt). Update here, not in markup.
 */

export const site = {
  name: 'Earthling Aidtech',
  legalName: 'Earthling Aid Tech Private Limited',
  shortName: 'EarthlingAidTech',
  domain: 'earthlingaidtech.com',
  url: 'https://earthlingaidtech.com',
  tagline: 'Engineering Intelligence. Empowering Humans.',
  description:
    'Earthling Aidtech builds custom software — web apps, automation, desktop tools, and AI agents — plus EdTech platforms, robotics, and hardware products. Prepzer0 runs at SVIT and East Horizon School; 600+ students trained. A product & engineering studio in Bengaluru.',
  email: 'services@earthlingaidtech.com',
  emailAlt: 'earthlingaidtech@gmail.com',
  location: 'Biratnagar, Nepal · Bengaluru, India',
  founded: '2026-05-27',
  registrationNo: '393454/82/83',
  authorizedCapital: 'NPR 500,000',
  paidUpCapital: 'NPR 500,000',
  offices: [
    {
      label: 'Registered office',
      address: 'Biratnagar Metropolitan City-6, Morang, Province No. 1, Nepal',
    },
    {
      label: 'Bengaluru presence',
      address: 'BMSIT BICEP, Bengaluru, Karnataka, India',
    },
  ],
  social: {
    github: 'https://github.com/avinrique',
  },
} as const;

export const leadership = [
  {
    name: 'Abhinav Gupta',
    role: 'Founder & CEO',
    body:
      'Leads product direction, client delivery, and applied AI engineering across Prepzer0, agentic-AI systems, EdTech platforms, and production software.',
  },
  {
    name: 'Sai Kartik Ketha',
    role: 'Co-founder & CTO',
    body:
      'Leads technical architecture, systems engineering, security labs, and hands-on implementation across software, automation, and hardware-backed products.',
  },
] as const;

export const companyProof = [
  { value: '27 May 2026', label: 'Incorporated' },
  { value: site.registrationNo, label: 'Registration no.' },
  { value: site.authorizedCapital, label: 'Authorized capital' },
  { value: site.paidUpCapital, label: 'Paid-up capital' },
] as const;

export type NavLink = { label: string; href: string };

export const nav: NavLink[] = [
  { label: 'Services', href: '/services' },
  { label: 'Products', href: '/products' },
  { label: 'Workshops', href: '/workshops' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

/* ---- Hero stats / proof bar (every number is real, from app.txt) ---- */
export const stats: { value: string; label: string; accent?: string }[] = [
  { value: '600+', label: 'Students trained', accent: 'accent' },
  { value: '6', label: 'Products built', accent: 'teal' },
  { value: '2', label: 'Prepzer0 deployments', accent: 'violet' },
  { value: '8+', label: 'Client partners', accent: 'amber' },
];

/* ---- Capabilities / services ---- */
export type Service = {
  id: string;
  icon: string; // lucide icon name
  accent: 'accent' | 'teal' | 'violet' | 'amber';
  title: string;
  tag: string;
  summary: string;
  points: string[];
};

export const services: Service[] = [
  {
    id: 'software',
    icon: 'code-xml',
    accent: 'accent',
    title: 'Software & Applications',
    tag: 'Web · Mobile · Desktop',
    summary:
      'Custom software for businesses of every size — web apps, mobile apps, desktop tools, and the ERP/CRM systems behind them. MERN on the web, Flutter on mobile, engineered to ship.',
    points: [
      'High-performance web apps (MERN)',
      'Desktop applications & internal tools',
      'Mobile apps (Flutter — iOS & Android)',
      'Custom ERP, CRM, APIs & dashboards',
    ],
  },
  {
    id: 'agentic-ai',
    icon: 'bot',
    accent: 'teal',
    title: 'Agentic AI & Automation',
    tag: 'Applied AI',
    summary:
      'AI agents and automation that take over repetitive work — from business-process scripting to multi-agent systems and RAG pipelines, wired into your real data.',
    points: [
      'Autonomous & multi-agent systems',
      'Business automation & scripting',
      'Retrieval-Augmented Generation (RAG)',
      'Intelligent decision-support tools',
    ],
  },
  {
    id: 'edtech',
    icon: 'graduation-cap',
    accent: 'violet',
    title: 'Education Technology',
    tag: 'EdTech',
    summary:
      'Exam, assessment, and learning platforms built for real institutions — secure delivery, AI-assisted grading, and reporting. It is what powers Prepzer0 and Curio.',
    points: [
      'Secure, scalable examination workflows',
      'AI-assisted monitoring & evaluation',
      'Interactive courseware & custom LMS',
      'Flexible deployment & reporting',
    ],
  },
  {
    id: 'robotics',
    icon: 'cpu',
    accent: 'amber',
    title: 'Robotics & Hardware Products',
    tag: 'Hardware × AI',
    summary:
      'Embedded systems and AI working together in the physical world — from our tablet-faced info robot to PrintFlow, a self-service print kiosk driven entirely from WhatsApp.',
    points: [
      'Robotics & intelligent machines',
      'Product-grade kiosks & vending systems',
      'Microcontroller & SBC systems',
      'Real-time perception & actuation',
    ],
  },
];

/* ---- Products ---- */
export type ProductImage = { src: string; alt: string; width: number; height: number };

export type Product = {
  id: string;
  slug: string;
  name: string;
  kicker: string;
  icon: string;
  accent: 'accent' | 'teal' | 'violet' | 'amber';
  status: string;
  summary: string;
  description: string;
  features: { title: string; body: string }[];
  highlights?: string[];
  /** Live product URL, when one exists. */
  url?: string;
  /** Primary screenshot / hero shot. */
  image?: ProductImage;
  /** Photos of the product in the field. */
  gallery?: ProductImage[];
  /** Short demo / field clip. */
  video?: { src: string; poster?: string };
  /** Listed on /products but kept out of the homepage showcase & footer. */
  lowKey?: boolean;
};

export const products: Product[] = [
  {
    id: 'prepzer0',
    slug: 'prepzer0',
    name: 'Prepzer0',
    kicker: 'AI Examination & Placement Testing Platform',
    icon: 'shield-check',
    accent: 'accent',
    status: 'Flagship · Live',
    summary:
      'Live at SVIT and East Horizon School — secure exam and placement testing with intelligent proctoring and AI-assisted grading.',
    description:
      'Prepzer0 is our flagship EdTech product — an AI-powered examination, assessment, and placement-testing platform for colleges, schools, and organizations. It combines secure exam delivery, intelligent proctoring, AI-assisted evaluation, and rich reporting in one flexible system. It already runs in real classrooms, and has powered a demo placement test at BGS College of Engineering & Technology (BGSCET).',
    features: [
      { title: 'Secure delivery & intelligent proctoring', body: 'Hardened examination workflows with AI-powered activity monitoring, built for high-stakes assessment and recruitment testing.' },
      { title: 'AI-assisted evaluation', body: 'Intelligent grading that cuts manual effort while keeping educators in control — live scores and submission status at a glance.' },
      { title: 'Flexible deployment', body: 'Cloud or on-prem deployment models tailored to each institution.' },
      { title: 'Custom assessment logic', body: 'Configurable scoring, question banks, and detailed analytics & reporting.' },
    ],
    highlights: ['Sai Vidya Institute of Technology (SVIT)', 'East Horizon School'],
    url: 'https://prepzer0.co.in',
    image: {
      src: '/images/products/prepzer0/dashboard.jpg',
      alt: 'Prepzer0 examiner dashboard — live exam candidates with scores, activity status, and submission times',
      width: 1036,
      height: 720,
    },
    gallery: [
      { src: '/images/products/prepzer0/site-home.jpg', alt: 'prepzer0.co.in — Prepare, Practice, Succeed: the live Prepzer0 platform landing page', width: 1440, height: 760 },
      { src: '/images/products/prepzer0/bgs-lab-1.jpg', alt: 'Students taking a Prepzer0 placement test in a computer lab at BGS College of Engineering & Technology', width: 1600, height: 1200 },
      { src: '/images/products/prepzer0/bgs-lab-2.jpg', alt: 'Prepzer0 exam interface running across lab workstations during a campus placement drive', width: 1600, height: 1200 },
      { src: '/images/products/prepzer0/bgs-lab-3.jpg', alt: 'A full lab of candidates working through a Prepzer0 assessment', width: 1600, height: 1200 },
    ],
    video: { src: '/video/prepzer0-campus.mp4', poster: '/video/prepzer0-campus-poster.jpg' },
  },
  {
    id: 'curio',
    slug: 'curio',
    name: 'Curio',
    kicker: 'Interactive Visual Learning Platform',
    icon: 'orbit',
    accent: 'teal',
    status: 'Product · Pre-launch',
    summary:
      'Big ideas, made visible — 13 cinematic, interactive courses with 193+ animated scenes across physics, chemistry, code, and more. 11 live today.',
    description:
      'Curio turns hard subjects into cinematic, hands-on courses. Every concept is animated and built up step by step — then handed to the learner to poke at until it clicks. Thirteen courses span physics, chemistry, programming, biology, electronics, networking, cloud, and algebra, each with its own visual identity and a friendly guide character. Eleven are live and previewable today.',
    features: [
      { title: '13 courses, 193+ animated scenes', body: 'From orbital mechanics to TCP/IP to the Calvin cycle — five-act courses where nothing is a wall of text.' },
      { title: 'Watch it, then break it', body: 'Concepts come alive as animation first, then become interactive: drag sliders, flip switches, break circuits until it clicks.' },
      { title: 'A guide for every course', body: 'Nova, Sparky, Py, Gene and friends — a named character per course reacts as each idea lands, giving every subject its own personality.' },
      { title: 'One simple price', body: 'Buy a course once and keep it, or take the All-Access pass — lifetime access with every future release included.' },
    ],
  },
  {
    id: 'printflow',
    slug: 'printflow',
    name: 'PrintFlow',
    kicker: 'Self-Service Print Kiosk · WhatsApp Ordering',
    icon: 'printer',
    accent: 'violet',
    status: 'Pilot · Hardware',
    summary:
      'A vending machine for printing — send a document on WhatsApp, pick options in chat, and release the job at the kiosk with a 4-digit code.',
    description:
      'PrintFlow turns a print shop or campus corner into a self-service print vending machine, with WhatsApp as the entire interface. Customers send a document to the PrintFlow number, a conversational bot walks them through copies, colour, paper size, sides, and page ranges, and the job waits in a secure cloud queue. At the kiosk, a 4-digit on-screen code releases their prints — documents ordered from anywhere only print when the right person is standing at the machine.',
    features: [
      { title: 'Order from WhatsApp', body: 'No app, no signup — a guided chat flow that accepts 9 file formats including PDF, Office documents, and images.' },
      { title: 'Full print control in chat', body: 'Copies, B&W or colour, A4/A3/Letter, single or double-sided, and page ranges like "1-3,7,10-12" — with the exact price quoted before you confirm.' },
      { title: 'Code-verified pickup', body: 'Jobs are held in a secure queue until the customer relays the kiosk’s 4-digit code — then everything they queued prints in one go.' },
      { title: 'Cloud-backed kiosk', body: 'A cloud print service dispatches to the physical kiosk printer, with live pricing and job tracking by ID straight from the chat.' },
    ],
  },
  {
    id: 'newsletter',
    slug: 'newsletter',
    name: 'Newsletter & Article Creator',
    kicker: 'Automated Content Generation',
    icon: 'newspaper',
    accent: 'teal',
    status: 'Product',
    summary:
      'Polished event and institutional write-ups in minutes — we built it to cover our own workshops.',
    description:
      'An AI-powered newsletter and article creation tool designed for colleges, academic departments, and events — enabling fast, consistent, high-quality content with minimal manual effort.',
    features: [
      { title: 'For institutions', body: 'Purpose-built for colleges, universities, and academic departments.' },
      { title: 'Event-ready', body: 'Spin up polished write-ups for workshops, conferences, and events in minutes.' },
      { title: 'Consistent quality', body: 'On-brand, structured output every time, with minimal manual editing.' },
      { title: 'Fast turnaround', body: 'Generate long-form articles and newsletters at a fraction of the usual effort.' },
    ],
  },
  {
    id: 'ai-robot',
    slug: 'ai-robot',
    name: 'Interactive AI Information Robot',
    kicker: 'Physical AI-Powered Companion System',
    icon: 'bot',
    accent: 'violet',
    status: 'R&D · Hardware',
    summary:
      'A tablet-faced robot with Vector-style eyes that answers questions about your institution.',
    description:
      'A physical hardware robot designed for organizational interaction and information delivery — ideal for institutions, offices, exhibitions, and public-facing environments.',
    features: [
      { title: 'Expressive face', body: 'A tablet-based face with expressive eyes (Vector-style) for natural, friendly interaction.' },
      { title: 'Natural movement', body: 'Side-to-side head movement that makes conversations feel alive.' },
      { title: 'Conversational intelligence', body: 'LLM-powered dialogue that answers questions about the organization.' },
      { title: 'Information delivery', body: 'Explains services, departments, events, and general information on demand.' },
    ],
  },
  {
    id: 'aniview',
    slug: 'aniview',
    name: 'AniView',
    kicker: 'Streaming & Community Platform',
    icon: 'clapperboard',
    accent: 'amber',
    status: 'Live · Lab project',
    summary:
      'Our production-scale lab project — a live streaming platform with multi-source failover, a virtual-currency economy, 3D collectibles, and CI/CD with automatic rollback.',
    description:
      'AniView is where we pressure-test production engineering in the open: a live streaming and community platform serving real users. Under the hood, it aggregates nine data providers with health-tracked automatic failover so a dead source never blanks the screen. On top sits a full gamified layer — virtual currency, collectible characters rendered as interactive 3D models, achievements, daily quizzes, user reels, and per-episode chat — all shipped through a CI/CD pipeline with smoke tests and automatic rollback.',
    features: [
      { title: 'Multi-source failover engine', body: 'Nine upstream providers with health tracking, cooldowns, and cross-provider matching — the player walks the chain automatically when a source fails.' },
      { title: 'Gamified economy & 3D collectibles', body: 'A virtual-currency loop with daily rewards and streaks, plus 26 collectible characters rendered as interactive 3D models in the browser.' },
      { title: 'Community layer', body: 'User reels with moderation, per-episode discussions, ratings, achievements, and a daily quiz that pays out coins.' },
      { title: 'Production-grade operations', body: 'CI/CD with smoke tests and automatic rollback, real-time analytics, and an admin dashboard — running live on AWS.' },
    ],
    url: 'https://aniview.online',
    lowKey: true,
  },
];

/* ---- Curio course catalog (mirrors curio repo src/lib/courses.ts) ---- */
export type CurioCourse = {
  slug: string;
  title: string;
  subject: string;
  guide: string;
  accent: string;
  accent2: string;
  emoji: string;
  scenes: number;
  level: string;
  liveUrl: string | null;
  topics: string[];
};

export const curioCourses: CurioCourse[] = [
  { slug: 'cosmos', title: 'Cosmos', subject: 'Physics', guide: 'Nova', accent: '#4EA8FF', accent2: '#A78BFA', emoji: '🪐', scenes: 16, level: 'Beginner', liveUrl: null, topics: ['Newton’s laws', 'Gravity', 'Orbits', 'Kepler'] },
  { slug: 'volta', title: 'Volta', subject: 'Electronics', guide: 'Sparky', accent: '#38E0D0', accent2: '#36D399', emoji: '⚡', scenes: 13, level: 'Beginner', liveUrl: 'https://volta-blush.vercel.app', topics: ['Voltage & current', 'Components', 'Circuits', 'Logic gates'] },
  { slug: 'prism', title: 'Prism', subject: 'Light & Optics', guide: 'Ray', accent: '#FFD15C', accent2: '#38E0D0', emoji: '🔆', scenes: 13, level: 'Beginner', liveUrl: 'https://prism-delta-gules.vercel.app', topics: ['Reflection', 'Refraction', 'Lenses & the eye', 'Colour'] },
  { slug: 'elementa', title: 'Elementa', subject: 'Chemistry', guide: 'Ato', accent: '#A78BFA', accent2: '#38E0D0', emoji: '⚛️', scenes: 13, level: 'Beginner', liveUrl: 'https://elementa-six.vercel.app', topics: ['Atoms', 'Electron shells', 'Periodic table', 'Bonding'] },
  { slug: 'pyvisual', title: 'PyVisual', subject: 'Python', guide: 'Py', accent: '#4EA8FF', accent2: '#FFD15C', emoji: '🐍', scenes: 13, level: 'Beginner', liveUrl: 'https://pyvisual.vercel.app', topics: ['Variables & types', 'Booleans & logic', 'Loops', 'Lists & functions'] },
  { slug: 'helix', title: 'Helix', subject: 'Genetics', guide: 'Gene', accent: '#A78BFA', accent2: '#38E0D0', emoji: '🧬', scenes: 13, level: 'Beginner', liveUrl: 'https://helix-navy.vercel.app', topics: ['Double helix', 'Replication', 'DNA→RNA→protein', 'Inheritance'] },
  { slug: 'chlora', title: 'Chlora', subject: 'Biology', guide: 'Sprout', accent: '#36D399', accent2: '#FFD15C', emoji: '🌱', scenes: 13, level: 'Beginner', liveUrl: 'https://chlora-opal.vercel.app', topics: ['Leaves & chloroplasts', 'Light reactions', 'Calvin cycle', 'Carbon cycle'] },
  { slug: 'reacta', title: 'Reacta', subject: 'Chemistry II', guide: 'Mol', accent: '#FF8A4C', accent2: '#FFB347', emoji: '⚗️', scenes: 13, level: 'Intermediate', liveUrl: 'https://reacta-tau.vercel.app', topics: ['Stoichiometry', 'Energy', 'Equilibrium', 'Acids & redox'] },
  { slug: 'pulse', title: 'Pulse', subject: 'Human Body', guide: 'Pip', accent: '#FF5C5C', accent2: '#FFB347', emoji: '🫀', scenes: 13, level: 'Beginner', liveUrl: 'https://pulse-delta-olive.vercel.app', topics: ['Cells & systems', 'Heart & blood', 'Lungs & breathing', 'Nerves & immunity'] },
  { slug: 'nimbus', title: 'Nimbus', subject: 'Cloud Computing', guide: 'Nimbus', accent: '#4EA8FF', accent2: '#38E0D0', emoji: '☁️', scenes: 13, level: 'Intermediate', liveUrl: 'https://nimbus-sable.vercel.app', topics: ['Data centers', 'VMs & containers', 'Scaling & CDN', 'Serverless'] },
  { slug: 'relay', title: 'Relay', subject: 'Networking', guide: 'Packet', accent: '#38E0D0', accent2: '#4EA8FF', emoji: '🌐', scenes: 13, level: 'Intermediate', liveUrl: 'https://relay-alpha-five.vercel.app', topics: ['Packets', 'IP & DNS', 'Routing & TCP', 'HTTPS & the web'] },
  { slug: 'axiom', title: 'Axiom', subject: 'Algebra', guide: 'Xan', accent: '#4EA8FF', accent2: '#FFD15C', emoji: '✖️', scenes: 13, level: 'Beginner', liveUrl: 'https://axiom-vert-phi.vercel.app', topics: ['Variables & equations', 'Functions & graphs', 'Slope & systems', 'Quadratics'] },
  { slug: 'cvisual', title: 'CVisual', subject: 'C Programming', guide: 'Bit', accent: '#36D399', accent2: '#FFD15C', emoji: '💻', scenes: 34, level: 'Beginner', liveUrl: null, topics: ['I/O & types', 'Booleans', 'Conditionals', 'Loops'] },
];

/* ---- "How we work" / approach ---- */
export const approach: { step: string; title: string; body: string }[] = [
  { step: '01', title: 'Listen', body: 'We sit with your team and find the real bottleneck — not the feature list. The problem comes first; the technology comes second.' },
  { step: '02', title: 'Build', body: 'We design and engineer in weeks, not quarters — MERN on the web, Flutter on mobile, embedded systems and LLM agents where they fit.' },
  { step: '03', title: 'Ship', body: 'We deploy to production with cloud or on-prem options, then watch how it actually performs with real users.' },
  { step: '04', title: 'Evolve', body: 'R&D never stops. What we ship today feeds the robotics and agentic-AI research we run for tomorrow.' },
];

/* ---- R&D focus areas ---- */
export const rnd: string[] = [
  'Advanced agentic AI systems',
  'Human–machine interaction',
  'Robotics & embedded intelligence',
  'Education-focused AI innovation',
  'Automation frameworks',
];

/* ---- Workshops ----
   NOTE: gallery & video are filled from real WhatsApp media dropped into
   /public/images/workshops and /public/video. The page renders whatever is
   present, so add/remove entries here as the media library grows. */
export type WorkshopTrack = {
  title: string;
  icon: string; // lucide icon name
  accent: 'accent' | 'teal' | 'violet' | 'amber';
  blurb: string;
};

export type Speaker = {
  name: string;
  role: string;
  bio: string;
  focus: string[];
};

export type GalleryItem = { src: string; alt: string; span?: 'wide' | 'tall' };

export const workshops = {
  /* Headline proof — leads on reach & breadth, not venue count. */
  stats: [
    { value: '600+', label: 'Students trained' },
    { value: '7', label: 'Technical tracks' },
    { value: '15+', label: 'Sessions delivered' },
    { value: '100%', label: 'Hands-on, lab-first' },
  ],
  institutions: [
    'BMS Institute of Technology (BMSIT)',
    'Sai Vidya Institute of Technology (SVIT)',
  ],
  /* The 7 tracks the user named. These ARE the headline of the page. */
  tracks: [
    { title: 'Web Development', icon: 'globe', accent: 'accent', blurb: 'Modern full-stack — from responsive frontends to production APIs and deployment.' },
    { title: 'Agentic AI', icon: 'bot', accent: 'teal', blurb: 'Building autonomous agents, LLM tooling, and multi-agent systems on real data.' },
    { title: 'Cloud', icon: 'cloud', accent: 'accent', blurb: 'Cloud-native fundamentals — compute, storage, networking, and scaling apps that ship.' },
    { title: 'DevOps', icon: 'infinity', accent: 'violet', blurb: 'CI/CD pipelines, containers, and infrastructure-as-code the way industry runs it.' },
    { title: 'Ethical Hacking', icon: 'shield-alert', accent: 'amber', blurb: 'Offensive security foundations — recon, exploitation, and defending what you break.' },
    { title: 'Linux', icon: 'terminal', accent: 'teal', blurb: 'Command-line mastery, shell scripting, and the system skills every engineer needs.' },
    { title: 'Blockchain', icon: 'box', accent: 'violet', blurb: 'Smart contracts, decentralized apps, and the fundamentals behind Web3 systems.' },
  ] as WorkshopTrack[],
  speakers: [
    {
      name: 'Abhinav Gupta',
      role: 'Founder & CEO',
      bio: 'Engineer and founder of Earthling Aidtech — builds agentic-AI systems, EdTech platforms, and production software, and brings that same hands-on practice into the classroom.',
      focus: ['Agentic AI', 'Web Development', 'Cloud & DevOps'],
    },
    {
      name: 'Sai Kartik Ketha',
      role: 'Co-founder & CTO',
      bio: 'Leads technical sessions across security and systems — translating real engineering workflows into labs students can actually run and reuse.',
      focus: ['Ethical Hacking', 'Linux', 'Blockchain'],
    },
  ] as Speaker[],
  /* Real photos from our campus sessions (/public/images/workshops). */
  gallery: [
    { src: '/images/workshops/ws-5.jpg', alt: 'Instructors presenting "What is an LLM?" during an agentic AI workshop in a packed computer lab', span: 'tall' },
    { src: '/images/workshops/ws-1.jpg', alt: 'Students working through hands-on coding exercises at their workstations' },
    { src: '/images/workshops/ws-2.jpg', alt: 'An instructor walking the room while students follow along on their machines' },
    { src: '/images/workshops/ws-6.jpg', alt: 'A full lab of students following a live demo on the projector', span: 'tall' },
    { src: '/images/workshops/ws-7.jpg', alt: 'A workshop session in progress — instructor presenting to a full room', span: 'wide' },
    { src: '/images/workshops/ws-3.jpg', alt: 'Students coding along during a lab-first workshop session' },
    { src: '/images/workshops/ws-4.jpg', alt: 'A bright computer lab set up for a hands-on workshop' },
    { src: '/images/workshops/ws-8.jpg', alt: 'Mentors moving table to table while students build', span: 'wide' },
  ] as GalleryItem[],
  /* Highlight reel cut from real session footage (/public/video). */
  video: { src: '/video/workshop-reel.mp4', poster: '/video/workshop-reel-poster.jpg' } as null | { src: string; poster?: string },
} as const;

/* ---- Clients & collaborations (real names; notes only where known) ---- */
export const clients: { name: string; note?: string }[] = [
  { name: 'Woostaa', note: 'Housing solution' },
  { name: 'Curota.ai', note: 'AI data annotation' },
  { name: 'CampusPathway', note: 'Admissions · EdTech' },
  { name: 'OrynConsulting', note: 'Consulting' },
  { name: 'SalesSphere360', note: 'Sales' },
  { name: 'Halde20', note: 'Restaurant · Switzerland' },
  { name: 'Chillaxmandu', note: 'Lifestyle' },
  { name: 'ThePixelSphere', note: 'Studio' },
];

/* ---- Technology stack (real tools we ship with).
   Two marquee rows; icon = simple-icons name (astro-icon `simple-icons:<id>`). ---- */
export type TechItem = { name: string; icon: string };

export const techBuild: TechItem[] = [
  { name: 'React', icon: 'react' },
  { name: 'Next.js', icon: 'nextdotjs' },
  { name: 'Node.js', icon: 'nodedotjs' },
  { name: 'TypeScript', icon: 'typescript' },
  { name: 'Python', icon: 'python' },
  { name: 'Flutter', icon: 'flutter' },
  { name: 'React Native', icon: 'react' },
  { name: 'Express', icon: 'express' },
  { name: 'Astro', icon: 'astro' },
  { name: 'Tailwind CSS', icon: 'tailwindcss' },
  { name: 'Three.js', icon: 'threedotjs' },
];

export const techRun: TechItem[] = [
  { name: 'AWS', icon: 'amazonwebservices' },
  { name: 'Microsoft Azure', icon: 'microsoftazure' },
  { name: 'Vercel', icon: 'vercel' },
  { name: 'MongoDB', icon: 'mongodb' },
  { name: 'PostgreSQL', icon: 'postgresql' },
  { name: 'Docker', icon: 'docker' },
  { name: 'Nginx', icon: 'nginx' },
  { name: 'GitHub Actions', icon: 'githubactions' },
  { name: 'Raspberry Pi', icon: 'raspberrypi' },
  { name: 'Claude', icon: 'claude' },
  { name: 'OpenAI', icon: 'openai' },
  { name: 'Gemini', icon: 'googlegemini' },
  { name: 'Ollama', icon: 'ollama' },
  { name: 'n8n', icon: 'n8n' },
];

/* ---- Why us (every claim grounded in real work) ---- */
export const whyUs: { icon: string; title: string; body: string }[] = [
  { icon: 'layers', title: 'One team, many disciplines', body: 'AI, robotics, and software under one roof — not three separate vendors stitched together.' },
  { icon: 'graduation-cap', title: 'We know education', body: '6 workshops at BMSIT and SVIT, 600+ students trained, and Prepzer0 running in real classrooms.' },
  { icon: 'flask-conical', title: 'R&D in the open', body: 'From Vector-style robot eyes to multi-agent systems, we research tomorrow’s problems and ship the results.' },
  { icon: 'rocket', title: 'Built to ship', body: 'Prepzer0 is live. The info robot works. We measure ourselves in production, not slides.' },
  { icon: 'globe', title: 'Local, delivering globally', body: 'Based in Bengaluru, delivering for clients from India to Halde20 in Switzerland.' },
  { icon: 'shield', title: 'Responsible by default', body: 'Secure, scalable, ethical engineering — the unglamorous parts done right.' },
];
