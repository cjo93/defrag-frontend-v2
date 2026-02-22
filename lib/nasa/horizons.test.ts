import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchHorizonsEphemeris } from './horizons';

describe('fetchHorizonsEphemeris', () => {
  let fetchSpy: any;

  beforeEach(() => {
    // Spy on the global fetch
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and parses data correctly', async () => {
    const mockResponseText = [
      "HEADER",
      "$$SOE",
      "2025-Jan-01 00:00, 100.00000, 10.00000",
      "2025-Jan-01 01:00, 101.00000, 11.00000",
      "$$EOE",
      "FOOTER"
    ].join("\n");

    // Mock successful response for all calls
    fetchSpy.mockResolvedValue({
      ok: true,
      text: async () => mockResponseText,
    });

    const params = {
      startUtc: '2025-01-01',
      stopUtc: '2025-01-02',
      step: '60m'
    };

    const result = await fetchHorizonsEphemeris(params);

    expect(fetchSpy).toHaveBeenCalledTimes(5);

    // Check for Sun (10)
    expect(result.parsed).toHaveProperty('10');
    expect(result.parsed['10']).toHaveLength(2);
    expect(result.parsed['10'][0]).toEqual({
      date: '2025-Jan-01 00:00',
      lon: 100.0,
      lat: 10.0
    });

    expect(result.rawHash).toBeDefined();
    expect(result.rawText).toContain('--BODY 10--');
  });

  it('throws on API error', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error"
    });

    const params = { startUtc: 'now', stopUtc: 'later', step: '1h' };

    await expect(fetchHorizonsEphemeris(params)).rejects.toThrow(/Horizons API HTTP 500/);
  });

  it('throws on invalid response format (missing markers)', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      text: async () => "Invalid Content without SOE marker"
    });

    const params = { startUtc: 'now', stopUtc: 'later', step: '1h' };

    await expect(fetchHorizonsEphemeris(params)).rejects.toThrow(/Horizons API invalid response/);
  });
});
