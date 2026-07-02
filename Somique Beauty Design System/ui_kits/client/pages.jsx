// pages.jsx — All client app pages
// Requires: shared.jsx loaded first

const { useState, useEffect, useMemo } = React;

const MASTERS = [
  { id:'olga',   name:'Olga',   spec:'Facial massage specialist', avatar:'../../assets/photo_master_olga.png',   bookings:48 },
  { id:'yuliia', name:'Yuliia', spec:'Lymphatic drainage expert',  avatar:'../../assets/photo_master_yuliia.png', bookings:37 },
];

const PROCEDURES = [
  { id:'p1', name:'Masaż twarzy 60 min',  price:180, duration:60 },
  { id:'p2', name:'Masaż twarzy 90 min',  price:240, duration:90 },
  { id:'p3', name:'Drenaż limfatyczny',   price:210, duration:75 },
  { id:'p4', name:'Peeling enzymatyczny', price:160, duration:50 },
];

const CAL_DAYS = ['Mo','Tu','We','Th','Fr','Sa','Su'];
const MONTH_DAYS = [
  [null,null,null,1,2,3,4],
  [5,6,7,8,9,10,11],
  [12,13,14,15,16,17,18],
  [19,20,21,22,23,24,25],
  [26,27,28,29,30,null,null],
];
const DISABLED = [1,3,10,17,24];
const SLOTS = ['09:00','09:30','10:00','10:30','11:00','11:30','14:00','14:30','15:00','15:30','16:00','16:30'];

const HISTORY = [
  { date:'15 kw. 2025', service:'Masaż twarzy 60 min', master:'Olga',   price:180, status:'completed' },
  { date:'22 mar. 2025', service:'Drenaż limfatyczny',  master:'Yuliia', price:210, status:'completed' },
  { date:'5 lut. 2025',  service:'Masaż twarzy 90 min', master:'Olga',   price:240, status:'cancelled' },
];

