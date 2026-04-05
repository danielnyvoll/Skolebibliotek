import postgres from 'postgres';
import { env } from '$env/dynamic/private';

const databaseUrl = env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is missing');

const sql = postgres(databaseUrl, {
  ssl: 'require',
  prepare: false, // required for Supabase transaction pooler (port 6543)
  max: 5
});

export default sql;