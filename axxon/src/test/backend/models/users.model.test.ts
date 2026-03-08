import { beforeEach, describe, expect, it } from 'vitest';

import { Users } from '@/lib/models/users';

import { resetDatabase } from '../db';

describe('Users model', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('finds or creates Google users by email', async () => {
    const first = await Users.findOrCreateByGoogle({
      email: 'google-user@example.com',
      first_name: 'Google',
      last_name: 'User',
      avatar_url: 'https://example.com/avatar.png',
    });
    const second = await Users.findOrCreateByGoogle({
      email: 'google-user@example.com',
      first_name: 'Updated',
      last_name: 'Name',
      avatar_url: 'https://example.com/another-avatar.png',
    });

    expect(second.id).toBe(first.id);
    expect(second.email).toBe(first.email);
  });
});
