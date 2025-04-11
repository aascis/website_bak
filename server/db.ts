import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../shared/schema";

// Your existing Zammad database connection
const connectionString = "postgresql://zammad:zammad@172.24.57.66:5432/zammad_production";

console.log('Using database connection string (partial):', 
  connectionString.substring(0, connectionString.indexOf('@') + 1) + '****');

// Create postgres client
const pgClient = postgres(connectionString, { max: 1 });
console.log('Postgres client created');

// Export both client and db
export const client = pgClient;
export const db = drizzle(client, { schema });