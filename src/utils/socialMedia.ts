export type SocialProvider='YOUTUBE'|'INSTAGRAM'|'TIKTOK';

export interface ParsedSocialMedia {
  provider:SocialProvider;
  externalId:string;
  sourceUrl:string;
}

const cleanUrl=(url:URL)=>{url.hash='';return url.toString();};

export function parseSocialMediaUrl(input:string):ParsedSocialMedia{
  let url:URL;
  try{url=new URL(input.trim());}catch{throw new Error('Link media sosial tidak valid.');}
  if(url.protocol!=='https:')throw new Error('Link harus menggunakan HTTPS.');
  const host=url.hostname.toLowerCase().replace(/^www\./,'');
  let match:RegExpMatchArray|null;
  if(host==='youtu.be'){
    const id=url.pathname.split('/').filter(Boolean)[0];
    if(!id||!/^[A-Za-z0-9_-]{6,15}$/.test(id))throw new Error('ID video YouTube tidak valid.');
    return {provider:'YOUTUBE',externalId:id,sourceUrl:`https://youtu.be/${id}`};
  }
  if(host==='youtube.com'||host==='m.youtube.com'){
    const parts=url.pathname.split('/').filter(Boolean);
    const id=url.pathname==='/watch'?url.searchParams.get('v'):['shorts','embed','live'].includes(parts[0])?parts[1]:null;
    if(!id||!/^[A-Za-z0-9_-]{6,15}$/.test(id))throw new Error('Link video YouTube tidak didukung.');
    return {provider:'YOUTUBE',externalId:id,sourceUrl:`https://www.youtube.com/watch?v=${id}`};
  }
  if(host==='instagram.com'){
    match=url.pathname.match(/^\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)\/?$/);
    if(!match)throw new Error('Gunakan link post, reel, atau video Instagram resmi.');
    return {provider:'INSTAGRAM',externalId:match[1],sourceUrl:`https://www.instagram.com/reel/${match[1]}/`};
  }
  if(host==='tiktok.com'||host==='m.tiktok.com'){
    match=url.pathname.match(/^\/@[^/]+\/video\/(\d+)\/?$/);
    if(!match)throw new Error('Gunakan link video TikTok lengkap, bukan link pendek.');
    return {provider:'TIKTOK',externalId:match[1],sourceUrl:cleanUrl(url)};
  }
  throw new Error('Link harus berasal dari YouTube, Instagram, atau TikTok resmi.');
}

export function socialEmbedUrl(item:Pick<ParsedSocialMedia,'provider'|'externalId'|'sourceUrl'>){
  if(item.provider==='YOUTUBE')return `https://www.youtube-nocookie.com/embed/${item.externalId}?autoplay=1&mute=1&loop=1&playlist=${item.externalId}&controls=1&playsinline=1&rel=0`;
  if(item.provider==='INSTAGRAM')return `https://www.instagram.com/p/${item.externalId}/embed/`;
  return `https://www.tiktok.com/player/v1/${item.externalId}?autoplay=1&muted=1&loop=1&controls=1&progress_bar=1&play_button=1&volume_control=1`;
}
