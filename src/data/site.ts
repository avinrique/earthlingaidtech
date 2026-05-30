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
    'Earthling Aidtech builds intelligent systems across EdTech, agentic AI, robotics, and software — products and platforms engineered for real-world impact.',
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

/* ---- Hero stats / proof bar ---- */
export const stats: { value: string; label: string; accent?: string }[] = [
  { value: '600+', label: 'Students trained', accent: 'accent' },
  { value: '6', label: 'Workshops delivered', accent: 'teal' },
  { value: '6+', label: 'Clients & collaborations', accent: 'violet' },
  { value: '3', label: 'Products shipped', accent: 'amber' },
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
      'Modern education platforms that address real institutional needs — from secure assessments to custom learning systems.',
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
      'Autonomous systems that reason, decide, and execute — reducing manual effort and scaling intelligent operations.',
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
      'Hardware–software integrated systems combining embedded engineering with real-time perception and control.',
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
      'High-quality digital products engineered for performance, security, and scale across web, mobile, and desktop.',
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
    status: 'Flagship · Deployed',
    summary:
      'A scalable, secure, and intelligent assessment platform built for modern educational environments.',
    description:
      'Prepzer0 is our flagship EdTech product — an AI-powered examination and assessment platform for colleges, schools, and organizations. It brings secure exam delivery, AI-assisted evaluation, and rich reporting into one flexible system.',
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
      'AI-powered newsletter and article creation for institutions, departments, and events.',
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
      'A physical, LLM-powered robot for organizational interaction and information delivery.',
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
  { step: '01', title: 'Understand', body: 'We start with the real institutional or business problem — not the technology — and define what success looks like.' },
  { step: '02', title: 'Engineer', body: 'We design and build practical, future-ready systems across software, AI, and hardware, grounded in solid engineering.' },
  { step: '03', title: 'Deploy', body: 'We ship to production with flexible deployment, then measure real-world impact for institutions and enterprises.' },
  { step: '04', title: 'Evolve', body: 'Continuous R&D keeps every product research-driven and ready for what comes next.' },
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
    'Automation & Scripting',
    'Robotics & Embedded Systems',
  ],
} as const;

/* ---- Clients & collaborations ---- */
export const clients: { name: string; note?: string }[] = [
  { name: 'Woostaa' },
  { name: 'OrynConsulting' },
  { name: 'SalesSphere360' },
  { name: 'Halde20', note: 'Switzerland' },
  { name: 'Chillaxmandu' },
  { name: 'ThePixelSphere' },
];

/* ---- Why us ---- */
export const whyUs: { icon: string; title: string; body: string }[] = [
  { icon: 'layers', title: 'Multidisciplinary', body: 'Expertise spanning AI, software, and hardware under one roof.' },
  { icon: 'graduation-cap', title: 'Education-first', body: 'A strong focus on education and applied intelligence.' },
  { icon: 'flask-conical', title: 'R&D-driven', body: 'A product-first mindset with deep research integration.' },
  { icon: 'shield', title: 'Responsible', body: 'Scalable, ethical, and future-oriented systems by design.' },
  { icon: 'rocket', title: 'Proven', body: 'Execution delivered across institutions and clients.' },
  { icon: 'globe', title: 'Real impact', body: 'Solutions that work in the real world, not just on slides.' },
];
