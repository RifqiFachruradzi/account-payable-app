// Menyalin aset OCR (worker, core WASM, model bahasa) ke public/ agar OCR
// dapat berjalan tanpa akses CDN (mis. jaringan intranet perusahaan).
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const nm = join(root, 'node_modules')
const out = join(root, 'public', 'tesseract')
mkdirSync(join(out, 'core'), { recursive: true })
mkdirSync(join(out, 'lang'), { recursive: true })

cpSync(join(nm, 'tesseract.js', 'dist', 'worker.min.js'), join(out, 'worker.min.js'))
for (const f of readdirSync(join(nm, 'tesseract.js-core'))) {
  if (/^tesseract-core.*lstm\.wasm\.js$/.test(f)) cpSync(join(nm, 'tesseract.js-core', f), join(out, 'core', f))
}
const lang = join(nm, '@tesseract.js-data', 'eng', '4.0.0_best_int', 'eng.traineddata.gz')
if (existsSync(lang)) cpSync(lang, join(out, 'lang', 'eng.traineddata.gz'))
console.log('OCR assets copied to public/tesseract')
