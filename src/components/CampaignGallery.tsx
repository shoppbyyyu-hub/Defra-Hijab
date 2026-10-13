import React from 'react';
import type { CampaignGalleryItem } from '../types/index.ts';

interface CampaignGalleryProps {
  gallery: CampaignGalleryItem[];
}

export const CampaignGallery: React.FC<CampaignGalleryProps> = ({ gallery }) => {
  if (!gallery || gallery.length === 0) return null;

  // Expected default: 1 landscape (2:1) and 2 portrait (4:5)
  const landscape = gallery.find((g) => g.aspectRatio === '2:1');
  const portraits = gallery.filter((g) => g.aspectRatio === '4:5').slice(0, 2);

  return (
    <section data-reveal className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 my-12 md:my-16 lg:my-20" aria-label="Galeri Kampanye">
      {/* Desktop / Tablet Composition: 1 Landscape (2:1) + 2 Portrait (4:5) with 16px gap */}
      <div className="hidden md:flex flex-col gap-4">
        {landscape && (
          <div className="w-full aspect-[2/1] bg-[#F3EBDF] overflow-hidden">
            <img
              src={landscape.imageUrl}
              alt="Defra Campaign Feature"
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {portraits.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            {portraits.map((item) => (
              <div key={item.id} className="w-full aspect-[4/5] bg-[#F3EBDF] overflow-hidden">
                <img
                  src={item.imageUrl}
                  alt="Defra Editorial Look"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mobile: landscape penuh lalu dua portrait berdampingan */}
      <div className="md:hidden space-y-3">
        {landscape && <div className="w-full aspect-[2/1] overflow-hidden"><img src={landscape.imageUrl} alt="Campaign Defra Hijab" loading="lazy" decoding="async" className="w-full h-full object-cover" /></div>}
        {portraits.length > 0 && <div className="grid grid-cols-2 gap-3">
          {portraits.map(item=><div key={item.id} className="w-full aspect-[4/5] overflow-hidden"><img src={item.imageUrl} alt="Campaign Defra Hijab" loading="lazy" decoding="async" className="w-full h-full object-cover" /></div>)}
        </div>}
      </div>
    </section>
  );
};
