import React from 'react';
import { PolicyType } from '../../types';
import { X, ShieldCheck, RefreshCw, FileText, Info } from 'lucide-react';

interface PolicyModalProps {
  type: PolicyType | null;
  onClose: () => void;
}

export const PolicyModal: React.FC<PolicyModalProps> = ({ type, onClose }) => {
  if (!type) return null;

  const contentMap: Record<
    PolicyType,
    { title: string; icon: React.FC<{ className?: string }>; body: React.ReactNode }
  > = {
    privacy: {
      title: 'سياسة الخصوصية وسرية البيانات',
      icon: ShieldCheck,
      body: (
        <div className="space-y-4 text-xs sm:text-sm text-gray-700 leading-relaxed">
          <p>
            نحن في متجر <strong>تمام شوب</strong> نولي خصوصية بيانات عملائنا في العراق الأهمية القصوى.
          </p>
          <h4 className="font-bold text-black text-sm">1. البيانات التي نجمعها</h4>
          <p>
            نجمع فقط البيانات الأساسية اللازمة لإتمام وتوصيل طلبك (الاسم، رقم الهاتف، المحافظة، والعنوان التفصيلي).
          </p>
          <h4 className="font-bold text-black text-sm">2. استخدام البيانات</h4>
          <p>
            تُستخدم هذه البيانات حصراً للتواصل معك، تجهيز الطلب، وتسليمه عبر شركات التوصيل المعتمدة لدينا. لا نقوم ببيع أو تأجير أو مشاركة بياناتك مع أي طرف ثالث غير معني بعملية التوصيل.
          </p>
          <h4 className="font-bold text-black text-sm">3. الأمان والحماية</h4>
          <p>
            جميع طلباتك ومعلوماتك محمية ومشفرة وفق أعلى معايير الأمان الرقمي.
          </p>
        </div>
      ),
    },
    terms: {
      title: 'الشروط والأحكام',
      icon: FileText,
      body: (
        <div className="space-y-4 text-xs sm:text-sm text-gray-700 leading-relaxed">
          <h4 className="font-bold text-black text-sm">1. نظام الطلب والدفع</h4>
          <p>
            جميع الطلبات في متجر <strong>تمام شوب</strong> تعتمد على نظام الدفع عند الاستلام والمعاينة (Cash on Delivery) بعد فحص المنتج والتأكد منه.
          </p>
          <h4 className="font-bold text-black text-sm">2. التوصيل والشحن</h4>
          <p>
            نوفر خدمة الشحن المجاني لكافة محافظات العراق الـ 18. يرجى تزويدنا برقم هاتف عراقي فعال لضمان وصول المندوب إليك بسلاسة.
          </p>
          <h4 className="font-bold text-black text-sm">3. دقة البيانات</h4>
          <p>
            يلتزم العميل بتزويدنا بمعلومات عنوان صحيحة لتفادي أي تأخير في مواعيد التسليم.
          </p>
        </div>
      ),
    },
    returns: {
      title: 'سياسة الاستبدال والاسترجاع والضمان',
      icon: RefreshCw,
      body: (
        <div className="space-y-4 text-xs sm:text-sm text-gray-700 leading-relaxed">
          <h4 className="font-bold text-black text-sm">1. فحص المنتج عند الاستلام</h4>
          <p>
            يحق لكل زبون فحص المنتج ومعاينته أمام مندوب التوصيل قبل دفع أي مبلغ مالي للتأكد من سلامته ومطابقته التامة.
          </p>
          <h4 className="font-bold text-black text-sm">2. شروط الاستبدال</h4>
          <p>
            في حال وجود أي عيب مصنعي أو خلل فني في المنتج، نوفر استبدالاً مجانياً ومباشراً خلال مدة الضمان المحددة، بشرط الاحتفاظ بغلاف المنتج الأصلي وملحقاته.
          </p>
          <h4 className="font-bold text-black text-sm">3. آلية تقديم طلب الاستبدال</h4>
          <p>
            تواصل مباشرة مع خدمة العملاء برقم طلبك وسيتم إرسال مندوب لاستبدال المنتج بأسرع وقت ممكن.
          </p>
        </div>
      ),
    },
    about: {
      title: 'عن متجر تمام شوب',
      icon: Info,
      body: (
        <div className="space-y-4 text-xs sm:text-sm text-gray-700 leading-relaxed">
          <p>
            <strong>تمام شوب</strong> هو متجر إلكتروني عراقي متخصص في تقديم أحدث الأجهزة الذكية، الإلكترونيات، الإكسسوارات، والمنتجات المنزلية المبتكرة.
          </p>
          <p>
            نسعى لتبسيط تجربة التسوق في العراق من خلال توفير الشحن المجاني بنسبة 100%، والدفع عند الاستلام مع المعاينة المباشرة، لضمان رضا وثقة كل عميل في كل طلب.
          </p>
        </div>
      ),
    },
  };

  const item = contentMap[type];
  const Icon = item.icon;

  return (
    <div
      id="policy-modal-overlay"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        id="policy-modal-card"
        className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 border border-[#E5E5E5] shadow-xl text-right relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute left-4 top-4 w-8 h-8 rounded-full bg-[#F7F7F7] hover:bg-gray-200 text-gray-600 hover:text-black flex items-center justify-center cursor-pointer transition-colors"
          aria-label="إغلاق"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-[#E5E5E5]">
          <div className="w-9 h-9 rounded-xl bg-[#22A39E]/10 text-[#22A39E] flex items-center justify-center">
            <Icon className="w-5 h-5" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-black">
            {item.title}
          </h3>
        </div>

        {item.body}

        <div className="mt-6 pt-4 border-t border-[#E5E5E5] text-left">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#22A39E] hover:bg-[#1b8581] text-white text-xs font-bold transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
