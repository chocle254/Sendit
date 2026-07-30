import postgres from "postgres";

// Supabase's pooled connection (port 6543, pgbouncer) works well for
// serverless/Next.js API routes. Get the connection string from
// Supabase dashboard -> Project Settings -> Database -> Connection string
// (choose "Transaction" pooling mode) and set it as POSTGRES_URL.
const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error("Missing POSTGRES_URL environment variable (Supabase connection string).");
}

// Reuse a single connection across hot reloads / lambda invocations.
const globalForSql = globalThis;

const sql =
  globalForSql.__sendit_sql ||
  postgres(connectionString, {
    ssl: "require",
    // Supabase's pooler manages its own connection limits; keep this low
    // per serverless function instance.
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    // pgbouncer in transaction mode doesn't support prepared statements.
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForSql.__sendit_sql = sql;
}

export default sql;
