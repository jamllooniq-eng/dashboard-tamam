/**
 * Iraqi Phone Number Normalizer & Validator
 * Converts Eastern Arabic/Persian digits to Western 0-9
 * Normalizes all standard Iraqi prefixes to standard 11-digit 07XXXXXXXXX
 */

export function normalizeDigits(input: string): string {
  if (!input) return '';
  const easternDigits: { [key: string]: string } = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
  };

  return input
    .replace(/[٠-٩۰-۹]/g, (char) => easternDigits[char] || char)
    .replace(/[\s\-+()]/g, '')
    .trim();
}

export function normalizeIraqiPhone(rawPhone: string): {
  isValid: boolean;
  normalized: string;
  error?: string;
} {
  const digitsOnly = normalizeDigits(rawPhone);

  if (!digitsOnly) {
    return {
      isValid: false,
      normalized: '',
      error: 'يرجى إدخال رقم الهاتف'
    };
  }

  let normalized = digitsOnly;

  // Handle +9647 or 009647 or 9647
  if (normalized.startsWith('009647') && normalized.length === 15) {
    normalized = '07' + normalized.substring(6);
  } else if (normalized.startsWith('9647') && normalized.length === 13) {
    normalized = '07' + normalized.substring(4);
  } else if (normalized.startsWith('7') && normalized.length === 10) {
    normalized = '0' + normalized;
  }

  // Check format: 11 digits starting with 07[3-9]
  const iraqiPhoneRegex = /^07[3-9]\d{8}$/;

  if (iraqiPhoneRegex.test(normalized)) {
    return {
      isValid: true,
      normalized
    };
  }

  return {
    isValid: false,
    normalized,
    error: 'رقم الهاتف غير صحيح. يجب أن يتكون من 11 رقماً ويبدأ بـ 07 (مثال: 07701234567)'
  };
}
