import { FileDrop } from "./FileDrop";
import { LanguagePicker } from "./LanguagePicker";
import { Label } from "./ui";
import type { ProfileDraft } from "@/lib/profile";

export function Step3({
  data,
  setData,
}: {
  data: ProfileDraft;
  setData: (d: Partial<ProfileDraft>) => void;
}) {
  const languages = data.languages;

  return (
    <div className="flex flex-col gap-10">
      <LanguagePicker
        value={languages}
        onChange={(l) => setData({ languages: l })}
      />

      <div>
        <Label>Certificados (opcional)</Label>
        <FileDrop
          title="Anexar certificado de idioma (TOEFL, IELTS…)"
          hint="PDF"
          accept=".pdf"
          category="language"
        />
      </div>
    </div>
  );
}
