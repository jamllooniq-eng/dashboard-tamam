import React, { useMemo } from 'react';
import { ShieldCheck, CheckCircle2, Check, ClipboardList } from 'lucide-react';

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

// Known section headings (Rolemall descriptions use many wordings)
const BOX_HEADING =
  /^(المحتويات|محتويات\s*(العلبة|الصندوق|المنتج|الطقم|الحزمة|العبوة)|محتوى\s*(العلبة|الصندوق)|مكونات\s*(العلبة|المنتج|الطقم)|المرفقات|مرفقات\s*المنتج|داخل\s*العلبة|في\s*العلبة|يأتي\s*مع)/i;
const SPECS_HEADING =
  /^(المواصفات\s*الفنية|المواصفات\s*الرئيسية|المواصفات|المعايير\s*الفنية|بيانات\s*المنتج|تفاصيل\s*تقنية)/i;
const FEATURES_HEADING = /^(المميزات|مميزات\s*المنتج|أبرز\s*المميزات|خصائص\s*المنتج|الخصائص|الفوائد)/i;

const BULLET = /^[.،•\-\*+✔✓▪●○◦·]+/;

/** Short paragraphs of 2 sentences (no regex lookbehind, so it also works on older iPhones). */
function toParagraphs(text: string): string[] {
  const sentences = (text.match(/[^.!؟?]+[.!؟?]*/g) || [text]).map((s) => s.trim()).filter(Boolean);
  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) paragraphs.push(sentences.slice(i, i + 2).join(' '));
  return paragraphs;
}

/** Section title: green text with a thin line after it */
const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center gap-3">
    <span className="w-1.5 h-5 shrink-0 rounded-full bg-[#22A39E]" aria-hidden="true" />
    <h3 className="shrink-0 text-[15px] sm:text-base font-bold text-gray-900">{children}</h3>
    <span className="h-px flex-1 bg-gray-100" aria-hidden="true" />
  </div>
);

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
      current = { title: heading.replace(/[:：]/g, '').trim(), type, items: [] };
      isFirstSection = false;
    };

    rawLines.forEach((line) => {
      const hadBullet = BULLET.test(line);
      const clean = line.replace(BULLET, '').trim();
      if (!clean) return;

      // Headings: known titles, or any short line ending with ":" (e.g. "طريقة الاستخدام:")
      const headingText = clean.replace(/[:：]\s*$/, '');
      if (headingText.length <= 30) {
        if (BOX_HEADING.test(headingText)) return startSection(headingText, 'box');
        if (SPECS_HEADING.test(headingText)) return startSection(headingText, 'specs');
        if (FEATURES_HEADING.test(headingText)) return startSection(headingText, 'features');
        if (/[:：]\s*$/.test(clean) && headingText.length <= 25) return startSection(headingText, 'features');
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

    // Untitled opening text: sentences split over several lines read better as paragraphs.
    // Short, bulleted or "key: value" lines stay a list.
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
      className={`rounded-2xl bg-white border border-gray-200 p-5 sm:p-7 space-y-7 shadow-[0_1px_3px_rgba(16,24,40,0.04)] ${
        variant === 'body' ? 'border-t-4 border-t-[#22A39E]' : ''
      }`}
    >
      {/* Title + trust badges */}
      {showHeader && title && (
        <div className={`space-y-3.5 min-w-0 ${showBody ? 'pb-6 border-b border-gray-100' : ''}`}>
          <h1
            id={`product-title-heading-${variant}`}
            className="text-xl sm:text-2xl font-black text-gray-900 leading-snug break-words"
          >
            {title}
          </h1>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#22A39E]/[0.08] px-3 py-1.5 text-[13px] sm:text-sm font-bold text-[#177773]">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              منتج أصلي 100%
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#22A39E]/[0.08] px-3 py-1.5 text-[13px] sm:text-sm font-bold text-[#177773]">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              فحص قبل الاستلام
            </span>
          </div>
        </div>
      )}

      {showBody && (
        <div className="space-y-7 min-w-0">
          {/* Box heading */}
          <div className="flex items-center gap-3 pb-5 border-b border-gray-100">
            <span className="flex w-11 h-11 shrink-0 items-center justify-center rounded-xl bg-[#22A39E]/10">
              <ClipboardList className="w-5 h-5 text-[#177773]" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-black text-gray-900 leading-tight">تفاصيل المنتج</h2>
              <p className="mt-1 text-[13px] sm:text-sm text-gray-500">كل ما تحتاج معرفته قبل الطلب</p>
            </div>
          </div>

          {sections.length > 0 ? (
            sections.map((sec, secIdx) => (
              <section key={secIdx} className="space-y-4 min-w-0">
                {sec.title && <SectionTitle>{sec.title}</SectionTitle>}

                {sec.type === 'intro' ? (
                  /* Opening text: short paragraphs, the first one slightly stronger */
                  <div className="space-y-4">
                    {toParagraphs(sec.items.map((i) => i.text).join(' ')).map((p, i) => (
                      <p
                        key={i}
                        className={`text-base leading-8 break-words ${i === 0 ? 'text-gray-900 font-medium' : 'text-gray-600'}`}
                      >
                        {p}
                      </p>
                    ))}
                  </div>
                ) : sec.type === 'specs' ? (
                  /* Specifications: name on the right, value on the left */
                  <dl className="rounded-xl bg-gray-50 px-4 divide-y divide-gray-200/70">
                    {sec.items.map((item, i) => (
                      <div key={i} className="flex items-start justify-between gap-4 py-3 text-[15px]">
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
                  /* What's in the box: one calm grouped list, quantity in bold */
                  <ul className="rounded-xl bg-gray-50 px-4 divide-y divide-gray-200/70">
                    {sec.items.map((item, i) => {
                      const line = item.key ? `${item.key}: ${item.text}` : item.text;
                      const qty = line.match(/^(\d+)\s*[x×]?\s*(.+)$/i);
                      return (
                        <li key={i} className="flex items-center gap-3 py-3 text-[15px] text-gray-800 min-w-0">
                          <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-[#22A39E]" aria-hidden="true" />
                          <span className="leading-relaxed break-words min-w-0">
                            {qty ? (
                              <>
                                <strong className="font-bold text-gray-900">{qty[1]}</strong> {qty[2]}
                              </>
                            ) : (
                              line
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  /* Features: clear checklist with comfortable spacing */
                  <ul className="space-y-3.5">
                    {sec.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 min-w-0">
                        <span className="mt-1 flex w-5 h-5 shrink-0 items-center justify-center rounded-full bg-[#22A39E]/10">
                          <Check className="w-3.5 h-3.5 text-[#177773] stroke-[3]" />
                        </span>
                        <p className="text-[15px] sm:text-base leading-7 text-gray-800 break-words min-w-0">
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
            <p className="text-base leading-8 text-gray-700 whitespace-pre-line break-words">{description}</p>
          )}
        </div>
      )}
    </div>
  );
};
