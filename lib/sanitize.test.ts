import { describe, it, expect } from 'vitest';
import { violatesDisclosure } from './sanitize';

describe('violatesDisclosure', () => {
  it('returns false for safe text', () => {
    expect(violatesDisclosure('Hello world')).toBe(false);
    expect(violatesDisclosure('This is a safe sentence.')).toBe(false);
    expect(violatesDisclosure('Just some normal conversation.')).toBe(false);
  });

  it('returns true for exact blocklist matches', () => {
    expect(violatesDisclosure('algorithm')).toBe(true);
    expect(violatesDisclosure('astrology')).toBe(true);
    expect(violatesDisclosure('chakra')).toBe(true);
    expect(violatesDisclosure('system prompt')).toBe(true);
  });

  it('returns true for case-insensitive matches', () => {
    expect(violatesDisclosure('Algorithm')).toBe(true);
    expect(violatesDisclosure('ASTROLOGY')).toBe(true);
    expect(violatesDisclosure('System Prompt')).toBe(true);
  });

  it('returns true for substrings and embedded words', () => {
    expect(violatesDisclosure('Check the algorithm logic')).toBe(true);
    expect(violatesDisclosure('This is a calculated risk')).toBe(true);
    expect(violatesDisclosure('Your score is high')).toBe(true);
    expect(violatesDisclosure('Do not mention the prompt')).toBe(true);
  });

  it('handles edge cases', () => {
    expect(violatesDisclosure('')).toBe(false);
    expect(violatesDisclosure('   ')).toBe(false);
    expect(violatesDisclosure('!!!')).toBe(false);
    expect(violatesDisclosure('12345')).toBe(false);
  });
});
