// BookingForm.jsx — M3 contact details + consent

function BookingForm({ master, procedure, dateTime, onSubmit, onBack }) {
  const [name,  setName]  = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [gdpr,  setGdpr]  = React.useState(false);
  const [terms, setTerms] = React.useState(false);
  const [notif, setNotif] = React.useState(false);
  const [focused, setFocused] = React.useState(null);

  const ok = name.trim().length >= 2 && phone.trim().length >= 9 && gdpr && terms;

  const fieldStyle = (id) => ({
    position: "relative", width: "100%",
  });

  const inputStyle = (id) => ({
    width: "100%", height: 56, padding: "20px 16px 8px",
    background: "#EDE1E1",
    border: "none",
    borderBottom: `${focused === id ? 2 : 1}px solid ${focused === id ? "#8B4A58" : "#524344"}`,
    borderRadius: "4px 4px 0 0",
    fontFamily: "Roboto, sans-serif", fontSize: 14, color: "#211A1B",
    outline: "none", boxSizing: "border-box", transition: "border 150ms",
  });

  const labelStyle = (id, hasValue) => ({
    position: "absolute", top: (focused === id || hasValue) ? 8 : 18, left: 16,
    fontSize: (focused === id || hasValue) ? 11 : 14,
    color: focused === id ? "#8B4A58" : "#524344",
    pointerEvents: "none", transition: "all 150ms", fontFamily: "Roboto, sans-serif",
    fontWeight: (focused === id || hasValue) ? 500 : 400,
  });

  return (
    <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Back */}
      <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 40, padding: "0 16px 0 8px", borderRadius: 9999, border: "none", background: "transparent", cursor: "pointer", color: "#8B4A58", fontSize: 14, fontWeight: 500, fontFamily: "inherit" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </button>

      <div style={{ fontSize: 22, fontWeight: 400, color: "#211A1B" }}>Your details</div>

      {/* Booking summary chip row */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", height: 32, padding: "0 14px", borderRadius: 8, background: "#FFD9DC", color: "#3B0017", fontSize: 12, fontWeight: 500 }}>{master.name}</span>
        <span style={{ display: "inline-flex", alignItems: "center", height: 32, padding: "0 14px", borderRadius: 8, background: "#FFDCCA", color: "#2F1509", fontSize: 12, fontWeight: 500 }}>{procedure.name}</span>
        <span style={{ display: "inline-flex", alignItems: "center", height: 32, padding: "0 14px", borderRadius: 8, background: "#FFDFA3", color: "#271900", fontSize: 12, fontWeight: 500 }}>{dateTime.day.label} {dateTime.day.num} · {dateTime.slot}</span>
      </div>

      {/* Filled text fields */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={fieldStyle("name")}>
          <input value={name} onChange={e => setName(e.target.value)} onFocus={() => setFocused("name")} onBlur={() => setFocused(null)} style={inputStyle("name")} placeholder=" " />
          <label style={labelStyle("name", name.length > 0)}>Full name *</label>
        </div>
        <div style={fieldStyle("phone")}>
          <input value={phone} onChange={e => setPhone(e.target.value)} onFocus={() => setFocused("phone")} onBlur={() => setFocused(null)} style={inputStyle("phone")} placeholder=" " type="tel" />
          <label style={labelStyle("phone", phone.length > 0)}>Phone number *</label>
        </div>
        <div style={fieldStyle("email")}>
          <input value={email} onChange={e => setEmail(e.target.value)} onFocus={() => setFocused("email")} onBlur={() => setFocused(null)} style={inputStyle("email")} placeholder=" " type="email" />
          <label style={labelStyle("email", email.length > 0)}>Email (optional)</label>
        </div>
      </div>

      {/* Consents */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px", background: "#F9E9EA", borderRadius: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: ".045em", textTransform: "uppercase", color: "#524344" }}>Consents</div>
        {[
          [gdpr, setGdpr, "I consent to processing of my personal data", true],
          [terms, setTerms, "I accept the terms of service", true],
          [notif, setNotif, "I want to receive appointment notifications", false],
        ].map(([val, set, label, req], i) => (
          <label key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", fontSize: 13, color: "#211A1B", lineHeight: 1.5 }}>
            <div onClick={() => set(!val)} style={{
              width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1,
              border: val ? "none" : "1.5px solid #857374",
              background: val ? "#8B4A58" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 150ms", cursor: "pointer",
            }}>
              {val && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
            </div>
            {label}{req && <span style={{ color: "#BA1A1A" }}> *</span>}
          </label>
        ))}
      </div>

      <button disabled={!ok} onClick={() => onSubmit({ name, phone, email })} style={{
        height: 48, borderRadius: 9999, border: "none", fontFamily: "inherit",
        background: ok ? "#8B4A58" : "#EDE1E1",
        color: ok ? "#fff" : "#857374",
        fontSize: 15, fontWeight: 500, letterSpacing: ".007em",
        cursor: ok ? "pointer" : "not-allowed", transition: "all 200ms",
        boxShadow: ok ? "0 2px 8px rgba(139,74,88,.2)" : "none",
      }}>
        Book appointment
      </button>
    </div>
  );
}

Object.assign(window, { BookingForm });
