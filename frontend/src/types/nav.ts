export type Screen =
  | { name: "home" }
  | { name: "create" }
  | { name: "result"; generationId: string }
  | { name: "my-creations" }
  | { name: "credits" };

export const TOOL_LABELS: Record<string, string> = {
  enhance: "Улучшение",
  remove_bg: "Без фона",
  style: "Стилизация",
  caption: "Подпись",
};

export const STYLE_PRESETS = [
  { id: "clean", label: "Clean" },
  { id: "luxury", label: "Luxury" },
  { id: "street", label: "Street" },
  { id: "cinematic", label: "Cinematic" },
  { id: "anime", label: "Anime" },
  { id: "editorial", label: "Editorial" },
] as const;
