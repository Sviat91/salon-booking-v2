// shared.jsx — Theme system + shared micro-components
// Somique Beauty — must load first

const { useState, useEffect, useContext, createContext } = React;

// ── Theme tokens ──────────────────────────────────────────
const T = {
  light: {
    bg:       '#FFF8F6',
    bgGrad:   'radial-gradient(ellipse 140% 55% at 15% -5%, #FFD9DC 0%, #FFF8F6 58%)',
    nav:      'rgba(255,248,246,.92)',
    card:     '#FFFFFF',
    cardHov:  '#FFF5F5',
    surface:  '#FFF0F1',
    surfaceHi:'#F3E3E4',
    border:   '#EDE1E1',
    text:     '#211A1B',
    textSub:  '#524344',
    textMut:  '#857374',
    primary:  '#8B4A58',
    priCont:  '#FFD9DC',
    onPri:    '#FFFFFF',
    onPriCont:'#3B0017',
    secCont:  '#FFDCCA',
    onSecCont:'#2F1509',
    input:    '#EDE1E1',
    outline:  '#D8C2C3',
    shadow:   '0 1px 3px rgba(0,0,0,.08)',
    shadow2:  '0 2px 8px rgba(0,0,0,.1)',
    success:  '#21A67A',
    sucCont:  '#B7F2DC',
    error:    '#BA1A1A',
    errCont:  '#FFDAD6',
  },
  dark: {
    bg:       '#9C6849',
    bgGrad:   'radial-gradient(ellipse 140% 55% at 15% -5%, #6A3020 0%, #9C6849 60%)',
    nav:      'rgba(26,16,10,.88)',
    card:     '#221810',
    cardHov:  '#2E1E14',
    surface:  '#2E1E14',
    surfaceHi:'#3A2820',
    border:   '#4A3028',
    text:     '#FFEEE8',
    textSub:  '#CCA898',
    textMut:  '#906858',
    primary:  '#FFB2B8',
    priCont:  '#723340',
    onPri:    '#3B0017',
    onPriCont:'#FFD9DC',
    secCont:  '#634432',
    onSecCont:'#FFDCCA',
    input:    '#3A2820',
    outline:  '#5A3828',
    shadow:   '0 2px 8px rgba(0,0,0,.25)',
    shadow2:  '0 4px 16px rgba(0,0,0,.3)',
    success:  '#6EDDAC',
    sucCont:  '#003824',
    error:    '#FFB4AB',
    errCont:  '#93000A',
  },
};

const ThemeCtx = createContext({ dark: false, toggle: () => {}, t: T.light });
const useTheme = () => useContext(ThemeCtx);

function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('sb-theme') === 'dark'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('sb-theme', dark ? 'dark' : 'light'); } catch {}
  }, [dark]);
  const t = dark ? T.dark : T.light;
  return <ThemeCtx.Provider value={{ dark, toggle: () => setDark(d => !d), t }}>{children}</ThemeCtx.Provider>;
}

// ── Shared micro-components ───────────────────────────────
function ThemeToggleBtn() {
  const { dark, toggle, t } = useTheme();
  return (
    <button onClick={toggle} title="Toggle theme" style={{ width:36, height:36, borderRadius:9999, border:`1px solid ${t.outline}`, background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:t.textSub, flexShrink:0 }}>
      {dark
        ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
        : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      }
    </button>
  );
}

function LangBtn() {
  const { t } = useTheme();
  return <button style={{ height:36, padding:'0 12px', borderRadius:9999, border:`1px solid ${t.outline}`, background:'transparent', color:t.textSub, fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>PL</button>;
}

function UserAvatarBtn({ onLogin, onProfile, isLoggedIn }) {
  const { t } = useTheme();
  return (
    <button onClick={() => isLoggedIn ? onProfile() : onLogin()} style={{ width:36, height:36, borderRadius:9999, border:'none', background:t.primary, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:t.onPri, fontSize:13, fontWeight:500, flexShrink:0 }}>
      {isLoggedIn ? 'A' : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
    </button>
  );
}

function Chip({ label, color, bg }) {
  return <span style={{ display:'inline-flex', alignItems:'center', height:28, padding:'0 12px', borderRadius:8, background:bg, color:color, fontSize:12, fontWeight:500 }}>{label}</span>;
}

function Btn({ children, onClick, disabled, variant='filled', style: extraStyle = {} }) {
  const { t } = useTheme();
  const base = { display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, height:44, padding:'0 24px', borderRadius:9999, border:'none', cursor:disabled?'not-allowed':'pointer', fontFamily:'inherit', fontSize:14, fontWeight:500, letterSpacing:'.007em', transition:'all 180ms', opacity:disabled?.45:1, position:'relative', overflow:'hidden', ...extraStyle };
  const styles = {
    filled:   { ...base, background:t.primary, color:t.onPri, boxShadow:disabled?'none':t.shadow },
    outlined: { ...base, background:'transparent', color:t.primary, border:`1px solid ${t.outline}` },
    tonal:    { ...base, background:t.priCont, color:t.onPriCont },
  };
  return <button disabled={disabled} onClick={onClick} style={styles[variant] || styles.filled}>{children}</button>;
}

function SectionLabel({ children, t }) {
  return <div style={{ fontSize:11, fontWeight:500, letterSpacing:'.05em', textTransform:'uppercase', color:t.textMut, marginBottom:10 }}>{children}</div>;
}

function LogoImg({ height = 32, dark: isDark }) {
  return (
    <img
      src={isDark ? '../../assets/head_logo_night.png' : '../../assets/head_logo.png'}
      alt="Somique Beauty"
      style={{ height, width:'auto', display:'block' }}
    />
  );
}

Object.assign(window, { ThemeProvider, useTheme, ThemeToggleBtn, LangBtn, UserAvatarBtn, Chip, Btn, SectionLabel, LogoImg, T });
