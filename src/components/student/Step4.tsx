import { FileDrop } from "./FileDrop";
import { StatusPill } from "@/components/app/StatusPill";
import { MOSS } from "@/styles/tokens";
import { Input, Label } from "./ui";
import type { ProfileDraft } from "@/lib/profile";

export function Step4({
  data,
  setData,
  onGoToSkills,
}: {
  data: ProfileDraft;
  setData: (d: Partial<ProfileDraft>) => void;
  onGoToSkills: () => void;
}) {
  const count = data.skills.length;

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
        <Input label="GitHub" placeholder="github.com/usuario" value={data.github} onChange={(v) => setData({ github: v })} />
        <Input
          label="LinkedIn"
          placeholder="linkedin.com/in/usuario"
          value={data.linkedin}
          onChange={(v) => setData({ linkedin: v })}
        />
        <Input label="Site / Portfólio" placeholder="seusite.dev" value={data.site} onChange={(v) => setData({ site: v })} />
        <Input
          label="Lattes"
          placeholder="lattes.cnpq.br/xxxxxxxx"
          value={data.lattes}
          onChange={(v) => setData({ lattes: v })}
        />
      </div>

      <div>
        <Label>Trabalhos anteriores</Label>
        <FileDrop
          title="Anexar currículo e trabalhos"
          hint="PDF, DOCX, ZIP · máx. 20 MB"
          accept=".pdf,.docx,.zip"
          category="portfolio"
        />
      </div>

      {count > 0 ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-moss/25 bg-moss/8 px-4 py-3"
        >
          <p className="font-sans text-sm text-moss">
            Perfil pronto para a vitrine: {count} {count === 1 ? "competência adicionada" : "competências adicionadas"}.
          </p>
          <StatusPill color={MOSS}>Visível</StatusPill>
        </div>
      ) : (
        <div role="status" className="rounded-xl border border-ochre/30 bg-ochre/8 px-4 py-3 font-sans text-sm text-ochre">
          Seu perfil ainda não aparece na vitrine: falta adicionar uma competência.{" "}
          <button type="button" onClick={onGoToSkills} className="underline underline-offset-4 hover:text-navy">
            Voltar ao passo 02
          </button>
        </div>
      )}
    </div>
  );
}
