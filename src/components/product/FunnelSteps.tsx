import React from 'react';
import { ClipboardEdit, PhoneCall, PackageCheck } from 'lucide-react';

export const FunnelSteps: React.FC = () => {
  const steps = [
    {
      num: '1',
      icon: ClipboardEdit,
      title: 'املأ استمارة الطلب',
      desc: 'أدخل اسمك، رقم هاتفك العراقي، وعنوانك في الاستمارة أدناه بدون أي دفع مسبق.',
    },
    {
      num: '2',
      icon: PhoneCall,
      title: 'تأكيد هاتفي سريع',
      desc: 'بعد تثبيت الطلب سيتم التواصل معك من خلال رسائل واتساب الرجاء الرد على الرسالة بكلمة تم.',
    },
    {
      num: '3',
      icon: PackageCheck,
      title: 'استلم وافحص وادفع',
      desc: 'يصلك المندوب لباب بيتك، تفتح الشحنة وتفحص المنتج ثم تدفع المبلغ للمندوب بكل راحة.',
    },
  ];

  return (
    <div className="py-6 sm:py-8 bg-white">
      <div className="text-center max-w-xl mx-auto mb-6">
        <h2 className="text-lg sm:text-xl font-extrabold text-black mb-1">
          كيفية الطلب بخطوات سهلة وبسيطة
        </h2>
        <p className="text-xs text-gray-500">
          لا حاجة لأي بطاقة بنكية أو دفع مسبق — الدفع عند الاستلام بعد المعاينة
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
        {steps.map((s, idx) => {
          const Icon = s.icon;
          return (
            <div
              key={idx}
              className="relative p-5 rounded-2xl bg-[#F7F7F7] border border-[#E5E5E5] flex flex-col items-center text-center group hover:bg-white hover:border-[#22A39E] transition-all"
            >
              {/* Step Number Badge */}
              <div className="absolute -top-3 right-5 w-7 h-7 rounded-full bg-[#22A39E] text-white text-xs font-black flex items-center justify-center border-2 border-white shadow-2xs">
                {s.num}
              </div>

              <div className="w-12 h-12 rounded-xl bg-white text-[#22A39E] flex items-center justify-center mb-3 shadow-2xs group-hover:scale-110 transition-transform">
                <Icon className="w-6 h-6" />
              </div>

              <h3 className="font-extrabold text-sm text-black mb-1.5">{s.title}</h3>
              <p className="text-xs text-gray-600 leading-relaxed">{s.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
