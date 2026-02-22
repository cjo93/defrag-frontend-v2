import { describe, it, expect } from 'vitest';
import { computeDailyWeather, computeBaselineVector, computeFriction } from './index';

describe('Engine Logic V1', () => {
  const dummyProv = {
    source: "NASA_JPL_HORIZONS" as const,
    horizons_request: {},
    horizons_response_hash: "dummy",
    engine_version: "1.0.0" as const,
  };

  // 10=Sun, 301=Moon, 199=Mercury, 499=Mars, 699=Saturn
  // PAIRS: SUN_MOON(10,301), MERCURY_MARS(199,499), MERCURY_SATURN(199,699), MARS_SATURN(499,699)

  describe('computeDailyWeather', () => {
    it('calculates perfect alignment (max score)', () => {
      // Step with all pairs aligned (sep=0)
      const step = {
        t_utc: "2025-01-01T00:00:00Z",
        lon: {
          "10": 0, "301": 0,   // Sun-Moon: 0 deg -> 1.0 contrib
          "199": 100, "499": 100, // Merc-Mars: 0 deg -> 1.0 contrib
          "699": 100            // Merc-Sat(0), Mars-Sat(0) -> 1.0, 1.0
        }
      };

      const res = computeDailyWeather([step], "2025-01-01", "UTC", dummyProv);

      // Total weighted sum = (1.0 + 1.0 + 1.0 + 1.0) * 0.25 = 1.0
      // Pressure score = 100 * 1.0 = 100
      expect(res.pressure_score).toBe(100);
      expect(res.weather_band).toBe("High Gravity");
      expect(res.max_step?.t_utc).toBe(step.t_utc);
      expect(res.drivers.length).toBe(4); // All pairs contribute >= 0.35
    });

    it('calculates partial alignment', () => {
      // Step with mix
      const step = {
        t_utc: "2025-01-01T00:00:00Z",
        lon: {
          "10": 0, "301": 5,    // Sun-Moon: 5 deg -> 0.70 (<=6)
          "199": 100, "499": 120, // Merc-Mars: 20 deg -> 0.00
          "699": 200            // Merc-Sat(100), Mars-Sat(80) -> 0.0, 0.0
        }
      };

      const res = computeDailyWeather([step], "2025-01-01", "UTC", dummyProv);

      // Sum = (0.70 + 0 + 0 + 0) * 0.25 = 0.175
      // Score = 17.5 -> 18
      expect(res.pressure_score).toBe(18); // round(17.5) = 18 in JS usually, let's check
      expect(res.weather_band).toBe("Clear");
    });

    it('identifies signals correctly', () => {
      // Step triggering specific signals
      const step = {
        t_utc: "2025-01-01T00:00:00Z",
        lon: {
          "10": 0, "301": 1,    // Sun-Moon: 1 deg (<=2) -> 1.0 -> 'emotional_tide'
          "199": 100, "499": 100, // Merc-Mars: 0 -> 1.0 -> 'communication_volatility'
          "699": 100            // Merc-Sat(0) -> 'constraint_load', Mars-Sat(0) -> 'friction_pressure'
        }
      };

      const res = computeDailyWeather([step], "2025-01-01", "UTC", dummyProv);
      const keys = res.signals.map(s => s.key).sort();
      expect(keys).toEqual([
        "communication_volatility",
        "constraint_load",
        "emotional_tide",
        "friction_pressure"
      ]);
    });

    it('throws error on missing body data', () => {
       const step = { t_utc: "now", lon: { "10": 0 } }; // Missing others
       expect(() => computeDailyWeather([step] as any, "date", "UTC", dummyProv)).toThrow(/Missing body data/);
    });
  });

  describe('computeBaselineVector', () => {
    it('extracts separation vector correctly', () => {
      const step = {
        t_utc: "now",
        lon: {
          "10": 0, "301": 90,   // Sun-Moon: 90
          "199": 0, "499": 180, // Merc-Mars: 180
          "699": 270            // Merc-Sat(270->90), Mars-Sat(90)
        }
      };
      // Pairs:
      // SUN_MOON: abs(0-90)=90
      // MERCURY_MARS: abs(0-180)=180
      // MERCURY_SATURN: abs(0-270)=270 -> 360-270=90
      // MARS_SATURN: abs(180-270)=90

      const res = computeBaselineVector(step, dummyProv);
      expect(res.baseline_vector).toEqual([90, 180, 90, 90]);
    });
  });

  describe('computeFriction', () => {
    it('calculates friction score correctly', () => {
      // Mock Daily Output with known component
      const daily = {
        max_step: { weighted_sum: 0.5 }, // Daily component = 0.5
        drivers: []
      } as any;

      // User Vector: [0, 0, 0, 0]
      // Conn Vector: [180, 180, 180, 180]
      // Mean Diff = 180
      // Baseline Distance = 180 / 180 = 1.0

      // Friction = 0.6 * 0.5 + 0.4 * 1.0 = 0.3 + 0.4 = 0.7
      // Score = 70

      const res = computeFriction(daily, [0,0,0,0], [180,180,180,180], dummyProv);
      expect(res.friction_score).toBe(70);
      expect(res.baseline_distance).toBe(1.0);
    });

    it('handles identical vectors (zero friction from baseline)', () => {
      const daily = {
        max_step: { weighted_sum: 0.0 },
        drivers: []
      } as any;

      const vec = [10, 20, 30, 40];
      const res = computeFriction(daily, vec, vec, dummyProv);

      // Baseline dist = 0
      // Daily = 0
      expect(res.friction_score).toBe(0);
    });
  });
});
