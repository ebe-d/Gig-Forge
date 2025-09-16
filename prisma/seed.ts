import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
// Upsert users
const freelancer = await prisma.user.upsert({
where: { email: "freelancer@gigforge.dev" },
update: {},
create: {
email: "freelancer@gigforge.dev",
role: Role.FREELANCER,
profile: {
create: {
username: "freelancer_demo",
name: "Freelancer Demo",
bio: "Design + Frontend specialist",
skills: ["design", "figma", "react", "nextjs"],
languages: ["en"],
},
},
wallet: {
create: {
balance: "0",
locked: "0",
},
},
},
});

const client = await prisma.user.upsert({
where: { email: "client@gigforge.dev" },
update: {},
create: {
email: "client@gigforge.dev",
role: Role.CLIENT,
profile: {
create: {
username: "client_demo",
name: "Client Demo",
bio: "Building a product, need hands!",
languages: ["en"],
},
},
wallet: {
create: {
balance: "0",
locked: "0",
},
},
},
});

// Create a sample gig
const gig = await prisma.gig.upsert({
where: { slug: "pro-logo-design" },
update: {},
create: {
sellerId: freelancer.id,
title: "I will design a professional logo",
slug: "pro-logo-design",
description: "Clean, modern logo with 3 concepts and 2 revisions.",
price: "150.00",
deliveryDays: 5,
revisions: 2,
tags: ["logo", "branding", "design"],
category: "Design",
images: [],
thumbnailUrl: null,
},
});

// Create a sample request (Upwork-style)
const request = await prisma.request.create({
data: {
clientId: client.id,
title: "Landing page redesign",
description: "Hero section, pricing, testimonials. Figma preferred.",
budgetMin: "300.00",
budgetMax: "600.00",
deadline: null,
tags: ["landing", "figma", "react"],
category: "Web",
},
});

// Proposal from the freelancer to the request
await prisma.proposal.create({
data: {
id:"43",
requestId: request.id,
freelancerId: freelancer.id,
coverLetter: "I can deliver a conversion-focused design with clean components.",
amount: "500.00",
estimatedDays: 7,
},
});

console.log("Seed complete:");
console.log({ freelancer: freelancer.email, client: client.email, gig: gig.slug, request: request.title });
}

main()
.catch((e) => {
console.error(e);
process.exit(1);
})
.finally(async () => {
await prisma.$disconnect();
});