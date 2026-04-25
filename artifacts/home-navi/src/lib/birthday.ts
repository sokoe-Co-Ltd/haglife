export function isTodayBirthday(birthMonth: number | null | undefined, birthDay: number | null | undefined): boolean {
  if (birthMonth == null || birthDay == null) return false;
  const today = new Date();
  return today.getMonth() + 1 === birthMonth && today.getDate() === birthDay;
}
