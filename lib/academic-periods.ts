export const SEMESTERS = ['1st Semester', '2nd Semester'] as const;
export type Semester = typeof SEMESTERS[number];
export function isSemester(value: string): value is Semester {
  return (SEMESTERS as readonly string[]).includes(value);
}
