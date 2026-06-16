/**
 * Generates consistent colors based on skill name.
 * Used in Skills.tsx and Marketplace.tsx for skill card icons.
 */
export function getSkillColor(name: string): { bg: string; icon: string } {
  const colors = [
    { bg: "#eff6ff", icon: "#2563eb" },
    { bg: "#f0fdf4", icon: "#16a34a" },
    { bg: "#fefce8", icon: "#ca8a04" },
    { bg: "#fdf2f8", icon: "#db2777" },
    { bg: "#f5f3ff", icon: "#7c3aed" },
    { bg: "#ecfeff", icon: "#0891b2" },
    { bg: "#fff7ed", icon: "#ea580c" },
    { bg: "#f0fdfa", icon: "#0d9488" },
  ];
  const index =
    name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) %
    colors.length;
  return colors[index];
}
