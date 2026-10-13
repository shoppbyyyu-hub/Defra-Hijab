import {parseSocialMediaUrl,socialEmbedUrl} from '../src/utils/socialMedia.ts';

const cases=[
  ['https://www.youtube.com/watch?v=dQw4w9WgXcQ','YOUTUBE'],
  ['https://www.instagram.com/reel/C8Example_1/','INSTAGRAM'],
  ['https://www.tiktok.com/@creator/video/7412345678901234567','TIKTOK']
] as const;

for(const [url,provider] of cases){const parsed=parseSocialMediaUrl(url);if(parsed.provider!==provider||!parsed.externalId||!socialEmbedUrl(parsed).startsWith('https://'))throw new Error(`Parsing ${provider} gagal.`);}
for(const invalid of ['<iframe src="https://youtube.com"></iframe>','http://youtube.com/watch?v=dQw4w9WgXcQ','https://example.com/video/1','https://vm.tiktok.com/abc/']){let rejected=false;try{parseSocialMediaUrl(invalid);}catch{rejected=true;}if(!rejected)throw new Error(`Link tidak valid diterima: ${invalid}`);}
console.log(JSON.stringify({validProviders:cases.map(item=>item[1]),invalidRejected:4}));
