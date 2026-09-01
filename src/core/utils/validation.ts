export function validatePhoneNumber(phone: string): {valid: boolean; error?: string} {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  if (!cleaned.startsWith('+')) {
    return {valid: false, error: 'Phone number must start with +'};
  }
  const digits = cleaned.slice(1);
  if (!/^\d+$/.test(digits)) {
    return {valid: false, error: 'Phone number must contain only digits after +'};
  }
  if (digits.length < 7 || digits.length > 15) {
    return {valid: false, error: 'Phone number must be between 7 and 15 digits'};
  }
  return {valid: true};
}

export function validateUsername(username: string): {valid: boolean; error?: string} {
  const cleaned = username.replace(/^@/, '');
  if (cleaned.length < 3) {
    return {valid: false, error: 'Username must be at least 3 characters'};
  }
  if (cleaned.length > 30) {
    return {valid: false, error: 'Username must be at most 30 characters'};
  }
  if (!/^[a-zA-Z0-9_]+$/.test(cleaned)) {
    return {valid: false, error: 'Username can only contain letters, numbers, and underscores'};
  }
  return {valid: true};
}

export function validateDisplayName(name: string): {valid: boolean; error?: string} {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return {valid: false, error: 'Display name is required'};
  }
  if (trimmed.length > 50) {
    return {valid: false, error: 'Display name must be at most 50 characters'};
  }
  return {valid: true};
}

export function validateOtpCode(code: string): {valid: boolean; error?: string} {
  if (!/^\d{4,6}$/.test(code)) {
    return {valid: false, error: 'Verification code must be 4-6 digits'};
  }
  return {valid: true};
}

export function validateMessageContent(content: string): {valid: boolean; error?: string} {
  if (content.trim().length === 0) {
    return {valid: false, error: 'Message cannot be empty'};
  }
  if (content.length > 4000) {
    return {valid: false, error: 'Message is too long'};
  }
  return {valid: true};
}
