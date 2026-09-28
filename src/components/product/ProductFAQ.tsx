import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

export const ProductFAQ: React.FC = () => {
  // All accordion items start closed by default
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      q: 'كيف أستلم طلبي وكيف يتم الدفع؟',
      a: 'يصلك المندوب إلى عنوانك المحدد في أي محافظة عراقية. تقوم بفحص المنتج والتأكد من سلامته التامة ومطابقته للمواصفات أولاً، ثم تدفع المبلغ للمندوب نقداً (الدفع عند الاستلام).',
    },
    {
      q: 'هل التوصيل مجاني فعلاً لكل المحافظات؟',
      a: 'نعم، التوصيل مجاني 100% لكافة محافظات وأقضية العراق بدون أي أجور شحن إضافية أو مبالغ مخفية.',
    },
    {
      q: 'ماذا لو كان في المنتج عيب مصنعي أو غير مطابق؟',
      a: 'نحن نوفر ضمان استبدال فوري ومباشر، بإمكانك التواصل مع خدمة العملاء وسنقوم باستبدال المنتج لك بأسرع وقت.',
    },
    {
      q: 'كم يستغرق وصول الطلب؟',
      a: 'يتم تجهيز وشحن الطلبات فور تأكيدها، ويستغرق التوصيل خلال أقل من 48 ساعة لكافة محافظات العراق.',
    },
  ];

  const toggle = (idx: number) => {
    setOpenIndex((prev) => (prev === idx ? null : idx));
  };

  return (
    <div id="product-faq-section" className="w-full">
      <div className="space-y-3">
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden bg-white ${
                isOpen
                  ? 'border-[#22A39E] shadow-sm shadow-[#22A39E]/5'
                  : 'border-gray-200/90 hover:border-gray-300 shadow-2xs'
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(idx)}
                aria-expanded={isOpen}
                className="w-full p-4 sm:p-4.5 text-right flex items-center justify-between gap-3 cursor-pointer transition-colors group select-none"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      isOpen
                        ? 'bg-[#22A39E] text-white shadow-2xs'
                        : 'bg-[#F4F6F8] text-[#22A39E] group-hover:bg-[#22A39E]/15'
                    }`}
                  >
                    <HelpCircle className="w-4.5 h-4.5" />
                  </div>
                  <span
                    className={`text-xs sm:text-sm font-bold transition-colors break-words min-w-0 flex-1 leading-snug ${
                      isOpen ? 'text-[#1B8581]' : 'text-gray-900 group-hover:text-[#22A39E]'
                    }`}
                  >
                    {faq.q}
                  </span>
                </div>

                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 ${
                    isOpen
                      ? 'bg-[#22A39E]/10 text-[#22A39E] rotate-180'
                      : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200/70 group-hover:text-gray-600'
                  }`}
                >
                  <ChevronDown className="w-4 h-4" />
                </div>
              </button>

              {isOpen && (
                <div className="px-4 sm:px-5 pb-4 pt-0">
                  <div className="p-3.5 sm:p-4 rounded-xl bg-[#F8FAFB] border border-gray-100/90 text-xs sm:text-sm text-gray-700 leading-relaxed font-normal">
                    {faq.a}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

