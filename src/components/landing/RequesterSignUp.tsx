import { useState, type FormEvent } from "react";
import { FormAlert, InputField } from "./ui";
import { ArrowIcon } from "@/components/app/Icons";
import { REQUESTER_KIND_LABEL } from "@/data/companies";
import { signUpRequester } from "@/lib/auth";
import { email, first, minLength, required, sameAs, useValidation } from "@/lib/validate";
import type { RequesterKind } from "@/types";

type Field = "organization" | "city" | "contactName" | "email" | "password" | "confirm";

const KINDS = Object.entries(REQUESTER_KIND_LABEL) as [RequesterKind, string][];

/** Cadastro do solicitante: é o perfil que o estudante vê antes de aceitar um contato. */
export function RequesterSignUp({ onSignedUp }: { onSignedUp: () => void }) {
  const [v, setV] = useState({
    kind: "empresa" as RequesterKind,
    organization: "",
    city: "",
    contactName: "",
    site: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [failure, setFailure] = useState<string | null>(null);

  const { validate, field } = useValidation<Field>(() => ({
    organization: required(v.organization, "Informe o nome da organização."),
    city: required(v.city, "Informe a cidade."),
    contactName: required(v.contactName, "Informe quem responde pela conta."),
    email: first(required(v.email, "Informe o e-mail de contato."), email(v.email)),
    password: first(required(v.password, "Crie uma senha."), minLength(v.password, 8)),
    confirm: first(required(v.confirm, "Repita a senha."), sameAs(v.confirm, v.password)),
  }));

  const set = (patch: Partial<typeof v>) => {
    setV({ ...v, ...patch });
    setFailure(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const result = await signUpRequester(v);
    if (result.ok) onSignedUp();
    else setFailure(result.error);
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {failure && <FormAlert>{failure}</FormAlert>}

      <fieldset>
        <legend className="mb-2 block font-mono text-[10px] uppercase tracking-[0.08em] text-navy/65">Você representa</legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              aria-pressed={v.kind === kind}
              onClick={() => set({ kind })}
              className={`vt-pill ${v.kind === kind ? "vt-pill-selected" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <InputField label="Organização" autoComplete="organization" value={v.organization} onChange={(x) => set({ organization: x })} {...field("organization")} />
        <InputField label="Cidade" placeholder="Maceió, AL" value={v.city} onChange={(x) => set({ city: x })} {...field("city")} />
        <InputField label="Responsável" autoComplete="name" value={v.contactName} onChange={(x) => set({ contactName: x })} {...field("contactName")} />
        <InputField
          id="signup-site"
          label="Site (opcional)"
          placeholder="suaorganizacao.com.br"
          value={v.site}
          onChange={(x) => set({ site: x })}
        />
      </div>
      <InputField
        label="E-mail de contato"
        type="email"
        autoComplete="email"
        placeholder="nome@organizacao.com.br"
        hint="O estudante só vê depois que os dois aceitam o contato."
        value={v.email}
        onChange={(x) => set({ email: x })}
        {...field("email")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <InputField
          label="Senha"
          type="password"
          autoComplete="new-password"
          hint="Mínimo de 8 caracteres."
          value={v.password}
          onChange={(x) => set({ password: x })}
          {...field("password")}
        />
        <InputField
          label="Confirmar senha"
          type="password"
          autoComplete="new-password"
          value={v.confirm}
          onChange={(x) => set({ confirm: x })}
          {...field("confirm")}
        />
      </div>

      <button type="submit" className="vt-btn vt-btn-primary mt-2 h-11 w-full justify-center">
        Criar conta <ArrowIcon />
      </button>
    </form>
  );
}
