// Company branding for quotes and PDFs. Pure: no DOM. Kept in its own browser store, shared by every quote.
export const BRAND_DEFAULT = {
  company: 'Crew Table',
  tagline: 'Festival crew catering',
  colour: '#245946',
  contact: '',
  footer: '',
  logo: '',       // small PNG data URL, or ''
  logoRatio: 0    // width / height of the logo
};

export const LOGO_MAX_CHARS = 450000;

export function cleanBrand(input) {
  const b = {...BRAND_DEFAULT, ...(input && typeof input === 'object' ? input : {})};
  const text = (v, d, max) => (typeof v === 'string' ? v.slice(0, max) : d);
  const out = {
    company: text(b.company, BRAND_DEFAULT.company, 80).trim() || BRAND_DEFAULT.company,
    tagline: text(b.tagline, '', 120),
    colour: typeof b.colour === 'string' && /^#[0-9a-fA-F]{6}$/.test(b.colour) ? b.colour.toLowerCase() : BRAND_DEFAULT.colour,
    contact: text(b.contact, '', 200),
    footer: text(b.footer, '', 200),
    logo: '',
    logoRatio: 0
  };
  if (typeof b.logo === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(b.logo) && b.logo.length <= LOGO_MAX_CHARS && Number.isFinite(b.logoRatio) && b.logoRatio > 0.1 && b.logoRatio < 20) {
    out.logo = b.logo;
    out.logoRatio = b.logoRatio;
  }
  return out;
}

export const hexToRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

// Mix a colour with white. amount 0 = the colour, 1 = white.
export function tint(hex, amount) {
  const [r, g, b] = hexToRgb(hex);
  const mix = v => Math.round(v + (255 - v) * amount);
  return '#' + [mix(r), mix(g), mix(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

// White text on dark brand colours, near-black on light ones.
export function contrastText(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.35 ? '#1f2a2d' : '#ffffff';
}