// ── HOME PAGE ─────────────────────────────────────────────
function HomePage({ onSelectMaster, onLogin, onProfile, isLoggedIn }) {
  const { t, dark, toggle } = useTheme();
  const [hov, setHov] = useState(null);

  const reviews = [
    'Niesamowita Olga, polecam każdemu! ⭐⭐⭐⭐⭐',
    'Yuliia to prawdziwy specjalista, efekty widoczne od razu',
    'Bardzo miła atmosfera i profesjonalne podejście',
    'Już 5. wizyta i jeszcze wróce! Polecam serdecznie.',
    'Rewelacyjny masaż twarzy, skóra wygląda pięknie',
  ];

  return (
    <div style={{ minHeight:'100vh', background:t.bgGrad, position:'relative', display:'flex', flexDirection:'column', fontFamily:'Roboto,sans-serif' }}>
      {/* Top nav */}
      <nav style={{ position:'sticky', top:0, zIndex:30, background:t.nav, backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', borderBottom:`1px solid ${t.border}` }}>
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 32px', height:64, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <LogoImg height={30} dark={dark} />
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <LangBtn />
            <ThemeToggleBtn />
            <UserAvatarBtn onLogin={onLogin} onProfile={onProfile} isLoggedIn={isLoggedIn} />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'60px 24px 32px' }}>
        <div style={{ textAlign:'center', marginBottom:48 }}>
          <div style={{ fontSize:13, fontWeight:500, letterSpacing:'.06em', textTransform:'uppercase', color:t.primary, marginBottom:12 }}>Salon Somique Beauty</div>
          <h1 style={{ fontSize:'clamp(2rem,5vw,3rem)', fontWeight:400, color:t.text, margin:0, lineHeight:1.2 }}>Zarezerwuj wizytę</h1>
          <p style={{ fontSize:16, color:t.textSub, marginTop:12, maxWidth:460, lineHeight:1.6 }}>Wybierz swojego mistrza i umów się na zabieg w kilka sekund</p>
        </div>

        {/* Master cards */}
        <div style={{ display:'flex', gap:20, flexWrap:'wrap', justifyContent:'center', maxWidth:720, width:'100%' }}>
          {MASTERS.map(m => (
            <button key={m.id} onClick={() => onSelectMaster(m)}
              onMouseEnter={() => setHov(m.id)} onMouseLeave={() => setHov(null)}
              style={{
                display:'flex', flexDirection:'column', alignItems:'center', gap:14,
                background: hov===m.id ? t.cardHov : t.card,
                border:`1px solid ${t.border}`, borderRadius:20, padding:'28px 32px',
                cursor:'pointer', fontFamily:'inherit', transition:'all 200ms',
                boxShadow: hov===m.id ? t.shadow2 : t.shadow,
                transform: hov===m.id ? 'translateY(-2px)' : 'none',
                minWidth:260, flex:1, maxWidth:320,
              }}>
              <img src={m.avatar} alt={m.name} style={{ width:88, height:88, borderRadius:'50%', objectFit:'cover', border:`3px solid ${t.priCont}` }} />
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:20, fontWeight:500, color:t.text }}>{m.name}</div>
                <div style={{ fontSize:13, color:t.textSub, marginTop:4 }}>{m.spec}</div>
                <div style={{ fontSize:11, color:t.textMut, marginTop:6 }}>{m.bookings} clients served</div>
              </div>
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, height:36, padding:'0 16px', borderRadius:9999, background:t.primary, color:t.onPri, fontSize:13, fontWeight:500, width:'100%', justifyContent:'center' }}>
                Book now
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Reviews marquee */}
      <div style={{ overflow:'hidden', padding:'20px 0', borderTop:`1px solid ${t.border}`, background:t.surface }}>
        <div style={{ display:'flex', gap:32, animation:'marquee 28s linear infinite', whiteSpace:'nowrap', paddingLeft:'100%' }}>
          {[...reviews, ...reviews].map((r,i) => (
            <span key={i} style={{ fontSize:13, color:t.textSub, flexShrink:0 }}>"{r}"</span>
          ))}
        </div>
      </div>
      <style>{`@keyframes marquee { from { transform:translateX(0) } to { transform:translateX(-50%) } }`}</style>

      {/* Footer */}
      <footer style={{ padding:'16px 32px', borderTop:`1px solid ${t.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:11, color:t.textMut, flexWrap:'wrap', gap:8 }}>
        <span>© 2025 Somique Beauty</span>
        <div style={{ display:'flex', gap:16 }}>
          {['Privacy Policy','Terms of Service','Help Center'].map(l => (
            <a key={l} href="#" style={{ color:t.textMut, textDecoration:'underline' }}>{l}</a>
          ))}
        </div>
      </footer>
    </div>
  );
}

// ── BOOKING PAGE (2-col desktop) ──────────────────────────
function BookingPage({ master, onBack, onLogin, onProfile, isLoggedIn }) {
  const { t, dark, toggle } = useTheme();
  const [month, setMonth] = useState('April 2025');
  const [selDay, setSelDay] = useState(null);
  const [selProc, setSelProc] = useState('');
  const [selSlot, setSelSlot] = useState(null);
  const [showSlots, setShowSlots] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState('booking'); // booking | success

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gdpr, setGdpr] = useState(false);
  const [terms, setTerms] = useState(false);
  const [focused, setFocused] = useState(null);

  const proc = PROCEDURES.find(p => p.id === selProc);
  const canBook = name.length >= 2 && phone.length >= 9 && gdpr && terms && selProc && selDay && selSlot;

  const iStyle = (id) => ({
    width:'100%', height:48, padding: focused===id||['name','phone','email'].includes(id) ? '14px 14px 4px' : '0 14px',
    background:t.input, border:'none', borderBottom:`${focused===id?2:1}px solid ${focused===id?t.primary:t.outline}`,
    borderRadius:'4px 4px 0 0', fontFamily:'Roboto,sans-serif', fontSize:14, color:t.text,
    outline:'none', boxSizing:'border-box', transition:'border 150ms',
  });
  const lStyle = (id, hasVal) => ({
    position:'absolute', top: focused===id||hasVal ? 6 : 15, left:14,
    fontSize: focused===id||hasVal ? 10 : 14, color: focused===id ? t.primary : t.textMut,
    pointerEvents:'none', transition:'all 150ms', fontFamily:'Roboto,sans-serif', fontWeight:focused===id||hasVal?500:400,
  });

  if (step === 'success') {
    return (
      <div style={{ minHeight:'100vh', background:t.bgGrad, fontFamily:'Roboto,sans-serif', display:'flex', flexDirection:'column' }}>
        <BookingTopBar master={master} onBack={onBack} onLogin={onLogin} onProfile={onProfile} isLoggedIn={isLoggedIn} />
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div style={{ maxWidth:400, width:'100%', display:'flex', flexDirection:'column', alignItems:'center', gap:24, textAlign:'center' }}>
            <div style={{ width:80, height:80, borderRadius:'50%', background:t.primary, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <div style={{ fontSize:28, fontWeight:400, color:t.text }}>Appointment booked!</div>
              <div style={{ fontSize:14, color:t.textSub, marginTop:8 }}>See you soon, {name}!</div>
            </div>
            <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:16, padding:'16px 20px', width:'100%', textAlign:'left' }}>
              {[[proc?.name, 'Service'],[master.name,'Master'],[`${selDay} April · ${selSlot}`,'Date & Time'],[`${proc?.price} PLN`,'Price']].map(([v,k])=>(
                <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${t.border}` }}>
                  <span style={{ fontSize:12, color:t.textMut }}>{k}</span>
                  <span style={{ fontSize:13, fontWeight:500, color:t.text }}>{v}</span>
                </div>
              ))}
            </div>
            <button onClick={onBack} style={{ height:44, padding:'0 32px', borderRadius:9999, border:`1px solid ${t.outline}`, background:'transparent', color:t.primary, fontSize:14, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>
              Back to home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:'100vh', background:t.bgGrad, fontFamily:'Roboto,sans-serif', display:'flex', flexDirection:'column' }}>
      <BookingTopBar master={master} onBack={onBack} onLogin={onLogin} onProfile={onProfile} isLoggedIn={isLoggedIn} />

      {/* Master + title */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, padding:'28px 24px 20px' }}>
        <img src={master.avatar} alt={master.name} style={{ width:64, height:64, borderRadius:'50%', objectFit:'cover', border:`3px solid ${t.priCont}`, boxShadow:t.shadow }} />
        <h1 style={{ fontSize:28, fontWeight:400, color:t.text, margin:0 }}>Book a visit</h1>
      </div>

      {/* 2-column layout */}
      <div style={{ flex:1, display:'flex', justifyContent:'center', alignItems:'flex-start', gap:20, padding:'0 24px 40px', flexWrap:'wrap', maxWidth:900, margin:'0 auto', width:'100%' }}>

        {/* LEFT: Calendar */}
        <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:16, padding:'20px', minWidth:320, flex:'0 0 340px', boxShadow:t.shadow }}>
          {/* Month nav */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <button style={{ width:32, height:32, borderRadius:'50%', border:`1px solid ${t.outline}`, background:'transparent', cursor:'pointer', color:t.textSub, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span style={{ fontSize:15, fontWeight:500, color:t.text }}>{month}</span>
            <button style={{ width:32, height:32, borderRadius:'50%', border:`1px solid ${t.outline}`, background:'transparent', cursor:'pointer', color:t.textSub, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          {/* Day headers */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:4 }}>
            {CAL_DAYS.map(d => <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:500, color:t.textMut, padding:'4px 0' }}>{d}</div>)}
          </div>
          {/* Days */}
          {MONTH_DAYS.map((week, wi) => (
            <div key={wi} style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
              {week.map((day, di) => {
                const disabled = !day || !selProc || DISABLED.includes(day);
                const selected = day !== null && selDay === day;
                return (
                  <button key={di} disabled={disabled} onClick={() => { setSelDay(day); setSelSlot(null); }}
                    style={{
                      width:'100%', aspectRatio:'1', borderRadius:'50%', border:'none',
                      background: selected ? t.primary : 'transparent',
                      color: selected ? t.onPri : disabled ? t.outline : t.text,
                      fontSize:13, cursor:disabled?'default':'pointer', fontFamily:'inherit',
                      transition:'all 150ms',
                    }}>
                    {day || ''}
                  </button>
                );
              })}
            </div>
          ))}
          {/* Hint */}
          <div style={{ marginTop:12, fontSize:12, color:t.textMut }}>
            {!selProc ? 'First, select a service' : !selDay ? 'Now select a date' : 'Great! Pick a time slot'}
          </div>
        </div>

        {/* RIGHT: Service + Form */}
        <div style={{ flex:'1 1 300px', minWidth:280, maxWidth:380, display:'flex', flexDirection:'column', gap:14 }}>

          {/* Service selector */}
          <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:16, padding:'18px 20px', boxShadow:t.shadow }}>
            <div style={{ fontSize:14, fontWeight:500, color:t.text, marginBottom:12 }}>Service</div>
            <select value={selProc} onChange={e => { setSelProc(e.target.value); setSelDay(null); setSelSlot(null); }}
              style={{ width:'100%', height:44, padding:'0 14px', border:`1px solid ${t.outline}`, borderRadius:10, background:t.surface, color:t.text, fontSize:13, fontFamily:'inherit', cursor:'pointer', appearance:'none', backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23857374' fill='none' stroke-width='1.5'/%3E%3C/svg%3E")`, backgroundRepeat:'no-repeat', backgroundPosition:'right 14px center' }}>
              <option value="">Select a service</option>
              {PROCEDURES.map(p => <option key={p.id} value={p.id}>{p.name} — {p.price} zł</option>)}
            </select>
          </div>

          {/* Time slots */}
          {selDay && selProc && (
            <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:16, padding:'18px 20px', boxShadow:t.shadow }}>
              <div style={{ fontSize:13, fontWeight:500, color:t.text, marginBottom:10 }}>Available slots — {selDay} April</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                {SLOTS.map(s => (
                  <button key={s} onClick={() => { setSelSlot(s); setShowForm(true); }}
                    style={{ padding:'8px 0', borderRadius:9, border:'none', fontFamily:'inherit', cursor:'pointer', background: selSlot===s ? t.primary : t.surface, color: selSlot===s ? t.onPri : t.text, fontSize:12, fontWeight:500, transition:'all 150ms' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Booking form */}
          {showForm && selSlot && (
            <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:16, padding:'18px 20px', boxShadow:t.shadow }}>
              <div style={{ fontSize:14, fontWeight:500, color:t.text, marginBottom:14 }}>Your details</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:14 }}>
                {[['name','Full name',name,setName],['phone','Phone',phone,setPhone],['email','Email (optional)',email,setEmail]].map(([id,label,val,setter]) => (
                  <div key={id} style={{ position:'relative' }}>
                    <input value={val} onChange={e=>setter(e.target.value)} onFocus={()=>setFocused(id)} onBlur={()=>setFocused(null)} placeholder=" " type={id==='email'?'email':id==='phone'?'tel':'text'}
                      style={{ width:'100%', height:48, padding:'14px 14px 4px', background:t.input, border:'none', borderBottom:`${focused===id?2:1}px solid ${focused===id?t.primary:t.outline}`, borderRadius:'4px 4px 0 0', fontFamily:'Roboto,sans-serif', fontSize:14, color:t.text, outline:'none', boxSizing:'border-box', transition:'border 150ms' }} />
                    <label style={{ position:'absolute', top: focused===id||val.length>0 ? 6 : 15, left:14, fontSize: focused===id||val.length>0 ? 10 : 14, color: focused===id ? t.primary : t.textMut, pointerEvents:'none', transition:'all 150ms', fontFamily:'Roboto,sans-serif', fontWeight:focused===id||val.length>0?500:400 }}>{label}</label>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
                {[[gdpr,setGdpr,'I consent to processing of my personal data',true],[terms,setTerms,'I accept the terms of service',true]].map(([v,s,l,req],i) => (
                  <label key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', fontSize:12, color:t.textSub, lineHeight:1.4 }}>
                    <div onClick={()=>s(!v)} style={{ width:16, height:16, borderRadius:3, background:v?t.primary:'transparent', border:v?'none':`1.5px solid ${t.outline}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1, cursor:'pointer' }}>
                      {v && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    {l}{req && <span style={{ color:t.error }}> *</span>}
                  </label>
                ))}
              </div>
              <button disabled={!canBook} onClick={() => setStep('success')} style={{ width:'100%', height:44, borderRadius:9999, border:'none', background:canBook?t.primary:t.surfaceHi, color:canBook?t.onPri:t.textMut, fontSize:14, fontWeight:500, cursor:canBook?'pointer':'not-allowed', fontFamily:'inherit', transition:'all 200ms', letterSpacing:'.007em' }}>
                Book appointment
              </button>
            </div>
          )}

          {/* Manage booking */}
          {!showForm && (
            <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:16, padding:'18px 20px', boxShadow:t.shadow }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <div style={{ fontSize:14, fontWeight:500, color:t.text }}>Manage booking</div>
                <button style={{ fontSize:11, color:t.primary, background:'transparent', border:'none', cursor:'pointer', fontFamily:'inherit' }}>Close panel</button>
              </div>
              <div style={{ fontSize:12, color:t.textSub, marginBottom:12 }}>Enter your details to find your booking:</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[['','Full name'],['','Phone']].map(([v,p],i) => (
                  <input key={i} placeholder={p} style={{ width:'100%', height:40, padding:'0 14px', background:'transparent', border:`1px solid ${t.outline}`, borderRadius:8, fontSize:13, color:t.text, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
                ))}
                <button style={{ height:40, borderRadius:9999, border:'none', background:t.primary, color:t.onPri, fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit', opacity:.6 }}>Search bookings</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer style={{ padding:'14px 32px', borderTop:`1px solid ${t.border}`, textAlign:'center', fontSize:11, color:t.textMut }}>
        Privacy Policy · Terms of Service · Help Center | © 2025 Somique Beauty. All rights reserved.
      </footer>
    </div>
  );
}

function BookingTopBar({ master, onBack, onLogin, onProfile, isLoggedIn }) {
  const { t, dark } = useTheme();
  return (
    <nav style={{ position:'sticky', top:0, zIndex:30, background:t.nav, backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', borderBottom:`1px solid ${t.border}`, flexShrink:0 }}>
      <div style={{ maxWidth:900, margin:'0 auto', padding:'0 24px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, height:32, padding:'0 14px 0 8px', borderRadius:9999, border:`1px solid ${t.outline}`, background:'transparent', cursor:'pointer', color:t.text, fontSize:13, fontWeight:500, fontFamily:'inherit' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <LogoImg height={24} dark={dark} />
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <LangBtn />
          <ThemeToggleBtn />
          <UserAvatarBtn onLogin={onLogin} onProfile={onProfile} isLoggedIn={isLoggedIn} />
        </div>
      </div>
    </nav>
  );
}

// ── LOGIN PAGE ────────────────────────────────────────────
function LoginPage({ onBack, onRegister, onLoggedIn }) {
  const { t, dark } = useTheme();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [focused, setFocused] = useState(null);

  const fields = [['email','Email','email',email,setEmail],['pass','Password','password',pass,setPass]];

  return (
    <div style={{ minHeight:'100vh', background:t.bgGrad, fontFamily:'Roboto,sans-serif', display:'flex', flexDirection:'column' }}>
      <nav style={{ position:'sticky', top:0, zIndex:30, background:t.nav, backdropFilter:'blur(12px)', borderBottom:`1px solid ${t.border}` }}>
        <div style={{ maxWidth:480, margin:'0 auto', padding:'0 24px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, height:32, padding:'0 14px 0 8px', borderRadius:9999, border:`1px solid ${t.outline}`, background:'transparent', cursor:'pointer', color:t.text, fontSize:13, fontWeight:500, fontFamily:'inherit' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
          <LogoImg height={24} dark={dark} />
          <ThemeToggleBtn />
        </div>
      </nav>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
        <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:20, padding:'36px 32px', width:'100%', maxWidth:400, boxShadow:t.shadow2 }}>
          <h2 style={{ fontSize:24, fontWeight:400, color:t.text, margin:'0 0 6px' }}>Sign in</h2>
          <p style={{ fontSize:13, color:t.textSub, margin:'0 0 28px' }}>Welcome back to Somique Beauty</p>
          <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:20 }}>
            {fields.map(([id,label,type,val,setter]) => (
              <div key={id} style={{ position:'relative' }}>
                <input value={val} onChange={e=>setter(e.target.value)} onFocus={()=>setFocused(id)} onBlur={()=>setFocused(null)} type={type} placeholder=" "
                  style={{ width:'100%', height:52, padding:'16px 14px 6px', background:t.input, border:'none', borderBottom:`${focused===id?2:1}px solid ${focused===id?t.primary:t.outline}`, borderRadius:'4px 4px 0 0', fontFamily:'Roboto,sans-serif', fontSize:14, color:t.text, outline:'none', boxSizing:'border-box', transition:'border 150ms' }} />
                <label style={{ position:'absolute', top: focused===id||val.length>0?6:16, left:14, fontSize: focused===id||val.length>0?10:14, color: focused===id?t.primary:t.textMut, pointerEvents:'none', transition:'all 150ms' }}>{label}</label>
              </div>
            ))}
          </div>
          <button onClick={onLoggedIn} style={{ width:'100%', height:48, borderRadius:9999, border:'none', background:t.primary, color:t.onPri, fontSize:15, fontWeight:500, cursor:'pointer', fontFamily:'inherit', marginBottom:16 }}>
            Sign in
          </button>
          <div style={{ textAlign:'center', fontSize:13, color:t.textSub }}>
            No account?{' '}
            <button onClick={onRegister} style={{ background:'none', border:'none', color:t.primary, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:500, textDecoration:'underline' }}>Create one</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── REGISTER PAGE ─────────────────────────────────────────
function RegisterPage({ onBack, onLogin }) {
  const { t, dark } = useTheme();
  const [focused, setFocused] = useState(null);
  const fields = [['name','Full name','text'],['email','Email','email'],['phone','Phone','tel'],['pass','Password','password']];
  const [vals, setVals] = useState({name:'',email:'',phone:'',pass:''});

  return (
    <div style={{ minHeight:'100vh', background:t.bgGrad, fontFamily:'Roboto,sans-serif', display:'flex', flexDirection:'column' }}>
      <nav style={{ position:'sticky', top:0, zIndex:30, background:t.nav, backdropFilter:'blur(12px)', borderBottom:`1px solid ${t.border}` }}>
        <div style={{ maxWidth:480, margin:'0 auto', padding:'0 24px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, height:32, padding:'0 14px 0 8px', borderRadius:9999, border:`1px solid ${t.outline}`, background:'transparent', cursor:'pointer', color:t.text, fontSize:13, fontWeight:500, fontFamily:'inherit' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
          <LogoImg height={24} dark={dark} />
          <ThemeToggleBtn />
        </div>
      </nav>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
        <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:20, padding:'36px 32px', width:'100%', maxWidth:400, boxShadow:t.shadow2 }}>
          <h2 style={{ fontSize:24, fontWeight:400, color:t.text, margin:'0 0 6px' }}>Create account</h2>
          <p style={{ fontSize:13, color:t.textSub, margin:'0 0 28px' }}>Quick and easy — book faster next time</p>
          <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:20 }}>
            {fields.map(([id,label,type]) => (
              <div key={id} style={{ position:'relative' }}>
                <input value={vals[id]} onChange={e=>setVals(v=>({...v,[id]:e.target.value}))} onFocus={()=>setFocused(id)} onBlur={()=>setFocused(null)} type={type} placeholder=" "
                  style={{ width:'100%', height:52, padding:'16px 14px 6px', background:t.input, border:'none', borderBottom:`${focused===id?2:1}px solid ${focused===id?t.primary:t.outline}`, borderRadius:'4px 4px 0 0', fontFamily:'Roboto,sans-serif', fontSize:14, color:t.text, outline:'none', boxSizing:'border-box', transition:'border 150ms' }} />
                <label style={{ position:'absolute', top: focused===id||vals[id].length>0?6:16, left:14, fontSize: focused===id||vals[id].length>0?10:14, color: focused===id?t.primary:t.textMut, pointerEvents:'none', transition:'all 150ms' }}>{label}</label>
              </div>
            ))}
          </div>
          <button onClick={onLogin} style={{ width:'100%', height:48, borderRadius:9999, border:'none', background:t.primary, color:t.onPri, fontSize:15, fontWeight:500, cursor:'pointer', fontFamily:'inherit', marginBottom:16 }}>
            Create account
          </button>
          <div style={{ textAlign:'center', fontSize:13, color:t.textSub }}>
            Have an account?{' '}
            <button onClick={onLogin} style={{ background:'none', border:'none', color:t.primary, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:500, textDecoration:'underline' }}>Sign in</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PROFILE / CLIENT CABINET ──────────────────────────────
function ProfilePage({ onBack, onLogout }) {
  const { t } = useTheme();
  const [tab, setTab] = useState('history');

  const STATUS = {
    completed: { bg:t.sucCont, color:t.success, label:'Completed' },
    cancelled: { bg:t.errCont, color:t.error,   label:'Cancelled' },
  };

  return (
    <div style={{ minHeight:'100vh', background:t.bgGrad, fontFamily:'Roboto,sans-serif', display:'flex', flexDirection:'column' }}>
      <nav style={{ position:'sticky', top:0, zIndex:30, background:t.nav, backdropFilter:'blur(12px)', borderBottom:`1px solid ${t.border}` }}>
        <div style={{ maxWidth:700, margin:'0 auto', padding:'0 24px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, height:32, padding:'0 14px 0 8px', borderRadius:9999, border:`1px solid ${t.outline}`, background:'transparent', cursor:'pointer', color:t.text, fontSize:13, fontWeight:500, fontFamily:'inherit' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
          <ThemeToggleBtn />
        </div>
      </nav>
      <div style={{ maxWidth:700, margin:'0 auto', padding:'32px 24px', width:'100%' }}>
        {/* Profile header */}
        <div style={{ display:'flex', alignItems:'center', gap:20, background:t.card, border:`1px solid ${t.border}`, borderRadius:20, padding:'24px 28px', marginBottom:24, boxShadow:t.shadow }}>
          <div style={{ width:64, height:64, borderRadius:'50%', background:t.primary, display:'flex', alignItems:'center', justifyContent:'center', color:t.onPri, fontSize:24, fontWeight:400, flexShrink:0 }}>A</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:20, fontWeight:500, color:t.text }}>Anna Kowalska</div>
            <div style={{ fontSize:13, color:t.textSub, marginTop:2 }}>anna@example.com · +48 600 000 000</div>
          </div>
          <button onClick={onLogout} style={{ height:36, padding:'0 16px', borderRadius:9999, border:`1px solid ${t.outline}`, background:'transparent', color:t.textSub, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Sign out</button>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:4, marginBottom:20, background:t.surface, borderRadius:12, padding:4, border:`1px solid ${t.border}` }}>
          {[['history','Appointments'],['gdpr','Privacy & GDPR']].map(([id,label]) => (
            <button key={id} onClick={()=>setTab(id)} style={{ flex:1, height:36, borderRadius:9, border:'none', background: tab===id ? t.card : 'transparent', color: tab===id ? t.text : t.textMut, fontSize:13, fontWeight: tab===id ? 500 : 400, cursor:'pointer', fontFamily:'inherit', transition:'all 150ms', boxShadow: tab===id ? t.shadow : 'none' }}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'history' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {HISTORY.map((h, i) => {
              const s = STATUS[h.status];
              return (
                <div key={i} style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:16, padding:'16px 20px', display:'flex', alignItems:'center', gap:16, boxShadow:t.shadow }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:500, color:t.text }}>{h.service}</div>
                    <div style={{ fontSize:12, color:t.textSub, marginTop:3 }}>{h.master} · {h.date}</div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:14, fontWeight:500, color:t.text, marginBottom:4 }}>{h.price} zł</div>
                    <span style={{ fontSize:11, fontWeight:500, padding:'3px 10px', borderRadius:9999, background:s.bg, color:s.color }}>{s.label}</span>
                  </div>
                  {h.status === 'completed' && (
                    <button style={{ height:36, padding:'0 14px', borderRadius:9999, border:'none', background:t.priCont, color:t.onPriCont, fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>Repeat</button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === 'gdpr' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {[
              ['Export my data', 'Download a copy of all your personal data', 'Export'],
              ['Delete my account', 'Permanently remove all your data from our systems', 'Delete'],
              ['Withdraw consent', 'Manage your data processing consents', 'Manage'],
            ].map(([title, desc, action]) => (
              <div key={title} style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:16, padding:'18px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, boxShadow:t.shadow }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:500, color:t.text }}>{title}</div>
                  <div style={{ fontSize:12, color:t.textSub, marginTop:3 }}>{desc}</div>
                </div>
                <button style={{ height:36, padding:'0 16px', borderRadius:9999, border:`1px solid ${action==='Delete'?t.error:t.outline}`, background:'transparent', color: action==='Delete'?t.error:t.primary, fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>{action}</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { HomePage, BookingPage, LoginPage, RegisterPage, ProfilePage });
