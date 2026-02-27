'use server';

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'This authentication endpoint has been disabled. Use Google OAuth instead.' },
    { status: 410 }
  );
}
