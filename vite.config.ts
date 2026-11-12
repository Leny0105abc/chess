import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'

const engineSource='node_modules/stockfish/src'
const files=()=>readdirSync(engineSource).filter(name=>name.includes('lite-single'))
const prepareEngine=()=>{
  mkdirSync('public/engine',{recursive:true})
  for(const file of files())if(!existsSync('public/engine/'+file))copyFileSync(engineSource+'/'+file,'public/engine/'+file)
  copyFileSync('node_modules/stockfish/Copying.txt','public/engine/COPYING.txt')
}
export default defineConfig({
  plugins:[react(),tailwind(),{
    name:'academy-assets',
    configResolved(){prepareEngine()},
    closeBundle(){
      const root=resolve('dist')
      if(!existsSync(root+'/index.html'))return
      const list=(dir:string):string[]=>readdirSync(root+dir).flatMap(name=>{
        const path=dir+'/'+name
        if(path==='/sw.js'||path==='/engine')return []
        return statSync(root+path).isDirectory()?list(path):[path]
      })
      const assets=list('')
      const version=createHash('sha256')
      for(const asset of assets)version.update(asset).update(readFileSync(root+asset))
      const template=readFileSync('scripts/sw-template.js','utf8')
      writeFileSync(root+'/sw.js',template.replace('__VERSION__',version.digest('hex').slice(0,16)).replace('__ASSETS__',JSON.stringify(assets)))
    }
  }],
  build:{rollupOptions:{output:{manualChunks:{supabase:['@supabase/supabase-js']}}}},
  server:{host:'127.0.0.1'}
})
