import React, { useState, useEffect, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ShoppingBag } from 'lucide-react';
import { getOptimizedImageUrl } from '../../lib/image';

interface ProductGalleryProps {
  images?: string[];
  mainImage: string;
  title: string;
}

export const ProductGallery: React.FC<ProductGalleryProps> = ({
  images = [],
  mainImage,
  title,
}) => {
  // Deduplicate and filter non-empty images
  const allImages = Array.from(new Set([mainImage, ...images].filter(Boolean)));
  const total = allImages.length;

  // Embla configured with direction: 'rtl' only — matches the site's Arabic
  // layout so drag/swipe direction feels natural. No extra options beyond what's
  // needed, to keep this as simple and low-risk as possible.
  const [emblaRef, emblaApi] = useEmblaCarousel({
    direction: 'rtl',
    loop: false,
  });

  const [selectedIndex, setSelectedIndex] = useState(0);

  // All images use the same reduced quality (72 instead of 80) — a real,
  // measurable reduction in file size with no visible difference on a phone
  // screen. Every image loads normally; no selective eager/lazy logic, which
  // is what caused the smoothness regressions in earlier, more complex attempts.
  const proxiedUrls = allImages.map((img) =>
    getOptimizedImageUrl(img, { width: 800, quality: 72, fit: 'contain' })
  );

  // Keep React state in sync with Embla's own selected slide
  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);
    onSelect();
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi]);

  const goToIndex = useCallback(
    (idx: number) => {
      emblaApi?.scrollTo(idx);
    },
    [emblaApi]
  );

  return (
    <div id="product-gallery" className="w-full max-w-[480px] mx-auto select-none">
      {/* 1. Square 1:1 Image Box — Embla-powered sliding track */}
      <div className="relative w-full aspect-square bg-gray-100 rounded-[18px] border border-[#E5E5E5] shadow-xs overflow-hidden">
        {allImages.length > 0 ? (
          <div className="overflow-hidden h-full" ref={emblaRef} style={{ touchAction: 'pan-y' }}>
            <div className="flex h-full">
              {allImages.map((img, idx) => (
                <div key={img + idx} className="relative h-full shrink-0 grow-0 basis-full">
                  <img
                    src={proxiedUrls[idx]}
                    alt={`${title} - صورة ${idx + 1}`}
                    fetchPriority={idx === 0 ? 'high' : 'auto'}
                    loading="eager"
                    referrerPolicy="no-referrer"
                    decoding="async"
                    draggable={false}
                    className="w-full h-full object-cover object-center"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (img && target.src !== img) {
                        target.src = img;
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50">
            <ShoppingBag className="w-16 h-16 mb-2 opacity-30" />
            <span className="text-xs font-semibold">صورة المنتج غير متوفرة</span>
          </div>
        )}

        {/* Clear & Prominent White Dots Indicator */}
        {total > 1 && (
          <div
            className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center justify-center gap-1.5 z-10 pointer-events-auto"
            role="tablist"
            aria-label="صور المنتج"
          >
            {allImages.map((_, idx) => {
              const isActive = selectedIndex === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`عرض الصورة ${idx + 1} من ${total}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    goToIndex(idx);
                  }}
                  className={`transition-all duration-300 cursor-pointer rounded-full p-0 border-none outline-none shadow-sm ${
                    isActive
                      ? 'w-6 h-2 bg-white ring-1 ring-black/20 shadow-md'
                      : 'w-2 h-2 bg-white/70 hover:bg-white ring-1 ring-black/10'
                  }`}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
