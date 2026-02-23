"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function AlignPage() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ name: string; relationship_type: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Form State
  const [dob, setDob] = useState("");
  const [time, setTime] = useState("");
  const [city, setCity] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`/api/connections/public/${token}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) {
          setError(json.error);
        } else {
          setData(json);
        }
      })
      .catch((err) => {
        console.error(err);
        setError("NETWORK_ERROR");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/connections/public/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dob: dob,
          birth_time: time || null,
          birth_city: city || null,
        }),
      });

      if (!res.ok) throw new Error("Submission failed");
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError("SUBMISSION_ERROR");
    } finally {
      setLoading(false);
    }
  };

  // 1. Loading State
  if (loading && !submitted) {
    return (
      <div style={{ backgroundColor: "#000", color: "#FFF", minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <div style={{ width: "12px", height: "12px", backgroundColor: "#FFF", borderRadius: "50%", animation: "pulse 1.5s infinite" }} />
        <style jsx>{`
          @keyframes pulse {
            0% { opacity: 0.3; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1.2); }
            100% { opacity: 0.3; transform: scale(0.8); }
          }
        `}</style>
      </div>
    );
  }

  // 2. Error State (Invalid/Expired Link)
  if (error || !data) {
    return (
      <div style={{ backgroundColor: "#000", color: "#FFF", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "2rem", textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "2rem", marginBottom: "1rem" }}>
          Link Expired
        </h1>
        <p style={{ color: "#666", maxWidth: "400px" }}>
          This alignment request is no longer valid or has already been completed. Please ask the sender for a new link.
        </p>
      </div>
    );
  }

  // 3. Success State
  if (submitted) {
    return (
      <div style={{ backgroundColor: "#000", color: "#FFF", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "2rem", textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "2.5rem", marginBottom: "1.5rem" }}>
          Aligned.
        </h1>
        <p style={{ color: "#888", maxWidth: "400px", margin: "0 auto 3rem", lineHeight: "1.6" }}>
          Your natural design has been successfully mapped to <strong>{data.name}</strong>’s family system.
        </p>
        <button
          onClick={() => router.push("/")}
          style={{
            backgroundColor: "#FFF",
            color: "#000",
            border: "none",
            padding: "1rem 3rem",
            fontWeight: 600,
            cursor: "pointer",
            letterSpacing: "0.5px"
          }}
        >
          CLOSE
        </button>
      </div>
    );
  }

  // 4. Form State
  return (
    <div style={{ backgroundColor: "#000", color: "#FFF", minHeight: "100vh", display: "flex", flexDirection: "column", padding: "2rem" }}>
      <header style={{ marginTop: "4rem", marginBottom: "3rem", maxWidth: "600px", marginLeft: "auto", marginRight: "auto", width: "100%" }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "2.5rem", marginBottom: "1.5rem" }}>
          Family Alignment
        </h1>
        <p style={{ color: "#AAA", lineHeight: "1.6", fontSize: "1.1rem" }}>
          <strong style={{ color: "#FFF" }}>{data.name}</strong> has invited you to align your natural design with the family map.
        </p>
      </header>

      <main style={{ maxWidth: "600px", margin: "0 auto", width: "100%" }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <label style={{ color: "#666", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1.5px", fontWeight: 600 }}>
              Date of Birth
            </label>
            <input
              type="date"
              required
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: "1px solid #333",
                color: "#FFF",
                padding: "1rem 0",
                fontSize: "1.5rem",
                outline: "none",
                fontFamily: "inherit"
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <label style={{ color: "#666", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1.5px", fontWeight: 600 }}>
              Time of Birth (Optional)
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: "1px solid #333",
                color: "#FFF",
                padding: "1rem 0",
                fontSize: "1.5rem",
                outline: "none",
                fontFamily: "inherit"
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <label style={{ color: "#666", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1.5px", fontWeight: 600 }}>
              City of Birth (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. London, UK"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: "1px solid #333",
                color: "#FFF",
                padding: "1rem 0",
                fontSize: "1.5rem",
                outline: "none",
                fontFamily: "inherit"
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              marginTop: "2rem",
              backgroundColor: "#FFF",
              color: "#000",
              border: "none",
              padding: "1.5rem",
              fontSize: "1rem",
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "1px",
              textTransform: "uppercase",
              transition: "opacity 0.2s"
            }}
          >
            Confirm Alignment
          </button>

        </form>
      </main>
    </div>
  );
}
