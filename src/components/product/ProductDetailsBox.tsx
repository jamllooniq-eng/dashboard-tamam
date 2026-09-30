import React, { useMemo } from 'react';
import { ShieldCheck, CheckCircle2, Check } from 'lucide-react';

interface ProductDetailsBoxProps {
  title?: string;
  description?: string;
  features?: string[];
  variant?: 'full' | 'header' | 'body';
}

type SectionType = 'intro' | 'features' | 'specs' | 'box';

interface ParsedSection {
  title?: string;
  type: SectionType;
  items: Array<{ key?: string; text: string }>;
}

// Section headings (Rolemall descriptions use many wordings)
const BOX_HEADING =
  /^(المحتويات|محتويات\s*(العلبة|الصندوق|المنتج|الطقم|الحزمة|العبوة)|محتوى\s*(العلبة|الصندوق)|مكونات\s*(العلبة|المنتج|الطقم)|المرفقات|مرفقات\s*المنتج|داخل\s*العلبة|في\s*العلبة|يأتي\s*مع)/i;
const SPECS_HEADING =
  /^(المواصفات\s*الفنية|المواصفات\s*الرئيسية|المواصفات|المعايير\s*الفنية|بيانات\s*المنتج|تفاصيل\s*تقنية)/i;
const FEATURES_HEADING = /^(المميزات|مميزات\s*المنتج|أبرز\s*المميزات|خصائص\s*المنتج|الخصائص|الفوائد)/i;

const BULLET = /^[.،•\-\*+✔✓▪●○◦·]+/;

