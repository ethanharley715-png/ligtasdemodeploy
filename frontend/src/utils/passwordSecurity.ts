/**
 * passwordSecurity.ts
 * 
 * An analysis of password strength based on the multiple validation rules/checks.
 * The following criteria:
 * . Length
 * . Uppercase characters
 * . Numbers
 * . Common Password Detection
 * . Special Characters
 * 
 * This is all used to give real time feedback and to also enforce stronger cyber security practices.
 */

export function analyzePassword(password: string) {
  if (!password) {
    return {
      strength: "weak",
      checks: {
        lengthValid: false,
        uppercase: false,
        number: false,
        special: false,
        notCommon: false,
      },
    };
  }
  // Evaluates the password against certain defined security criteria.
  const checks = {
    lengthValid: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    notCommon: !["password", "123456", "qwerty"].includes(password.toLowerCase()),
  };

  const passedChecks = Object.values(checks).filter(Boolean).length;
  // Determines the overall strength based on the amount of passed checks.
  let strength: "weak" | "medium" | "strong" = "weak";

  if (passedChecks >= 5) strength = "strong";
  else if (passedChecks >= 3) strength = "medium";

  return { strength, checks };
}