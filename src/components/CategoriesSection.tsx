import React from 'react';
import type { Category } from '../types/index.ts';

interface CategoriesProps {
  categories: Category[];
  onSelectCategory: (categoryId: string) => void;
}

export const CategoriesSection: React.FC<CategoriesProps> = ({ categories, onSelectCategory }) => {
  if (!categories || categories.length === 0) return null;

  return (
    <section data-reveal className="w-full max-w-[1440px] mx-auto px-2 md:px-6 lg:px-12 my-10 md:my-16 lg:my-20">
      {/* Heading: Centered 22px, jarak heading ke grid 28px */}
      <h2 className="text-[22px] md:text-[24px] font-medium text-[#282420] text-center mb-[28px] tracking-tight">
        Shop by Categories
      </h2>

      {/* Grid: HP 2 kolom sama lebar (baris otomatis ke bawah, tanpa scroll horizontal), Tablet 3 kolom, Desktop 4 kolom */}
      {/* Mobile: Gutter 8px (px-2 di container), gap kolom 12px, gap baris 20px */}
      {/* Desktop / Tablet: gap-6 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-[12px] gap-y-[20px] md:gap-6">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelectCategory(cat.id)}
            className="group flex flex-col text-left focus-visible:outline-2 focus-visible:outline-[#282420]"
          >
            {/* Foto landscape rasio 2:1, sudut siku (0px), tanpa border/shadow */}
            <div className="w-full aspect-[2/1] bg-[#F3EBDF] overflow-hidden rounded-none">
              <img
                src={cat.imageUrl}
                alt={cat.name}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
              />
            </div>

            {/* Label kategori centered 8px di bawah, Poppins 12-13px */}
            <span className="mt-2 text-[12px] sm:text-[13px] font-medium text-[#282420] text-center group-hover:text-[#B88770] transition-colors leading-snug">
              {cat.name}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
};
