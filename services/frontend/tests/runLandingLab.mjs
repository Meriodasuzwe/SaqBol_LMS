import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer,build} from 'vite';
import react from '@vitejs/plugin-react';
const frontend=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const config={configFile:false,envDir:false,envPrefix:'__LANDING_LAB_UNUSED__',root:resolve(frontend,'tests/landing-lab'),publicDir:false,plugins:[react()],server:{host:'127.0.0.1',port:4184,strictPort:true,open:false,headers:{'Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ws://127.0.0.1:4184; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'none'"}},build:{outDir:resolve(frontend,'dist/landing-lab'),emptyOutDir:false}};
if(process.argv.includes('--build')){await build(config)}else{const server=await createServer(config);await server.listen();console.log('SAQBol landing concept: http://127.0.0.1:4184')}
