const bcrypt = require('bcrypt');
const { db } = require('./firebase');
const { generateId } = require('./utils');

async function seed() {
  // Skip if already seeded
  const existing = await db.collection('users').where('email', '==', 'alice@example.com').get();
  if (!existing.empty) return;

  console.log('Seeding development data...');

  const passwordHash = await bcrypt.hash('password123', 10);
  const now = new Date().toISOString();

  const alice = { id: generateId(), name: 'Alice (Freelancer)', email: 'alice@example.com', passwordHash, role: 'freelancer', createdAt: now };
  const bob = { id: generateId(), name: 'Bob (Freelancer)', email: 'bob@example.com', passwordHash, role: 'freelancer', createdAt: now };
  const carol = { id: generateId(), name: 'Carol (Client)', email: 'carol@example.com', passwordHash, role: 'client', createdAt: now };

  await db.collection('users').doc(alice.id).set(alice);
  await db.collection('users').doc(bob.id).set(bob);
  await db.collection('users').doc(carol.id).set(carol);

  const gigs = [
    {
      id: generateId(),
      freelancerId: alice.id,
      title: 'Professional Logo Design',
      description: 'I will create a stunning logo for your brand using Adobe Illustrator. Includes 3 concepts, unlimited revisions, and final files in all formats.',
      category: 'design',
      priceUsd: 99,
      deliveryDays: 3,
      status: 'active',
      createdAt: now,
    },
    {
      id: generateId(),
      freelancerId: alice.id,
      title: 'WordPress Website Development',
      description: 'I will build a fully responsive WordPress site with a custom theme, contact form, and SEO basics. Perfect for small businesses.',
      category: 'web',
      priceUsd: 349,
      deliveryDays: 7,
      status: 'active',
      createdAt: now,
    },
    {
      id: generateId(),
      freelancerId: bob.id,
      title: 'SEO Blog Article Writing',
      description: 'I will write a 1000-word SEO-optimised blog post on any topic. Well-researched, plagiarism-free, and delivered in Google Docs format.',
      category: 'writing',
      priceUsd: 45,
      deliveryDays: 2,
      status: 'active',
      createdAt: now,
    },
    {
      id: generateId(),
      freelancerId: bob.id,
      title: 'React Frontend Development',
      description: 'I will build React components and SPA pages with Tailwind CSS. Clean code, responsive design, and full test coverage included.',
      category: 'dev',
      priceUsd: 499,
      deliveryDays: 10,
      status: 'active',
      createdAt: now,
    },
  ];

  const jobs = [
    {
      id: generateId(),
      clientId: carol.id,
      title: 'Mobile App UI Design Needed',
      description: 'Looking for an experienced designer to create Figma mockups for a fitness tracking mobile app. Must include onboarding screens and a dashboard.',
      category: 'design',
      budgetUsd: 250,
      status: 'open',
      createdAt: now,
    },
    {
      id: generateId(),
      clientId: carol.id,
      title: 'Node.js REST API Developer',
      description: 'Need someone to extend our existing Express API with new endpoints, Firestore integration, and Jest tests. Good documentation is a must.',
      category: 'dev',
      budgetUsd: 800,
      status: 'open',
      createdAt: now,
    },
  ];

  for (const gig of gigs) await db.collection('gigs').doc(gig.id).set(gig);
  for (const job of jobs) await db.collection('jobs').doc(job.id).set(job);

  console.log('Seed complete: 3 users, 4 gigs, 2 jobs created.');
  console.log('  alice@example.com  (freelancer) / password123');
  console.log('  bob@example.com    (freelancer) / password123');
  console.log('  carol@example.com  (client)     / password123');
}

module.exports = { seed };
