const { PrismaClient } = require('/opt/aba/node_modules/@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const invoices = await prisma.invoice.findMany({
    select: { id: true, invoiceNumber: true, createdAt: true },
    orderBy: { createdAt: 'asc' }
  });
  console.log('Total:', invoices.length);
  invoices.forEach(i => console.log(i.invoiceNumber, '|', i.createdAt.toISOString().slice(0,10)));
}
main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
