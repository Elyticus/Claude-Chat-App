import bcrypt from "bcryptjs";

// eslint-disable-next-line no-undef
const PASSWORD = process.argv[2];
if (!PASSWORD) {
  console.error("Usage: node scripts/generate-hash.js <password>");
  // eslint-disable-next-line no-undef
  process.exit(1);
}

const hash = await bcrypt.hash(PASSWORD, 10);
console.log(hash);
