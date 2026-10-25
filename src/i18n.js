import { load, save } from './storage.js';

let lang = load('lang', 'bn');

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
export const num = (n) => (lang === 'bn' ? String(n).replace(/\d/g, (d) => BN_DIGITS[d]) : String(n));

const STR = {
  title: { bn: 'লেগুনা মামা', en: 'Leguna Mama' },
  subtitle: { bn: 'ফর্মুলা F1', en: 'Formula F1' },
  route: { bn: 'ফার্মগেট → মোহাম্মদপুর বাসস্ট্যান্ড', en: 'Farmgate → Mohammadpur Bus Stand' },
  play: { bn: 'চলেন মামা!', en: "Let's go, Mama!" },
  controls: {
    bn: 'বামে/ডানে ট্যাপ বা সোয়াইপ · নিচে সোয়াইপ = ব্রেক\nকিবোর্ড: ← → বা A / D · ব্রেক ↓ বা S',
    en: 'Tap or swipe left / right · swipe down = brake\nKeyboard: ← → or A / D · brake ↓ or S',
  },
  tip: { bn: 'যাত্রী তুলেন, গর্ত-পানি-গরু এড়ান!', en: 'Pick up passengers, dodge puddles and cows!' },
  // On-screen hint the first time the light turns red in a run (touch, keyboard)
  brakeHint: { bn: 'নিচে সোয়াইপ = ব্রেক ⬇️', en: 'Swipe down = brake ⬇️' },
  brakeHintKeys: { bn: '↓ বা S চেপে ধরেন = ব্রেক', en: 'Hold ↓ or S = brake' },
  best: { bn: 'সেরা সময়', en: 'Best time' },
  time: { bn: 'সময়', en: 'Time' },
  fare: { bn: 'ভাড়া', en: 'Fare' },
  crashes: { bn: 'ধাক্কা', en: 'Crashes' },
  fine: { bn: 'জরিমানা', en: 'Fine' },
  closeCalls: { bn: 'ঝুঁকি পাস', en: 'Close calls' },
  sec: { bn: 'সেকেন্ড', en: 's' },
  finished: { bn: 'পৌঁছাইসি!', en: 'Made it!' },
  newBest: { bn: 'নতুন রেকর্ড!', en: 'New record!' },
  again: { bn: 'মামা, আর একবার!', en: 'One more, Mama!' },
  share: { bn: 'শেয়ার করেন', en: 'Share' },
  menu: { bn: 'মেনু', en: 'Menu' },
  saved: { bn: 'ছবি সেভ হইসে!', en: 'Image saved!' },
  langToggle: { bn: 'English', en: 'বাংলা' },
  shareLine1: { bn: 'আমি ফার্মগেট থেকে মোহাম্মদপুর', en: 'I made it Farmgate → Mohammadpur' },
  shareLine2: { bn: '{t} সেকেন্ডে পৌঁছাইসি 🛺', en: 'in {t} seconds 🛺' },
  shareLine3: { bn: 'তুমি পারবা?', en: 'Can you beat it?' },
};

export function t(key, vars = {}) {
  const s = STR[key]?.[lang] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

export const getLang = () => lang;
export const pick = (obj) => obj?.[lang] ?? obj?.bn ?? '';

export function toggleLang() {
  lang = lang === 'bn' ? 'en' : 'bn';
  save('lang', lang);
  document.documentElement.lang = lang;
}

// Seconds with one decimal, in the current language's digits
export const fmtTime = (s) => num(s.toFixed(1));
