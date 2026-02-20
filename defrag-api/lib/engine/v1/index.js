"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeDailyWeather = computeDailyWeather;
exports.computeBaselineVector = computeBaselineVector;
exports.computeFriction = computeFriction;
const PAIRS = [
    { name: "SUN_MOON", a: "10", b: "301" },
    { name: "MERCURY_MARS", a: "199", b: "499" },
    { name: "MERCURY_SATURN", a: "199", b: "699" },
    { name: "MARS_SATURN", a: "499", b: "699" },
];
const WEIGHT = 0.25;
function sepDeg(a, b) {
    let d = Math.abs(a - b) % 360;
    if (d > 180)
        d = 360 - d;
    return d;
}
function contrib(sep) {
    if (sep <= 2)
        return 1.00;
    if (sep <= 6)
        return 0.70;
    if (sep <= 10)
        return 0.35;
    return 0.00;
}
function computeDailyWeather(steps, dateLocal, timezone, provBase) {
    let maxWeightedSum = -1;
    let maxStep = null;
    let bestStepContributions = [];
    for (const step of steps) {
        let weightedSum = 0;
        const contributions = [];
        for (const p of PAIRS) {
            const lonA = step.lon[p.a];
            const lonB = step.lon[p.b];
            if (lonA === undefined || lonB === undefined) {
                throw new Error(`Missing body data for pair ${p.name} at ${step.t_utc}`);
            }
            const s = sepDeg(lonA, lonB);
            const c = contrib(s);
            weightedSum += c * WEIGHT;
            contributions.push({ pair: p.name, c, sep_deg: s });
        }
        if (weightedSum > maxWeightedSum) {
            maxWeightedSum = weightedSum;
            maxStep = { t_utc: step.t_utc, weighted_sum: weightedSum };
            bestStepContributions = contributions;
        }
    }
    if (!maxStep) {
        throw new Error("No steps provided for daily weather computation");
    }
    const pressure_score = Math.round(100 * maxWeightedSum);
    let weather_band = "Clear";
    if (pressure_score >= 70)
        weather_band = "High Gravity";
    else if (pressure_score >= 40)
        weather_band = "Load";
    const signals = [];
    const drivers = [];
    bestStepContributions.forEach(item => {
        // Signals Logic (V1 Locked)
        if (item.pair === "MERCURY_MARS" && item.c >= 0.70)
            signals.push({ key: "communication_volatility", strength: item.c });
        if (item.pair === "MERCURY_SATURN" && item.c >= 0.70)
            signals.push({ key: "constraint_load", strength: item.c });
        if (item.pair === "SUN_MOON" && item.c >= 0.70)
            signals.push({ key: "emotional_tide", strength: item.c });
        if (item.pair === "MARS_SATURN" && item.c >= 0.70)
            signals.push({ key: "friction_pressure", strength: item.c });
        // Drivers Logic (c >= 0.35)
        if (item.c >= 0.35) {
            drivers.push(item);
        }
    });
    return {
        date_local: dateLocal,
        timezone,
        pressure_score,
        weather_band,
        signals,
        drivers,
        max_step: maxStep,
        provenance: {
            ...provBase,
            computed_at_utc: new Date().toISOString(),
        },
    };
}
function computeBaselineVector(step, provBase) {
    const vector = [];
    for (const p of PAIRS) {
        const lonA = step.lon[p.a];
        const lonB = step.lon[p.b];
        if (lonA === undefined || lonB === undefined) {
            throw new Error(`Missing body data for pair ${p.name} at ${step.t_utc}`);
        }
        const s = sepDeg(lonA, lonB);
        vector.push(s);
    }
    return {
        baseline_vector: vector,
        provenance: {
            ...provBase,
            computed_at_utc: new Date().toISOString(),
        },
    };
}
function computeFriction(dailyWeather, userVector, connVector, provBase) {
    const daily_component = dailyWeather.max_step.weighted_sum;
    // baseline distance [0, 1]
    // V1 Spec: mean(abs(U_i - C_i)) / 180
    let sumDiff = 0;
    if (userVector.length !== 4 || connVector.length !== 4)
        throw new Error("Invalid baseline vector length");
    for (let i = 0; i < 4; i++) {
        sumDiff += Math.abs(userVector[i] - connVector[i]);
    }
    const meanDiff = sumDiff / 4;
    const baseline_distance = meanDiff / 180;
    // Formula: 0.6 * daily + 0.4 * baseline
    const friction_raw = 0.6 * daily_component + 0.4 * baseline_distance;
    const friction_score = Math.round(100 * friction_raw);
    return {
        friction_score,
        baseline_distance,
        daily_component,
        drivers: dailyWeather.drivers,
        provenance: {
            ...provBase,
            computed_at_utc: new Date().toISOString(),
        },
    };
}
