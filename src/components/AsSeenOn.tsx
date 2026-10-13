import React, { useEffect, useRef, useState } from 'react';
import type { CommunityReel } from '../types/index.ts';
import { socialEmbedUrl } from '../utils/socialMedia.ts';

interface AsSeenOnProps {
  reels: CommunityReel[];
  onCommunityLinkClick?: () => void;
}

export const AsSeenOn:React.FC<AsSeenOnProps>=({reels,onCommunityLinkClick})=>{
  if(!reels?.length)return null;
  return <section data-reveal className="w-full max-w-[1440px] mx-auto px-[15px] md:px-6 lg:px-12 my-10 md:my-16 lg:my-20" aria-labelledby="as-seen-on-title">
    <div className="text-center mb-8">
      <h2 id="as-seen-on-title" className="text-[22px] md:text-[24px] font-medium text-[#282420] tracking-tight">As Seen On</h2>
      <button type="button" onClick={()=>onCommunityLinkClick?.()} className="mt-2 text-[14px] text-[#706861] hover:text-[#282420] transition-colors focus-visible:outline-2 focus-visible:outline-[#282420]">Worn and loved by the community &gt;</button>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1 md:gap-3">
      {reels.map(reel=><DeferredCommunityEmbed key={reel.id} reel={reel}/>)}
    </div>
  </section>;
};

const DeferredCommunityEmbed:React.FC<{reel:CommunityReel}>=({reel})=>{
  const hostRef=useRef<HTMLDivElement>(null);
  const [nearViewport,setNearViewport]=useState(false);
  useEffect(()=>{
    const host=hostRef.current;
    if(!host)return;
    if(!('IntersectionObserver' in window)){setNearViewport(true);return;}
    const observer=new IntersectionObserver(([entry])=>setNearViewport(entry.isIntersecting),{rootMargin:'300px 0px',threshold:0.01});
    observer.observe(host);
    return()=>observer.disconnect();
  },[]);
  const provider=reel.provider === 'YOUTUBE' ? 'YouTube' : reel.provider === 'INSTAGRAM' ? 'Instagram' : 'TikTok';
  return <div ref={hostRef} className="relative w-full aspect-[9/16] bg-[#F3EBDF] overflow-hidden">
    {nearViewport?<iframe src={socialEmbedUrl(reel)} title={`Konten ${provider} Defra Hijab`} className="absolute inset-0 w-full h-full border-0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin"/>:<div className="absolute inset-0 grid place-items-center text-[11px] text-[#706861]">Video dimuat saat terlihat</div>}
  </div>;
};
