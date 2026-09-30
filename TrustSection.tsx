import React from 'react';
import { Truck, ShieldCheck, RefreshCw, Headphones } from 'lucide-react';

export const TrustSection: React.FC = () => {
  const pillars = [
    {
      icon: Truck,
      title: 'شحن مجاني وسريع',
      desc: 'توصيل مجاني تماماً وبدون أي رسوم خفية لجميع محافظات وأقضية العراق الـ 18.',
    },
    {
      icon: ShieldCheck,
      title: 'الدفع عند المعاينة',
      desc: 'افحص منتجك وتأكد من جودته ومطابقته التامة للمواصفات قبل تسليم أي مبلغ للمندوب.',
    },
    {
      icon: RefreshCw,
      title: 'ضمان الاستبدال',
      desc: 'استبدال سريع ومضمون في حال وجود أي ملاحظة أو عيب مصنعي في طلبك.',
    },
    {
      icon: Headphones,
      title: 'طلب مباشر وسهل',
      desc: 'بدون تسجيل حسابات معقدة وبدون بطاقات دفع مسبق — فقط أدخل اسمك وهاتفك.',
    },
  ];

  return (
    <section id="trust-section" className="py-12 bg-[#F7F7F7] border-t border-b border-[#E5E5E5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-xl sm:text-2xl font-bold text-black mb-2">
            لماذا يثق بنا آلاف العملاء في العراق؟
          </h2>
          <p className="text-xs sm:text-sm text-gray-600">
            نضمن لك تجربة تسوق سهلة، شفافة، وآمنة من لحظة الطلب حتى الاستلام
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {pillars.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="bg-white p-6 rounded-xl border border-[#E5E5E5] flex flex-col items-start text-right hover:border-[#22A39E]/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-[#22A39E]/10 text-[#22A39E] flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-black mb-1.5">
                  {item.title}
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
