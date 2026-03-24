import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  // Store challenges with their stellar address to validate later if needed,
  // or just store the nonce/challenge string itself.
  // We'll store: challenge -> expiration time (timestamp in ms)
  private challengeCache = new Map<string, number>();
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes

  generateChallenge(stellar_address: string): string {
    const timestamp = Date.now();
    const random = randomBytes(16).toString('hex');
    const challenge = `InsightArena:nonce:${timestamp}:${random}:${stellar_address}`;

    // Store the challenge with its expiration time
    this.challengeCache.set(challenge, timestamp + this.TTL_MS);

    // Clean up expired challenges randomly or periodically.
    // A simple clean up on each generation prevents unbounded memory growth.
    this.cleanupExpiredChallenges();

    return challenge;
  }

  isValidChallenge(challenge: string): boolean {
    const expiresAt = this.challengeCache.get(challenge);
    if (!expiresAt) {
      return false; // Not found
    }

    if (Date.now() > expiresAt) {
      // Challenge expired
      this.challengeCache.delete(challenge);
      return false;
    }

    return true;
  }

  removeChallenge(challenge: string): void {
    this.challengeCache.delete(challenge);
  }

  private cleanupExpiredChallenges() {
    const now = Date.now();
    for (const [key, expiresAt] of this.challengeCache.entries()) {
      if (now > expiresAt) {
        this.challengeCache.delete(key);
      }
    }
  }
}
