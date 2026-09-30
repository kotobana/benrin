import {defineConfig} from 'vite';
export default defineConfig({build:{outDir:'.worker',target:'es2022',lib:{entry:'server/index.ts',formats:['es'],fileName:()=> 'index.js'},minify:false}});
