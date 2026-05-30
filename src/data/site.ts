/**
 * Earthling Aidtech — single source of truth for site content.
 * Copy is derived from the company brief (app.txt). Update here, not in markup.
 */

export const site = {
  name: 'Earthling Aidtech',
  legalName: 'Earthling Aidtech Private Limited',
  shortName: 'EarthlingAidTech',
  domain: 'earthlingaidtech.com',
  url: 'https://earthlingaidtech.com',
  tagline: 'Engineering Intelligence. Empowering Humans.',
  description:
    'Earthling Aidtech builds EdTech platforms, agentic AI systems, robotics, and web & mobile apps. Prepzer0 runs at SVIT and East Horizon School; 600+ students trained. A product & engineering studio in Bengaluru.',
  email: 'services@earthlingaidtech.com',
  emailAlt: 'earthlingaidtech@gmail.com',
  location: 'Bengaluru, India',
  founded: '2026',
  social: {
    github: 'https://github.com/avinrique',
  },
} as const;

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
  { value: '6', label: 'Workshops led', accent: 'teal' },
  { value: '2', label: 'Prepzer0 deployments', accent: 'violet' },
  { value: '6', label: 'Client partners', accent: 'amber' },
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
    id: 'edtech',
    icon: 'graduation-cap',
    accent: 'accent',
    title: 'Education Technology',
    tag: 'EdTech',
    summary:
      'Exam and assessment platforms built for real institutions — secure delivery, AI-assisted grading, and reporting. It is what powers Prepzer0.',
    points: [
      'Secure, scalable examination workflows',
      'AI-assisted monitoring & evaluation',
      'Custom LMS for institutions',
      'Flexible deployment & reporting',
    ],
  },
  {
    id: 'agentic-ai',
    icon: 'bot',
    accent: 'teal',
    title: 'Agentic AI & Automation',
    tag: 'Applied AI',
    summary:
      'LLM-powered agents that take over repetitive work — multi-agent systems, RAG pipelines, and decision support, wired into your real data.',
    points: [
      'Autonomous & multi-agent systems',
      'LLM-powered automation pipelines',
      'Retrieval-Augmented Generation (RAG)',
      'Intelligent decision-support tools',
    ],
  },
  {
    id: 'robotics',
    icon: 'cpu',
    accent: 'violet',
    title: 'Robotics & Embedded',
    tag: 'Hardware × AI',
    summary:
      'Embedded systems and AI working together in the physical world — sensors, real-time control, and machines like our tablet-faced info robot.',
    points: [
      'Robotics & intelligent machines',
      'Microcontroller & SBC systems',
      'Sensor-based smart systems',
      'Real-time perception & actuation',
    ],
  },
  {
    id: 'software',
    icon: 'code-xml',
    accent: 'amber',
    title: 'Software & Applications',
    tag: 'Enterprise & Consumer',
    summary:
      'ERP, CRM, web, and mobile apps engineered to ship — MERN on the web, Flutter on mobile, with the APIs and dashboards behind them.',
    points: [
      'Custom ERP & CRM systems',
      'High-performance web apps (MERN)',
      'Mobile apps (Flutter — iOS & Android)',
      'Desktop software, APIs & dashboards',
    ],
  },
];

/* ---- Products ---- */
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
};

export const products: Product[] = [
  {
    id: 'prepzer0',
    slug: 'prepzer0',
    name: 'Prepzer0',
    kicker: 'AI Examination & Assessment Platform',
    icon: 'shield-check',
    accent: 'accent',
    status: 'Flagship · Live',
    summary:
      'Live at SVIT and East Horizon School — secure exam delivery with AI-assisted grading and reporting.',
    description:
      'Prepzer0 is our flagship EdTech product — an AI-powered examination and assessment platform for colleges, schools, and organizations. It brings secure exam delivery, AI-assisted evaluation, and rich reporting into one flexible system, and it already runs in real classrooms.',
    features: [
      { title: 'Secure exam delivery', body: 'Hardened, scalable examination workflows built for high-stakes assessment.' },
      { title: 'AI-assisted evaluation', body: 'Intelligent monitoring and grading that cut manual effort while keeping educators in control.' },
      { title: 'Flexible deployment', body: 'Cloud or on-prem deployment models tailored to each institution.' },
      { title: 'Custom assessment logic', body: 'Configurable scoring, question banks, and detailed analytics & reporting.' },
    ],
    highlights: ['Sai Vidya Institute of Technology (SVIT)', 'East Horizon School'],
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

/* ---- Workshops ---- */
export const workshops = {
  stats: [
    { value: '6', label: 'Workshops conducted' },
    { value: '600+', label: 'Students trained' },
    { value: '2', label: 'Partner institutions' },
  ],
  institutions: ['BMS Institute of Technology (BMSIT)', 'Sai Vidya Institute of Technology (SVIT)'],
  domains: [
    'Web Development',
    'Application Development',
    'Artificial Intelligence & Agentic AI',
    'Automation and scripting',
    'Robotics & Embedded Systems',
  ],
} as const;

/* ---- Clients & collaborations (real names from app.txt; notes only where known) ---- */
export const clients: { name: string; note?: string }[] = [
  { name: 'Woostaa' },
  { name: 'OrynConsulting', note: 'Consulting' },
  { name: 'SalesSphere360', note: 'Sales' },
  { name: 'Halde20', note: 'Restaurant · Switzerland' },
  { name: 'Chillaxmandu' },
  { name: 'ThePixelSphere', note: 'Studio' },
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
