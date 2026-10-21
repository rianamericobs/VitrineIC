import { useState, type FormEvent } from "react";
import { Input, Label } from "./ui";
import { ArrowIcon, CheckIcon } from "@/components/app/Icons";
import { PageHead } from "@/components/public/PageHead";
import { PAGE } from "@/components/public/layout";
import { REQUESTER_KIND_LABEL } from "@/data/companies";
import { useSession } from "@/lib/auth";
import { updateCompany } from "@/lib/store";
import { email, first, required, useValidation } from "@/lib/validate";
import type { RequesterKind } from "@/types";

const KINDS = Object.entries(REQUESTER_KIND_LABEL) as [RequesterKind, string][];

/**
 * Perfil do solicitante logado: é o que o estudante vê antes de aceitar um
 * contato. O nome da organização é a chave das demandas e não muda aqui.
 */
export function Profile() {
  const session = useSession();
  const company = session?.company;
  const [data, setData] = useState({
    contactName: session?.account.name ?? "",
    contactEmail: company?.contactEmail ?? "",
    kind: company?.kind ?? ("empresa" as RequesterKind),
    city: company?.city ?? "",
    site: company?.site ?? "",
    description: company?.description ?? "",
  });
  const [saved, setSaved] = useState(false);

  const { validate, field } = useValidation<"contactName" | "contactEmail" | "city">(() => ({
    contactName: required(data.contactName, "Informe o nome do responsável."),
    contactEmail: first(required(data.contactEmail, "Informe o e-mail de contato."), email(data.contactEmail)),
    city: required(data.city, "Informe a cidade."),
  }));

  if (!company) return null;

  const set = (patch: Partial<typeof data>) => {
    setData({ ...data, ...patch });
    setSaved(false);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const saved = await updateCompany(company.name, {
      contactName: data.contactName.trim(),
      contactEmail: data.contactEmail.trim().toLowerCase(),
      kind: data.kind,
      type: company.kind === data.kind ? company.type : REQUESTER_KIND_LABEL[data.kind],
      city: data.city.trim(),
      site: data.site.trim().replace(/^https?:\/\//, ""),
      description: data.description.trim(),
    });
    if (!saved) return;
    setSaved(true);
  };

  return (
    <main className={`${PAGE} pb-20`}>
      <PageHead eyebrow="Solicitante" title="Meu perfil." lead="É o que o estudante vê antes de aceitar um contato." />

      <form onSubmit={save} noValidate className="vt-card p-6 md:p-8">
        <div className="mb-8 flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-navy font-display text-2xl font-medium text-offwhite">
            {company.name.trim()[0] || "?"}
          </span>
          <div className="min-w-0">
            <p className="font-display text-[22px] font-medium tracking-[-0.01em] text-navy">{company.name}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-navy/55">
              {company.type} · desde {company.since}
            </p>
          </div>
        </div>

        <div className="mb-6">
          <Label>Você representa</Label>
          <div className="flex flex-wrap gap-2">
            {KINDS.map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                aria-pressed={data.kind === kind}
                onClick={() => set({ kind })}
                className={`vt-pill ${data.kind === kind ? "vt-pill-selected" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Input label="Responsável" value={data.contactName} onChange={(v) => set({ contactName: v })} {...field("contactName")} />
          <Input
            label="E-mail de contato"
            type="email"
            value={data.contactEmail}
            onChange={(v) => set({ contactEmail: v })}
            hint="O estudante só vê depois que os dois aceitam o contato."
            {...field("contactEmail")}
          />
          <Input label="Cidade" value={data.city} onChange={(v) => set({ city: v })} {...field("city")} />
          <Input label="Site (opcional)" placeholder="suaorganizacao.com.br" value={data.site} onChange={(v) => set({ site: v })} />
          <div className="md:col-span-2">
            <Input
              label="Descrição"
              textarea
              rows={4}
              placeholder="O que a organização faz e que tipo de demanda costuma ter."
              value={data.description}
              onChange={(v) => set({ description: v })}
            />
          </div>
        </div>

        <div className="mt-8 flex items-center justify-end gap-4">
          {saved && (
            <span role="status" className="flex items-center gap-1.5 font-sans text-[13px] text-moss">
              <CheckIcon /> Alterações salvas
            </span>
          )}
          <button type="submit" className="vt-btn vt-btn-primary">
            Salvar alterações <ArrowIcon />
          </button>
        </div>
      </form>
    </main>
  );
}
