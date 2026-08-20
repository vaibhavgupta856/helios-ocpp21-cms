import fs from 'fs';
import path from 'path';

const STORE_PATH = process.env.HELIOS_STORE
  ? path.resolve(process.env.HELIOS_STORE)
  : path.join(process.cwd(), 'data', 'helios-operator.json');

let timer = null;

export function loadOperatorStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return null;
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

export function saveOperatorStore(data) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
      fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
    } catch (err) {
      console.warn(`Could not persist operator store: ${err.message}`);
    }
  }, 120);
}
