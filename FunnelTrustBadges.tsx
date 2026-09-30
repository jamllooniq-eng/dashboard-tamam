import React from 'react';
import { ShieldCheck, Truck, RefreshCw, Headphones, CheckCircle2 } from 'lucide-react';

export const FunnelTrustBadges: React.FC = () => {
  const guarantees = [
    {
      icon: ShieldCheck,
      title: 'معاينة وفحص قبل الدفع',
      desc: 'افتح الشحنة وافحص منتجك وتأكد منه 100% أمام مندوب التوصيل قبل دفع أي دينار.',
    },
    {
      icon: Truck,
      title: 'توصيل سريع ومجاني',
      desc: 'شحن مجاني لكافة محافظات العراق وأقضيتها ونواحيها خلال 24 - 48 ساعة فقط.',
    },
    {
      icon: RefreshCw,
      title: 'ضمان الاسترجاع والاستبدال',
      desc: 'ضمان حقيقي لمدة 7 أيام للاستبدال أو الاسترجاع في حال وجود أي خلل أو عيب مصنعي.',
    },
    {
      icon: Headphones,
      title: 'خدمة عملاء ومتابعة مستمرة',
      desc: 'فريق دعم عراقي متاح للتواصل والمتابعة معك حتى استلام طلبك ورضاك التام.',
    },
  ];

  return (
    <div className="py-8 border-y border-[#E5E5E5] bg-[#F7F7F7] rounded-2xl p-6">
      <div className="text-center max-w-xl mx-auto mb-6">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#22A39E]/10 text-[#22A39E] font-bold text-xs mb-2">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>تسوق براحة وأمان 100%</span>
        </span>
        <h2 className="text-xl sm:text-2xl font-extrabold text-black">
          ضمانات تمام شوب لجميع زبائننا في العراق
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {guarantees.map((g, idx) => {
          const Icon = g.icon;
          return (
            <div
              key={idx}
              className="bg-white p-5 rounded-xl border border-[#E5E5E5] shadow-2xs hover:border-[#22A39E] transition-all text-center flex flex-col items-center"
            >
              <div className="w-12 h-12 rounded-xl bg-[#F7F7F7] text-[#22A39E] flex items-center justify-center mb-3">
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-sm text-black mb-1.5">{g.title}</h3>
              <p className="text-xs text-gray-600 leading-relaxed">{g.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
