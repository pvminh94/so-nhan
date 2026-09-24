export type DependentRelation = "CHILD" | "SPOUSE" | "PARENT" | "OTHER";

export function dependentWarning(relation: DependentRelation, birthDate: Date, asOf: Date): string | null {
  const age = asOf.getFullYear() - birthDate.getFullYear() - (asOf < new Date(asOf.getFullYear(), birthDate.getMonth(), birthDate.getDate()) ? 1 : 0);
  if (relation === "CHILD" && age >= 18) return "Con từ 18 tuổi cần hồ sơ đang học hoặc mất khả năng lao động";
  if (relation === "PARENT" && age < 60) return "Cha mẹ dưới 60 tuổi cần hồ sơ không nơi nương tựa hoặc mất khả năng lao động";
  return null;
}
