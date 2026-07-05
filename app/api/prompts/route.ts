/**
 *  This is only serving the prompts from the database to the client. This only for development purposes Not using in the app.
 */

import { NextResponse } from 'next/server';
import { pool } from '../../lib/db';

export async function GET() {
  try {
    const result = await pool.query(
      'SELECT key, name, content FROM prompts ORDER BY key',
    );

    return NextResponse.json({ prompts: result.rows });
  } catch (err) {
    console.error('Failed to fetch prompts:', err);
    return NextResponse.json(
      { error: 'Failed to fetch prompts' },
      { status: 500 },
    );
  }
}
