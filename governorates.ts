export const IRAQ_GOVERNORATES = [
  'بغداد',
  'البصرة',
  'نينوى',
  'أربيل',
  'النجف',
  'ذي قار',
  'كركوك',
  'الأنبار',
  'ديالى',
  'المثنى',
  'الديوانية',
  'ميسان',
  'واسط',
  'صلاح الدين',
  'دهوك',
  'السليمانية',
  'بابل',
  'كربلاء'
] as const;

export type Governorate = (typeof IRAQ_GOVERNORATES)[number];
