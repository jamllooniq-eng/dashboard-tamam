import React, { useState, useEffect, useCallback, useRef } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ShoppingBag } from 'lucide-react';
import { getGalleryImage, GALLERY_IMAGE_SIZES } from '../../lib/image';

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

  // Each image is offered in several widths (srcSet): the phone downloads the smallest one that is
  // still sharp for its screen. Same definition as the <head> preload, so the main image downloads once.
  const galleryImages = allImages.map((img) => getGalleryImage(img));

  // The main (first) image gets the whole connection: the other photos have NO src until it has
  // finished loading (also on the server-rendered HTML), then they load in the background so they
  // are ready when the customer swipes.
  const [restReady, setRestReady] = useState(false);
  const mainImgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = mainImgRef.current;
    if (!img || img.complete) {
      setRestReady(true);
      return;
    }
    const done = () => setRestReady(true);
    img.addEventListener('load', done);
    img.addEventListener('error', done);
    // Safety net: never keep the other photos waiting forever on a very slow connection
    const timer = setTimeout(done, 4000);
    return () => {
      img.removeEventListener('load', done);
      img.removeEventListener('error', done);
      clearTimeout(timer);
    };
  }, []);

  // Keep React state in sync with Embla's own selected slide
  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      const idx = emblaApi.selectedScrollSnap();
      setSelectedIndex(idx);
      if (idx > 0) setRestReady(true); // customer swiped early: load the photos now
    };
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
                    ref={idx === 0 ? mainImgRef : undefined}
                    src={idx === 0 || restReady ? galleryImages[idx].src : undefined}
                    srcSet={idx === 0 || restReady ? galleryImages[idx].srcSet : undefined}
                    sizes={GALLERY_IMAGE_SIZES}
                    width={800}
                    height={800}
                    alt={`${title} - صورة ${idx + 1}`}
                    fetchPriority={idx === 0 ? 'high' : 'low'}
                    loading={idx === 0 ? 'eager' : 'lazy'}
                    referrerPolicy="no-referrer"
                    decoding="async"
                    draggable={false}
                    className="w-full h-full object-cover object-center"
                    onError={(e) => {
                      // Image CDN failed: fall back to the original image (srcset must go too,
                      // otherwise the browser keeps choosing from it)
                      const target = e.currentTarget;
                      if (img && target.src !== img) {
                        target.removeAttribute('srcset');
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
