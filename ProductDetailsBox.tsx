import React, { useMemo } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Check,
  Package,
  Sparkles,
  Layers,
  Sliders,
  CheckCheck,
  FileText
} from 'lucide-react';

interface ProductDetailsBoxProps {
  title?: string;
  description?: string;
  features?: string[];
  variant?: 'full' | 'header' | 'body';
}

interface ParsedSection {
  title?: string;
  type: 'intro' | 'features' | 'specs' | 'box';
  items: Array<{ key?: string; text: string }>;
}

export const ProductDetailsBox: React.FC<ProductDetailsBoxProps> = ({
  title = '',
  description = '',
  features = [],
  variant = 'full',
}) => {
  // Parse description intelligently without losing any words or text
  const { introText, sections, allPoints } = useMemo(() => {
    if (!description && (!features || features.length === 0)) {
      return { introText: '', sections: [], allPoints: [] };
    }

    const rawLines = (description || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const parsedSections: ParsedSection[] = [];
    let currentSection: ParsedSection = {
      type: 'features',
      items: [],
    };

    let firstLineIntro = '';

    rawLines.forEach((line, index) => {
      // Clean leading bullet marks / numbers / dots
      const cleanLine = line.replace(/^[.،•\-\*+✔✓\s]+/, '').trim();
      if (!cleanLine) return;

      // Section header detection
      if (
        /^(محتويات\s*العلبة|محتويات\s*الصندوق|مرفقات\s*المنتج|محتوى\s*العلبة|المرفقات)/i.test(
          cleanLine
        )
      ) {
        if (currentSection.items.length > 0) {
          parsedSections.push(currentSection);
        }
        currentSection = {
          title: cleanLine.replace(/[:：]/g, '').trim(),
          type: 'box',
          items: [],
        };
        return;
      }

      if (
        /^(المواصفات\s*الفنية|المواصفات|المعايير\s*الفنية|المواصفات\s*الرئيسية|بيانات\s*المنتج)/i.test(
          cleanLine
        )
      ) {
        if (currentSection.items.length > 0) {
          parsedSections.push(currentSection);
        }
        currentSection = {
          title: cleanLine.replace(/[:：]/g, '').trim(),
          type: 'specs',
          items: [],
        };
        return;
      }

      if (
        /^(المميزات|مميزات\s*المنتج|أبرز\s*المميزات|خصائص\s*المنتج)/i.test(
          cleanLine
        )
      ) {
        if (currentSection.items.length > 0) {
          parsedSections.push(currentSection);
        }
        currentSection = {
          title: cleanLine.replace(/[:：]/g, '').trim(),
          type: 'features',
          items: [],
        };
        return;
      }

      // Check if line is a Key-Value pair (e.g., 'الموديل: E-17', 'القدرة: 2400 واط')
      const colonIndex = cleanLine.indexOf(':');
      if (colonIndex > 1 && colonIndex < 35 && cleanLine.length < 90) {
        const key = cleanLine.slice(0, colonIndex).trim();
        const text = cleanLine.slice(colonIndex + 1).trim();
        currentSection.items.push({ key, text });
      } else {
        currentSection.items.push({ text: cleanLine });
      }
    });

    if (currentSection.items.length > 0) {
      parsedSections.push(currentSection);
    }

    // Also include extra unique features if provided separately
    const existingTexts = new Set(
      rawLines.map((l) => l.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, ''))
    );
    const extraFeatures = (features || []).filter((f) => {
      const clean = String(f || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\u0600-\u06FF]/g, '');
      return clean.length > 0 && !existingTexts.has(clean);
    });

    if (extraFeatures.length > 0) {
      parsedSections.push({
        title: 'مميزات إضافية',
        type: 'features',
        items: extraFeatures.map((f) => ({ text: f })),
      });
    }

    return { introText: firstLineIntro, sections: parsedSections, allPoints: rawLines };
  }, [description, features]);

  if (!title && sections.length === 0 && !description) {
    return null;
  }

  const showHeader = variant === 'full' || variant === 'header';
  const showBody = variant === 'full' || variant === 'body';

  return (
    <div
      id={`product-details-box-${variant}`}
      className="rounded-2xl bg-white border border-gray-200/90 p-4 sm:p-6 shadow-sm space-y-5"
    >
      {/* 1. Product Title Heading */}
      {showHeader && title && (
        <div className={`space-y-3.5 min-w-0 ${showBody ? 'pb-4 border-b border-gray-100' : ''}`}>
          <h1
            id={`product-title-heading-${variant}`}
            className="text-base sm:text-xl md:text-2xl font-black text-gray-900 leading-snug tracking-tight break-words"
          >
            {title}
          </h1>

          {/* 2. Trust Badges Row */}
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 bg-[#22A39E]/[0.05] border border-[#22A39E]/15 rounded-xl py-2 px-2 sm:px-3 text-center min-w-0">
              <ShieldCheck className="w-4 h-4 text-[#22A39E] shrink-0" />
              <span className="text-[11px] sm:text-xs md:text-sm font-bold text-gray-800 truncate">
                منتج أصلي 100%
              </span>
            </div>
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 bg-[#22A39E]/[0.05] border border-[#22A39E]/15 rounded-xl py-2 px-2 sm:px-3 text-center min-w-0">
              <CheckCircle2 className="w-4 h-4 text-[#22A39E] shrink-0" />
              <span className="text-[11px] sm:text-xs md:text-sm font-bold text-gray-800 truncate">
                فحص قبل الاستلام
              </span>
            </div>
          </div>
        </div>
      )}

      {showBody && (
        <>
          {/* 3. Section Title Indicator — bigger, bolder, more prominent header bar */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#22A39E]/10 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-[#22A39E]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg md:text-xl font-black text-gray-900 truncate">
                تفاصيل ومواصفات المنتج
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22A39E] animate-pulse shrink-0"></span>
                <span className="text-[11px] sm:text-xs font-semibold text-gray-500">
                  كل ما تحتاج معرفته قبل الطلب
                </span>
              </div>
            </div>
          </div>

          {/* 4. Structured & High-Readability Product Details */}
          <div className="space-y-4 min-w-0">
            {sections.length > 0 ? (
              sections.map((sec, secIdx) => (
                <div key={secIdx} className="space-y-2.5 min-w-0">
                  {/* Optional Subsection Header */}
                  {sec.title && (
                    <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-[#177773] bg-[#22A39E]/[0.08] border border-[#22A39E]/25 px-3 py-2 rounded-xl w-fit max-w-full">
                      {sec.type === 'box' ? (
                        <Package className="w-4 h-4 shrink-0" />
                      ) : sec.type === 'specs' ? (
                        <Sliders className="w-4 h-4 shrink-0" />
                      ) : (
                        <Sparkles className="w-4 h-4 shrink-0" />
                      )}
                      <span className="break-words">{sec.title}</span>
                    </div>
                  )}

                  {/* Box Contents Render */}
                  {sec.type === 'box' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-amber-50/60 border border-amber-200/70 p-3.5 rounded-2xl">
                      {sec.items.map((item, iIdx) => (
                        <div
                          key={iIdx}
                          className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-800 min-w-0"
                        >
                          <div className="w-5 h-5 rounded-full bg-amber-200/80 flex items-center justify-center text-amber-800 shrink-0">
                            <Package className="w-3 h-3" />
                          </div>
                          <span className="leading-snug break-words min-w-0 flex-1">{item.text}</span>
                        </div>
                      ))}
                    </div>
                  ) : sec.type === 'specs' ? (
                    /* Specs Key-Value Table/Grid */
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gray-50/80 border border-gray-150 p-3 rounded-2xl">
                      {sec.items.map((item, iIdx) => (
                        <div
                          key={iIdx}
                          className="flex items-center justify-between gap-2 bg-white px-3.5 py-2.5 rounded-xl border border-gray-100 text-xs sm:text-sm shadow-xs min-w-0"
                        >
                          {item.key ? (
                            <>
                              <span className="font-bold text-gray-600 shrink-0">
                                {item.key}:
                              </span>
                              <span className="font-semibold text-gray-900 text-left dir-ltr break-words min-w-0">
                                {item.text}
                              </span>
                            </>
                          ) : (
                            <span className="font-medium text-gray-800 break-words min-w-0">{item.text}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Main Features / Points List - Clear, engaging, zero empty gaps */
                    <div className="space-y-2 min-w-0">
                      {sec.items.map((item, iIdx) => (
                        <div
                          key={iIdx}
                          className="flex items-start gap-3 p-3 sm:p-3.5 rounded-xl bg-gray-50/70 hover:bg-[#22A39E]/[0.05] transition-colors border border-gray-100/90 text-right min-w-0"
                        >
                          <div className="w-6 h-6 rounded-full bg-[#22A39E]/10 flex items-center justify-center text-[#22A39E] shrink-0 mt-0.5">
                            <Check className="w-4 h-4 stroke-[2.5]" />
                          </div>
                          <div className="text-xs sm:text-[14.5px] leading-relaxed text-gray-800 font-medium break-words min-w-0 flex-1">
                            {item.key && (
                              <span className="font-bold text-gray-900 ml-1.5">
                                {item.key}:
                              </span>
                            )}
                            <span>{item.text}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              /* Fallback clean description */
              <div className="text-gray-800 text-sm leading-relaxed p-4 bg-gray-50/70 rounded-2xl border border-gray-100 break-words">
                {description}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
