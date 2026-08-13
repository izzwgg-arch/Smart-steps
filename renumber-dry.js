const { PrismaClient } = require('/opt/aba/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const invoices = await prisma.invoice.findMany({
    select: { id: true, invoiceNumber: true, createdAt: true },
    orderBy: { createdAt: 'asc' }
  });

  console.log('=== DRY RUN ? old -> new ===');
  const updates = [];
  for (const inv of invoices) {
    // Strip INV- prefix if present; keep everything else
    const newNumber = inv.invoiceNumber.replace(/^INV-/, '');
    updates.push({ id: inv.id, oldNumber: inv.invoiceNumber, newNumber });
    console.log(inv.invoiceNumber, '->', newNumber);
  }
  console.log('\nTotal to update:', updates.length);
  console.log('New invoices will start at: 202604-0215 (floor=214)');
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
