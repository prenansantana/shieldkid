export type AgeBracket = "child" | "teen_12_15" | "teen_16_17" | "adult";

/**
 * Calculate age in years from a birth date.
 */
export function calculateAge(birthDate: Date, referenceDate: Date = new Date()): number {
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = referenceDate.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && referenceDate.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
}

/**
 * Determine age bracket per Lei Felca rules.
 *
 * - child:      < 12
 * - teen_12_15: 12–15 (guardian required, parental controls active)
 * - teen_16_17: 16–17 (own account, with restrictions)
 * - adult:      18+
 */
export function getAgeBracket(age: number): AgeBracket {
  if (age < 12) return "child";
  if (age < 16) return "teen_12_15";
  if (age < 18) return "teen_16_17";
  return "adult";
}

/**
 * The age thresholds where bracket transitions occur.
 * Used by the cron job to detect users crossing boundaries.
 */
export const AGE_BRACKET_THRESHOLDS = [12, 16, 18] as const;

/**
 * Check if a birthday today crosses an age bracket threshold.
 * Returns the new bracket if a transition happens, null otherwise.
 */
export function checkBracketTransition(
  birthDate: Date,
  today: Date = new Date()
): { previousBracket: AgeBracket; newBracket: AgeBracket } | null {
  // Only process if today is the user's birthday
  if (
    birthDate.getMonth() !== today.getMonth() ||
    birthDate.getDate() !== today.getDate()
  ) {
    return null;
  }

  const newAge = calculateAge(birthDate, today);
  if (!AGE_BRACKET_THRESHOLDS.includes(newAge as 12 | 16 | 18)) {
    return null;
  }

  const previousBracket = getAgeBracket(newAge - 1);
  const newBracket = getAgeBracket(newAge);
  return { previousBracket, newBracket };
}
