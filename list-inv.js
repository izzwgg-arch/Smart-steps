const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://aba_user:abapass123@127.0.0.1:5432/aba_db' });
async function main() {
  await client.connect();
  const res = await client.query('SELECT "invoiceNumber", "createdAt" FROM aplus_sched."Invoice" ORDER BY "createdAt" ASC');
  console.log('Total:', res.rows.length);
  res.rows.forEach(r => console.log(r.invoiceNumber, '|', r.createdAt));
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
