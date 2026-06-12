import pkg from "pg";
const { Client } = pkg;

const SOURCE = "postgresql://icode_database_user:E9WWu11xc2oiYTStPaFOG8Y2DCNOSQ36@dpg-d87m4ad7vvec73e2l9g0-a.frankfurt-postgres.render.com:5432/icode_database";
const TARGET = "postgresql://postgres:EnigmaDesign040993@db.qtsgjfrrgtmasewgnjgy.supabase.co:5432/postgres";

// Tables in dependency order (parents before children)
// sequence: reset the SERIAL sequence after copying; null = no sequence (composite PK)
const TABLES = [
  { name: "users",                  sequence: "users_id_seq" },
  { name: "pending_verifications",  sequence: null },
  { name: "password_reset_tokens",  sequence: null },
  { name: "rooms",                  sequence: "rooms_id_seq" },
  { name: "contacts",               sequence: null },
  { name: "room_members",           sequence: null },
  { name: "messages",               sequence: "messages_id_seq" },
  { name: "pinned_messages",        sequence: "pinned_messages_id_seq" },
  { name: "push_subscriptions",     sequence: "push_subscriptions_id_seq" },
];

async function copyTable(source, target, tableName, batchSize = 200) {
  const { rows } = await source.query(`SELECT * FROM "${tableName}"`);

  if (rows.length === 0) {
    console.log(`  (empty)`);
    return 0;
  }

  const cols = Object.keys(rows[0]);
  const colList = cols.map((c) => `"${c}"`).join(", ");
  let inserted = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const placeholders = batch
      .map((_, bi) =>
        `(${cols.map((_, ci) => `$${bi * cols.length + ci + 1}`).join(", ")})`
      )
      .join(", ");
    const values = batch.flatMap((row) => cols.map((c) => row[c] ?? null));

    await target.query(
      `INSERT INTO "${tableName}" (${colList}) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
      values
    );
    inserted += batch.length;
  }

  return inserted;
}

async function resetSequence(target, sequence, tableName) {
  const { rows } = await target.query(
    `SELECT MAX(id) AS max_id FROM "${tableName}"`
  );
  const maxId = rows[0].max_id;
  if (maxId !== null) {
    await target.query(`SELECT setval('${sequence}', $1)`, [maxId]);
    return maxId;
  }
  return 0;
}

async function migrate() {
  const source = new Client({ connectionString: SOURCE, ssl: { rejectUnauthorized: false } });
  const target = new Client({ connectionString: TARGET, ssl: { rejectUnauthorized: false } });

  try {
    process.stdout.write("Connecting to Render (source)... ");
    await source.connect();
    console.log("ok");

    process.stdout.write("Connecting to Supabase (target)... ");
    await target.connect();
    console.log("ok\n");

    let totalInserted = 0;

    for (const { name, sequence } of TABLES) {
      process.stdout.write(`Copying "${name}"... `);
      try {
        const count = await copyTable(source, target, name);
        totalInserted += count;

        if (sequence && count > 0) {
          const maxId = await resetSequence(target, sequence, name);
          console.log(`${count} rows  (sequence → ${maxId})`);
        } else {
          console.log(`${count} rows`);
        }
      } catch (err) {
        console.log(`FAILED — ${err.message}`);
      }
    }

    console.log(`\nAll done — ${totalInserted} total rows migrated.`);
  } finally {
    await source.end().catch(() => {});
    await target.end().catch(() => {});
  }
}

migrate().catch((err) => {
  console.error("\nMigration failed:", err.message);
  process.exit(1);
});
