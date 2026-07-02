// BookingSuccess.jsx — M3 confirmation screen

function BookingSuccess({ master, procedure, dateTime, clientName, onClose }) {
  return (
    <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Hero */}
      <div style={{ background: "#FFD9DC", borderRadius: 28, padding: "32px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#8B4A58", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 28, fontWeight: 400, color: "#3B0017", lineHeight: 1.28 }}>Appointment booked!</div>
          <div style={{ fontSize: 14, color: "#8B4A58", marginTop: 8 }}>See you soon, {clientName} 🌸</div>
        </div>
      </div>

      {/* Details card */}
      <div style={{ background: "#FFF0F1", borderRadius: 20, overflow: "hidden" }}>
        {[
          ["Service", procedure.name],
          ["Master",  master.name],
          ["Date",    `${dateTime.day.label} ${dateTime.day.num} April 2025`],
          ["Time",    dateTime.slot],
          ["Price",   `${procedure.price} PLN`],
        ].map(([k, v], i, arr) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: i < arr.length - 1 ? "1px solid #EDE1E1" : "none" }}>
            <span style={{ fontSize: 13, color: "#524344" }}>{k}</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: "#211A1B" }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 13, color: "#857374", textAlign: "center", lineHeight: 1.5 }}>
        A confirmation will be sent to your email address.
      </div>

      <button onClick={onClose} style={{
        height: 48, borderRadius: 9999, border: "1px solid #D8C2C3", fontFamily: "inherit",
        background: "transparent", color: "#8B4A58", fontSize: 15, fontWeight: 500,
        letterSpacing: ".007em", cursor: "pointer", transition: "background 150ms",
      }}
      onMouseEnter={e => e.currentTarget.style.background = "#FFF0F1"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        Book another visit
      </button>
    </div>
  );
}

Object.assign(window, { BookingSuccess });
