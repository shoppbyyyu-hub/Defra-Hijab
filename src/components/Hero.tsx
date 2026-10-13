import React from 'react';
import type { HeroBanner } from '../types/index.ts';
import desktopFallback from '../assets/images/hero_defra_hijab_1791700536382.jpg';
import mobileFallback from '../assets/images/hero_mobile_portrait_1791733702637.jpg';

interface HeroProps {
  banner?: HeroBanner;
  loading?: boolean;
}

export const Hero: React.FC<HeroProps> = ({ banner, loading = false }) => {
  const desktopImg = banner?.desktopImageUrl || desktopFallback;
  const mobileImg = banner?.mobileImageUrl || mobileFallback;
  const focalX = banner?.focalX ?? 50;
  const focalY = banner?.focalY ?? 50;
  const mobileFocalX = banner?.mobileFocalX ?? (banner?.focalX ?? 50);
  const mobileFocalY = banner?.mobileFocalY ?? (banner?.focalY ?? 50);

  return (
    <section data-reveal className="w-full overflow-hidden" aria-label="Kampanye Utama">
      {/* Container Full Bleed — Bebas Teks Mutlak Sesuai design.md */}
      <div className="w-full relative aspect-[4/5] md:aspect-[2/1] bg-[#F3EBDF]">
        {loading ? <div aria-label="Memuat campaign utama" className="defra-skeleton absolute inset-0 bg-[#F3EBDF]"/> : <picture>
          <source media="(max-width: 767px)" srcSet={mobileImg} />
          <img
            src={desktopImg}
            alt="Defra Hijab Campaign"
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="hero-campaign-image absolute inset-0 w-full h-full object-cover rounded-none"
            style={{
              '--hero-desktop-position': `${focalX}% ${focalY}%`,
              '--hero-mobile-position': `${mobileFocalX}% ${mobileFocalY}%`
            } as React.CSSProperties}
          />
        </picture>}
      </div>
    </section>
  );
};
