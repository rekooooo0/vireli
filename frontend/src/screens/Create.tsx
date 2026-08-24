import { useRef, useState } from "react";
import styles from "./Create.module.css";
import type { Screen } from "../types/nav";
import { STYLE_PRESETS } from "../types/nav";
import { createMockGeneration, hasEnoughCredits, type ToolType } from "../api/mockGenerations";
import { haptic, hapticNotify } from "../telegram/webapp";

interface Props {
  navigate: (s: Screen) => void;
}

const TOOLS: { id: ToolType; title: string; hint: string }[] = [
  { id: "enhance", title: "Улучшение", hint: "Резкость, свет, детали" },
  { id: "remove_bg", title: "Без фона", hint: "PNG с прозрачностью" },
  { id: "style", title: "Стилизация", hint: "Готовый визуальный стиль" },
  { id: "caption", title: "Подпись", hint: "Текст для поста" },
];

const MAX_FILE_MB = 12;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function Create({ navigate }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolType>("enhance");
  const [style, setStyle] = useState<string>(STYLE_PRESETS[0].id);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Поддерживаются только JPG, PNG или WEBP.");
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`Файл слишком большой. Максимум ${MAX_FILE_MB} МБ.`);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }

  function handleGenerate() {
    if (!previewUrl) {
      setError("Сначала загрузи фотографию.");
      return;
    }
    if (!hasEnoughCredits()) {
      setError("Недостаточно кредитов. Пополни баланс на экране Credits.");
      hapticNotify("error");
      return;
    }

    setSubmitting(true);
    try {
      const id = createMockGeneration(tool, previewUrl);
      haptic("medium");
      navigate({ name: "result", generationId: id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось запустить генерацию.");
      hapticNotify("error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate({ name: "home" })} aria-label="Назад">
          ←
        </button>
        <h1 className={styles.title}>Create</h1>
      </div>

      <div className={styles.dropzone}>
        {previewUrl ? (
          <>
            <img src={previewUrl} alt="Загруженное фото" className={styles.dropzonePreview} />
            <span className={styles.changePhoto}>Заменить</span>
          </>
        ) : (
          <>
            <div className={styles.dropzoneIcon}>+</div>
            <span className={styles.dropzoneLabel}>Загрузить фото</span>
            <span className={styles.dropzoneHint}>JPG, PNG, WEBP · до {MAX_FILE_MB} МБ</span>
          </>
        )}
        <input
          ref={fileInputRef}
          className={styles.fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => handleFile(e.target.files?.[0])}
          aria-label="Выбрать фото"
        />
      </div>

      <div className={styles.sectionLabel}>Инструмент</div>
      <div className={styles.toolGrid}>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`${styles.toolCard} ${tool === t.id ? styles.toolCardActive : ""}`}
            onClick={() => {
              setTool(t.id);
              haptic("light");
            }}
          >
            <div className={styles.toolCardTitle}>{t.title}</div>
            <div className={styles.toolCardHint}>{t.hint}</div>
          </button>
        ))}
      </div>

      {tool === "style" && (
        <>
          <div className={styles.sectionLabel}>Стиль</div>
          <div className={styles.styleRow}>
            {STYLE_PRESETS.map((s) => (
              <button
                key={s.id}
                className={`${styles.stylePill} ${style === s.id ? styles.stylePillActive : ""}`}
                onClick={() => setStyle(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </>
      )}

      {error && <div className={styles.errorNotice}>{error}</div>}

      <div className={styles.spacer} />

      <button className={styles.generateBtn} onClick={handleGenerate} disabled={submitting}>
        {submitting ? "Запускаем…" : "Generate · 1 кредит"}
      </button>
    </div>
  );
}
