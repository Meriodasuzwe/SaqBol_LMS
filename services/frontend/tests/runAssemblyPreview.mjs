import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
const frontend=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const server=await createServer({configFile:false,envDir:false,envPrefix:'__BANK_PREVIEW_UNUSED__',root:resolve(frontend,'tests/assembly-preview'),publicDir:false,plugins:[react(),tailwindcss()],server:{host:'127.0.0.1',port:4183,strictPort:true,open:false,fs:{allow:[frontend]},headers:{'Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://127.0.0.1:4183; font-src 'self'; frame-src 'none'"}}});
await server.listen();console.log('Synthetic assembly preview: http://127.0.0.1:4183');
