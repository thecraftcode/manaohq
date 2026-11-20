import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fix for Turbopack Windows process.cwd() bug
if (process.cwd() === 'E:\\' || process.cwd() === 'e:\\') {
  try {
    process.chdir(__dirname);
  } catch (e) { }
}

const config = {
  plugins: {
    "@tailwindcss/postcss": {
      base: __dirname
    },
  },
};

export default config;
