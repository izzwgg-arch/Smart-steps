const { PrismaClient } = require('/opt/aba/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const invoices = await prisma.invoice.findMany({
    select: { id: true, invoiceNumber: true },
    orderBy: { createdAt: 'asc' }
  });

  // Pass 1: move to tmp to avoid unique constraint collisions
  for (const inv of invoices) {
    await prisma.invoice.update({
      where: { id: inv.id },
      data: { invoiceNumber: 'tmp_' + inv.id }
    });
  }

  // Pass 2: assign real new numbers (strip INV- prefix)
  for (const inv of invoices) {
    const newNumber = inv.invoiceNumber.replace(/^INV-/, '');
    await prisma.invoice.update({
      where: { id: inv.id },
      data: { invoiceNumber: newNumber }
    });
    console.log('OK:', inv.invoiceNumber, '->', newNumber);
  }

  console.log('\nDone. Updated', invoices.length, 'invoices.');
  console.log('Next new invoice will be: 202604-0215');
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
