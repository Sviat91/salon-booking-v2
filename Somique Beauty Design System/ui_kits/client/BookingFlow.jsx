// BookingFlow.jsx — M3 Service + DateTime steps

const PROCEDURES = [
  { id: "p1", name: "Masaż twarzy 60 min",  price: 180, duration: 60 },
  { id: "p2", name: "Masaż twarzy 90 min",  price: 240, duration: 90 },
  { id: "p3", name: "Drenaż limfatyczny",   price: 210, duration: 75 },
  { id: "p4", name: "Peeling enzymatyczny", price: 160, duration: 50 },
];

const SLOTS = ["09:00","10:00","11:00","12:30","14:00","15:00","16:30","17:00"];
const DAYS  = [
  { label: "Wt", num: "29", avail: true  },
  { label: "Śr", num: "30", avail: true  },
  { label: "Cz", num: "1",  avail: true  },
  { label: "Pt", num: "2",  avail: true  },
  { label: "Sb", num: "3",  avail: false },
  { label: "Nd", num: "4",  avail: false },
];

function BackButton({ onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 6, height: 40, padding: "0 16px 0 8px",
      borderRadius: 9999, border: "none", background: "transparent", cursor: "pointer",
      color: "#8B4A58", fontSize: 14, fontWeight: 500, fontFamily: "inherit",
      position: "relative", overflow: "hidden",
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="15 18 9 12 15 6"/></svg>
      Back
    </button>
  );
}

function ServiceStep({ master, onSelect, onBack }) {
  const [hovered, setHovered] = React.useState(null);
  return (
    <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 20 }}>
      <BackButton onClick={onBack} />

      {/* Master summary */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <img src={master.avatar} alt={master.name} style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover", border: "2px solid #FFD9DC" }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 400, color: "#211A1B" }}>Choose a service</div>
          <div style={{ fontSize: 13, color: "#524344", marginTop: 2 }}>with {master.name}</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {PROCEDURES.map(p => (
          <button key={p.id}
            onClick={() => onSelect(p)}
            onMouseEnter={() => setHovered(p.id)}
            onMouseLeave={() => setHovered(null)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: hovered === p.id ? "#F3E3E4" : "#FFF0F1",
              border: "none", borderRadius: 16, padding: "14px 18px",
              cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit",
              transition: "background 150ms",
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#211A1B", letterSpacing: ".009em" }}>{p.name}</div>
              <div style={{ fontSize: 12, color: "#524344", marginTop: 2 }}>{p.duration} min</div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#8B4A58" }}>{p.price} zł</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function DateTimeStep({ master, procedure, onSelect, onBack }) {
  const [selDay, setSelDay] = React.useState(null);
  const [selSlot, setSelSlot] = React.useState(null);
  const ok = selDay !== null && selSlot;

  return (
    <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 20 }}>
      <BackButton onClick={onBack} />

      <div style={{ fontSize: 22, fontWeight: 400, color: "#211A1B" }}>Pick a date &amp; time</div>

      {/* Procedure chip */}
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 32, padding: "0 14px", borderRadius: 8, background: "#FFD9DC", color: "#3B0017", fontSize: 13, fontWeight: 500, width: "fit-content" }}>
        {procedure.name} · {procedure.duration} min · {procedure.price} zł
      </div>

      {/* Days */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 500, color: "#857374", letterSpacing: ".045em", textTransform: "uppercase", marginBottom: 10 }}>April 2025</div>
        <div style={{ display: "flex", gap: 8 }}>
          {DAYS.map((d, i) => (
            <button key={i} disabled={!d.avail} onClick={() => setSelDay(i)} style={{
              flex: 1, padding: "10px 0", borderRadius: 12, border: "none", cursor: d.avail ? "pointer" : "not-allowed",
              background: selDay === i ? "#8B4A58" : d.avail ? "#FFF0F1" : "#F9E9EA",
              color: selDay === i ? "#fff" : d.avail ? "#211A1B" : "#D8C2C3",
              fontFamily: "inherit", transition: "all 150ms",
            }}>
              <div style={{ fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: ".04em", opacity: .7 }}>{d.label}</div>
              <div style={{ fontSize: 16, fontWeight: selDay === i ? 500 : 400, marginTop: 2 }}>{d.num}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Slots */}
      {selDay !== null && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 500, color: "#857374", letterSpacing: ".045em", textTransform: "uppercase", marginBottom: 10 }}>Available slots</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {SLOTS.map((s, i) => (
              <button key={i} onClick={() => setSelSlot(s)} style={{
                padding: "10px 0", borderRadius: 12, border: "none", cursor: "pointer",
                background: selSlot === s ? "#8B4A58" : "#FFF0F1",
                color: selSlot === s ? "#fff" : "#211A1B",
                fontSize: 13, fontWeight: 500, fontFamily: "inherit", transition: "all 150ms",
              }}>{s}</button>
            ))}
          </div>
        </div>
      )}

      <button disabled={!ok} onClick={() => onSelect({ day: DAYS[selDay], slot: selSlot })} style={{
        height: 48, borderRadius: 9999, border: "none", fontFamily: "inherit",
        background: ok ? "#8B4A58" : "#EDE1E1", color: ok ? "#fff" : "#857374",
        fontSize: 15, fontWeight: 500, cursor: ok ? "pointer" : "not-allowed",
        letterSpacing: ".007em", transition: "all 200ms",
        boxShadow: ok ? "0 2px 8px rgba(139,74,88,.2)" : "none",
      }}>
        Continue
      </button>
    </div>
  );
}

Object.assign(window, { ServiceStep, DateTimeStep, PROCEDURES, SLOTS });
