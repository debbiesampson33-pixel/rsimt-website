'use strict';

const readline = require('readline');
const Database = require('better-sqlite3');
const { Pool } = require('pg');
const path = require('path');

const TABLES = ['students', 'staff', 'results', 'subjects', 'applications', 'student_letters'];
const SQLITE_PATH = path.join(__dirname, 'rsimt.db');
const HOST = 'aws-0-us-east-1.pooler.supabase.com';
const PORT = 6543;
const USER = 'postgres.ezgamadkeahbduborvtj';
const DB_NAME = 'postgres';

function strictEncodeURIComponent(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => '%' + char.charCodeAt(0).toString(16).toUpperCase());
}

function askHidden(question) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    stdout.write(question);

    if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
      const rl = readline.createInterface({ input: stdin, output: stdout });
      rl.question('', (answer) => {
        rl.close();
        resolve(answer);
      });
      return;
    }

    let answer = '';
    const onData = (chunk) => {
      const text = chunk.toString('utf8');
      for (const char of text) {
        if (char === '\u0003') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          stdout.write('\nCancelled.\n');
          reject(new Error('Cancelled by user'));
          return;
        }
        if (char === '\r' || char === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          stdout.write('\n');
          resolve(answer);
          return;
        }
        if (char === '\u0008' || char === '\u007f') {
          answer = answer.slice(0, -1);
        } else {
          answer += char;
        }
      }
    };

    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

function quoteIdentifier(value) {
  // Only simple SQLite column names are allowed here; reject anything unexpected.
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error('Unexpected column name in SQLite database: ' + value);
  return '"' + value + '"';
}

async function main() {
  let connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    const password = (await askHidden('Enter your Supabase database password (input is hidden): ')).trim();
    if (!password) throw new Error('No database password was entered.');
    connectionString = `postgresql://${USER}:${strictEncodeURIComponent(password)}@${HOST}:${PORT}/${DB_NAME}`;
  }

  const fs = require('fs');
  if (!fs.existsSync(SQLITE_PATH)) {
    throw new Error(`Could not find ${SQLITE_PATH}. Put this script beside your original rsimt.db file.`);
  }

  const sqlite = new Database(SQLITE_PATH, { readonly: true, fileMustExist: true });
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 15000
  });
  let client;

  try {
    // Validate connectivity and ensure the intended tables exist before copying anything.
    await pool.query('SELECT 1');
    client = await pool.connect();
    const targetCounts = {};
    for (const table of TABLES) {
      const count = await client.query(`SELECT COUNT(*)::int AS count FROM public.${table}`);
      targetCounts[table] = count.rows[0].count;
    }
    const occupied = Object.entries(targetCounts).filter(([, count]) => count > 0);
    if (occupied.length) {
      throw new Error('Migration stopped for safety because these Supabase tables already contain rows: ' + occupied.map(([table, count]) => `${table} (${count})`).join(', ') + '. No data was copied. Do not delete rows; ask for help to merge safely.');
    }

    const sourceNames = new Set(sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name));
    const missing = TABLES.filter(table => !sourceNames.has(table));
    if (missing.length) throw new Error('Your rsimt.db is missing these expected tables: ' + missing.join(', '));

    const sourceData = {};
    for (const table of TABLES) {
      sourceData[table] = sqlite.prepare(`SELECT * FROM ${table} ORDER BY id ASC`).all();
      console.log(`Found ${sourceData[table].length} rows in local ${table}.`);
    }

    await client.query('BEGIN');
    try {
      let copiedTotal = 0;
      for (const table of TABLES) {
        const rows = sourceData[table];
        for (const row of rows) {
          const columns = Object.keys(row);
          if (!columns.length) continue;
          const quotedColumns = columns.map(quoteIdentifier).join(', ');
          const placeholders = columns.map((_, index) => '$' + (index + 1)).join(', ');
          await client.query(`INSERT INTO public.${table} (${quotedColumns}) VALUES (${placeholders})`, columns.map(column => row[column]));
          copiedTotal += 1;
        }
        console.log(`Copied ${rows.length} rows to Supabase ${table}.`);
      }

      for (const table of TABLES) {
        await client.query(`
          SELECT setval(
            pg_get_serial_sequence('public.${table}', 'id'),
            COALESCE(MAX(id), 1),
            MAX(id) IS NOT NULL
          )
          FROM public.${table}
        `);
      }
      await client.query('COMMIT');
      console.log(`\nSUCCESS: copied ${copiedTotal} total rows to Supabase.`);
      console.log('Your original rsimt.db was opened read-only and was not changed.');
      console.log('Before deploying, verify the row counts in Supabase and keep your backup safe.');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    if (client) client.release();
    sqlite.close();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('\nMIGRATION STOPPED:', error.message);
  process.exitCode = 1;
});
