export const sensitiveDataRegexReplacements: Record<string, string> = {
  // Email addresses
  '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}': '[EMAIL_REDACTED]',
  // IP addresses
  '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b': '[IP_REDACTED]',
  // MAC addresses
  '\\b(?:[0-9a-fA-F]{2}[:-]){5}(?:[0-9a-fA-F]{2})\\b': '[MAC_REDACTED]',
  // UUIDs
  '\\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\\b': '[UUID_REDACTED]',
  // DUIDs (Roborock device IDs, 16 hex chars)
  '\\b[a-fA-F0-9]{16}\\b': '[DUID_REDACTED]',

  // token, eg "token":"abcdefghijklmnopqrstuvwxyz" or token: 'abcdefghijklmnopqrstuvwxyz'
  '"token"\\s*:\\s*"([a-zA-Z0-9-_\\.:=]+)"': '"token":"[TOKEN_REDACTED]"',
  'token\\s*[:=]\\s*[\'"]?([a-zA-Z0-9-_\\.:=]+)[\'"]?': 'token: [TOKEN_REDACTED]',

  // rruid (Roborock user IDs, rr followed by hex)
  '\\brr[a-fA-F0-9]+\\b': '[RRUID_REDACTED]',

  // password, eg "password":"mypassword" or password: 'mypassword'
  '"password"\\s*:\\s*"([^"]+)"': '"password":"[PASSWORD_REDACTED]"',
  'password\\s*[:=]\\s*[\'"]?([^\'"]+)[\'"]?': 'password: [PASSWORD_REDACTED]',

  // verification codes (6 digit numbers), eg verificationCode: '123456', 'verificationCode':'123456' or verificationCode = 123456
  '"verificationCode"\\s*:\\s*"?(\\d{6})"?': '"verificationCode":"[VERIFICATION_CODE_REDACTED]"',
  'verificationCode\\s*[:=]\\s*[\'"]?(\\d{6})[\'"]?': 'verificationCode: [VERIFICATION_CODE_REDACTED]',

  // user name, eg: username: 'abc@gmail.com', 'username':'abc@gmail.com' or username = abc@gmail.com or "username":"abc@abc.com"
  '"username"\\s*:\\s*"([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})"': '"username":"[USERNAME_REDACTED]"',
  'username\\s*[:=]\\s*[\'"]?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})[\'"]?': 'username: [USERNAME_REDACTED]',
};
