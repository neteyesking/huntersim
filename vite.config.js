import {defineConfig} from 'vite';
import {randomUUID} from 'node:crypto';
import {startRelease} from './tools/release-loader.js';
export default defineConfig(({command})=>{
 const id=command==='serve'?'development':process.env.HUNTER_RELEASE_ID||'local-'+Date.now()+'-'+randomUUID().slice(0,8);
 return {
  define:{__HUNTER_BUILD_ID__:JSON.stringify(id)},
  plugins:[{
   name:'release-loader',apply:'build',enforce:'post',
   generateBundle(_options,bundle){
    const html=bundle['index.html'];
    const entry=Object.values(bundle).find(asset=>asset.type==='chunk'&&asset.isEntry);
    if(!html||!entry)throw Error('Missing game entry');
    const release={id,entry:entry.fileName,css:[...entry.viteMetadata.importedCss]};
    this.emitFile({type:'asset',fileName:'release.json',source:JSON.stringify(release)+'\n'});
    let source=String(html.source).replace(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*rel="(?:stylesheet|modulepreload)"[^>]*>/g,'');
    const loader='('+startRelease.toString()+')('+JSON.stringify(release).replaceAll('<','\\u003c')+');';
    html.source=source.replace('</body>','<script type="module">'+loader+'</script></body>');
   },
  }],
 };
});
