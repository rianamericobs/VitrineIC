import { FileDrop } from "./FileDrop";
import { SkillPicker } from "./SkillPicker";
import { Label } from "./ui";
import type { ProfileDraft } from "@/lib/profile";

export function Step2({
  data,
  setData,
}: {
  data: ProfileDraft;
  setData: (d: Partial<ProfileDraft>) => void;
}) {
  const skills = data.skills;

  return (
    <div className="flex flex-col gap-10">
      <p className="rounded-xl border border-slate/20 bg-slate/8 px-4 py-3 font-sans text-sm leading-[1.5] text-slate">
        Adicione pelo menos uma competência para seu perfil aparecer na vitrine e receber convites.
      </p>

      <SkillPicker
        value={skills}
        course={data.course}
        onChange={(s) => setData({ skills: s })}
      />

      <div>
        <Label>Certificados (opcional)</Label>
        <FileDrop
          title="Anexar certificado técnico"
          hint="PDF"
          accept=".pdf"
          category="tech"
        />
      </div>
    </div>
  );
}