export const ProductDetailsBox: React.FC<ProductDetailsBoxProps> = ({
  title = '',
  description = '',
  features = [],
  variant = 'full',
}) => {
  const sections = useMemo<ParsedSection[]>(() => {
    if (!description && (!features || features.length === 0)) return [];

    const rawLines = (description || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const parsed: ParsedSection[] = [];
    let current: ParsedSection = { type: 'features', items: [] };
    let bulletedLinesInFirst = 0;
    let isFirstSection = true;

    const startSection = (heading: string, type: SectionType) => {
      if (current.items.length > 0) parsed.push(current);
      current = { title: heading.replace(/[:：]\s*$/, '').replace(/[:：]/g, '').trim(), type, items: [] };
      isFirstSection = false;
    };

    rawLines.forEach((line) => {
      const hadBullet = BULLET.test(line);
      const clean = line.replace(BULLET, '').replace(/^\s+/, '').trim();
      if (!clean) return;

      // A heading is a short line matching a known title (e.g. "المحتويات:")
      const headingText = clean.replace(/[:：]\s*$/, '');
      if (headingText.length <= 30) {
        if (BOX_HEADING.test(headingText)) return startSection(headingText, 'box');
        if (SPECS_HEADING.test(headingText)) return startSection(headingText, 'specs');
        if (FEATURES_HEADING.test(headingText)) return startSection(headingText, 'features');
      }

      if (isFirstSection && hadBullet) bulletedLinesInFirst++;

      const colon = clean.indexOf(':');
      if (colon > 1 && colon < 35 && clean.length < 90) {
        current.items.push({ key: clean.slice(0, colon).trim(), text: clean.slice(colon + 1).trim() });
      } else {
        current.items.push({ text: clean });
      }
    });
    if (current.items.length > 0) parsed.push(current);

    // The untitled opening text: sentences broken over several lines read better as one paragraph.
    // (Short, bulleted or "key: value" lines stay a list.)
    const first = parsed[0];
    if (first && !first.title) {
      const plain = first.items.filter((i) => !i.key);
      const avgLength = plain.reduce((sum, i) => sum + i.text.length, 0) / Math.max(1, plain.length);
      if (plain.length === first.items.length && bulletedLinesInFirst === 0 && avgLength >= 30) {
        first.type = 'intro';
      }
    }

    // Extra features that are not already written in the description
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, '');
    const existing = new Set(rawLines.map(norm));
    const extra = (features || []).filter((f) => {
      const c = norm(String(f || '').trim());
      return c.length > 0 && !existing.has(c);
    });
    if (extra.length > 0) {
      parsed.push({ title: 'مميزات إضافية', type: 'features', items: extra.map((f) => ({ text: f })) });
    }
    return parsed;
  }, [description, features]);

  if (!title && sections.length === 0 && !description) return null;

  const showHeader = variant === 'full' || variant === 'header';
  const showBody = variant === 'full' || variant === 'body';

  return (
    <div
      id={`product-details-box-${variant}`}
      className="rounded-2xl bg-white border border-gray-200 p-5 sm:p-6 space-y-6"
    >
      {/* Title + trust badges */}
      {showHeader && title && (
        <div className={`space-y-3 min-w-0 ${showBody ? 'pb-5 border-b border-gray-100' : ''}`}>
          <h1
            id={`product-title-heading-${variant}`}
            className="text-lg sm:text-xl md:text-2xl font-black text-gray-900 leading-snug break-words"
          >
            {title}
          </h1>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#22A39E]/[0.08] px-3 py-1.5 text-xs sm:text-sm font-bold text-[#177773]">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              منتج أصلي 100%
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#22A39E]/[0.08] px-3 py-1.5 text-xs sm:text-sm font-bold text-[#177773]">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              فحص قبل الاستلام
            </span>
          </div>
        </div>
      )}

      {showBody && (
        <div className="space-y-6 min-w-0">
          <h2 className="text-base sm:text-lg font-black text-gray-900">تفاصيل المنتج</h2>

          {sections.length > 0 ? (
            sections.map((sec, secIdx) => (
              <section key={secIdx} className="space-y-3 min-w-0">
                {sec.title && (
                  <div className="flex items-center gap-3">
                    <h3 className="shrink-0 text-sm sm:text-[15px] font-bold text-[#177773]">{sec.title}</h3>
                    <span className="h-px flex-1 bg-gray-100" aria-hidden="true" />
                  </div>
                )}

                {sec.type === 'intro' ? (
                  /* Opening text as one readable paragraph */
                  <p className="text-[15px] leading-8 text-gray-700 break-words">
                    {sec.items.map((i) => i.text).join(' ')}
                  </p>
                ) : sec.type === 'specs' ? (
                  /* Specifications: name on the right, value on the left */
                  <dl className="divide-y divide-gray-100">
                    {sec.items.map((item, i) => (
                      <div key={i} className="flex items-start justify-between gap-4 py-2.5 text-sm sm:text-[15px]">
                        {item.key ? (
                          <>
                            <dt className="text-gray-500 shrink-0">{item.key}</dt>
                            <dd className="text-gray-900 font-bold text-left break-words min-w-0">{item.text}</dd>
                          </>
                        ) : (
                          <dd className="text-gray-800 break-words min-w-0">{item.text}</dd>
                        )}
                      </div>
                    ))}
                  </dl>
                ) : sec.type === 'box' ? (
                  /* What's in the box: plain list, quantity highlighted when present */
                  <ul className="divide-y divide-gray-100">
                    {sec.items.map((item, i) => {
                      const line = item.key ? `${item.key}: ${item.text}` : item.text;
                      const qty = line.match(/^(\d+)\s*[x×]?\s+(.+)$/i);
                      return (
                        <li key={i} className="flex items-center gap-3 py-2.5 text-sm sm:text-[15px] text-gray-800 min-w-0">
                          <span className="flex min-w-[2rem] h-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 px-2 text-xs font-bold text-gray-700">
                            {qty ? `×${qty[1]}` : '•'}
                          </span>
                          <span className="break-words min-w-0">{qty ? qty[2] : line}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  /* Features: simple checklist */
                  <ul className="space-y-3">
                    {sec.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 min-w-0">
                        <Check className="mt-1 w-4 h-4 shrink-0 text-[#22A39E] stroke-[3]" />
                        <p className="text-sm sm:text-[15px] leading-relaxed text-gray-800 break-words min-w-0">
                          {item.key && <span className="font-bold text-gray-900">{item.key}: </span>}
                          {item.text}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))
          ) : (
            <p className="text-[15px] leading-8 text-gray-700 whitespace-pre-line break-words">{description}</p>
          )}
        </div>
      )}
    </div>
  );
};
