import qrcode from '../vendor/qrcode.mjs';
export function qrDataUrl(text) {
  const qr=qrcode(0,'M');qr.addData(text,'Byte');qr.make();
  const count=qr.getModuleCount(),size=count+8,paths=[];
  for(let y=0;y<count;y++)for(let x=0;x<count;x++)if(qr.isDark(y,x))paths.push(`M${x+4},${y+4}h1v1h-1z`);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><path fill="white" d="M0 0h${size}v${size}H0z"/><path fill="black" d="${paths.join('')}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
