"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PaywallModal({
  onBypass,
  isUnlocked,
}: {
  onBypass: (code: string) => void;
  isUnlocked: boolean;
}) {
  const router = useRouter();
  const [bypassCode, setBypassCode] = useState("");
  const [loading, setLoading] = useState(false);

  // If already unlocked, don't show the modal
  if (isUnlocked) return null;

  const handleBypassCheck = () => {
    // Only verify if code matches the env variable
    if (process.env.NEXT_PUBLIC_BYPASS_CODE && bypassCode === process.env.NEXT_PUBLIC_BYPASS_CODE) {
      onBypass(bypassCode);
    } else {
      alert("Invalid Code");
    }
  };

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "os" }),
      });
      const data = await res.json();
      if (data.url) router.push(data.url);
    } catch (e) {
      console.error(e);
      alert("Upgrade failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      backgroundColor: "rgba(0,0,0,0.9)",
      backdropFilter: "blur(10px)",
      display: "grid",
      placeItems: "center",
      zIndex: 1000
    }}>
      <div style={{
        border: "1px solid #333",
        backgroundColor: "#000",
        padding: "3rem",
        maxWidth: "500px",
        width: "90%",
        textAlign: "center",
        boxShadow: "0 0 50px rgba(0,0,0,0.8)"
      }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "2rem", marginBottom: "1.5rem", color: "#FFF" }}>
          Unlock The OS
        </h2>
        <p style={{ color: "#AAA", marginBottom: "2rem", lineHeight: "1.6" }}>
          Family Alignment, Daily Frags, and Interaction Dynamics are exclusive to Defrag OS members.
        </p>

        <button
          onClick={handleUpgrade}
          disabled={loading}
          style={{
            backgroundColor: "#FFF",
            color: "#000",
            border: "none",
            padding: "1rem 2rem",
            fontWeight: 600,
            cursor: loading ? "wait" : "pointer",
            width: "100%",
            marginBottom: "2rem",
            opacity: loading ? 0.7 : 1,
            transition: "opacity 0.2s"
          }}
        >
          {loading ? "PROCESSING..." : "UPGRADE (2/MO)"}
        </button>

        <div style={{ borderTop: "1px solid #222", paddingTop: "1.5rem", textAlign: "left" }}>
          <p style={{ fontSize: "0.75rem", color: "#444", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "1px" }}>Internal Bypass</p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="password"
              placeholder="Enter Code"
              value={bypassCode}
              onChange={(e) => setBypassCode(e.target.value)}
              style={{
                flex: 1,
                background: "#111",
                border: "1px solid #333",
                color: "#FFF",
                padding: "0.75rem",
                fontSize: "0.9rem",
                outline: "none"
              }}
            />
            <button
              onClick={handleBypassCheck}
              style={{
                background: "#333",
                color: "#FFF",
                border: "none",
                padding: "0 1.5rem",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: 600
              }}
            >
              VERIFY
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
