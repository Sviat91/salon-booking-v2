// MasterSelector.jsx — M3 client booking: choose master

const MASTERS = [
  { id: "olga",   name: "Olga",   avatar: "../../assets/photo_master_olga.png",   spec: "Facial massage specialist", bookings: 48 },
  { id: "yuliia", name: "Yuliia", avatar: "../../assets/photo_master_yuliia.png", spec: "Lymphatic drainage expert",  bookings: 37 },
];

function MasterSelector({ onSelect }) {
  const [hovered, setHovered] = React.useState(null);

  return (
    <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 28, padding: "0 4px" }}>
      <div>
        <div style={{ fontSize: 32, fontWeight: 400, color: "#211A1B", lineHeight: 1.25, letterSpacing: 0 }}>
          Book a visit
        </div>
        <div style={{ fontSize: 14, color: "#524344", marginTop: 8, letterSpacing: ".018em" }}>Choose your master to get started</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {MASTERS.map(m => (
          <button key={m.id}
            onClick={() => onSelect(m)}
            onMouseEnter={() => setHovered(m.id)}
            onMouseLeave={() => setHovered(null)}
            style={{
              display: "flex", alignItems: "center", gap: 16,
              background: hovered === m.id ? "#F3E3E4" : "#FFF0F1",
              border: "none", borderRadius: 20, padding: "16px 20px",
              cursor: "pointer", textAlign: "left", width: "100%",
              fontFamily: "inherit", transition: "all 200ms",
              boxShadow: hovered === m.id ? "0 2px 8px rgba(139,74,88,.12)" : "0 1px 2px rgba(0,0,0,.06)",
            }}
          >
            <img src={m.avatar} alt={m.name} style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover", border: "3px solid #FFD9DC", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: "#211A1B", letterSpacing: ".009em" }}>{m.name}</div>
              <div style={{ fontSize: 13, color: "#524344", marginTop: 3 }}>{m.spec}</div>
              <div style={{ fontSize: 11, color: "#857374", marginTop: 4 }}>{m.bookings} happy clients</div>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B4A58" strokeWidth="1.8"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { MasterSelector, MASTERS });
