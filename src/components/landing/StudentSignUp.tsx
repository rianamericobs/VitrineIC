import { useState, type FormEvent } from "react";
import { FormAlert, InputField, SelectField } from "./ui";
import { ArrowIcon } from "@/components/app/Icons";
import { INSTITUTION, UNITS, findUnit } from "@/data/institution";
import { signUpStudent } from "@/lib/auth";
import { first, minLength, required, sameAs, ufalEmail, useValidation } from "@/lib/validate";

type Field = "name" | "email" | "unit" | "course" | "password" | "confirm" | "consent";

/** Cadastro do estudante. Depois da conta, o onboarding monta o perfil. */
export function StudentSignUp({ onSignedUp }: { onSignedUp: () => void }) {
  const [v, setV] = useState({ name: "", email: "", unit: "", course: "", password: "", confirm: "", consent: false });
  const [failure, setFailure] = useState<string | null>(null);
  const unit = findUnit(v.unit);

  const { validate, field } = useValidation<Field>(() => ({
    name: required(v.name, "Informe seu nome completo."),
    email: first(required(v.email, "Informe seu e-mail institucional."), ufalEmail(v.email)),
    unit: required(v.unit, "Escolha o instituto ou faculdade."),
    course: required(v.course, "Escolha o curso."),
    password: first(required(v.password, "Crie uma senha."), minLength(v.password, 8)),
    confirm: first(required(v.confirm, "Repita a senha."), sameAs(v.confirm, v.password)),
    consent: v.consent ? null : "Para entrar na vitrine, aceite que seu perfil apareça nela.",
  }));

  const set = (patch: Partial<typeof v>) => {
    setV({ ...v, ...patch });
    setFailure(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const result = await signUpStudent(v);
    if (result.ok) onSignedUp();
    else setFailure(result.error);
  };

  const consent = field("consent");

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {failure && <FormAlert>{failure}</FormAlert>}
      <InputField label="Nome completo" autoComplete="name" value={v.name} onChange={(x) => set({ name: x })} {...field("name")} />
      <InputField
        label="E-mail institucional"
        type="email"
        autoComplete="email"
        placeholder={INSTITUTION.emailExample}
        hint="Qualquer e-mail da UFAL, terminado em .ufal.br."
        value={v.email}
        onChange={(x) => set({ email: x })}
        {...field("email")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Instituto ou faculdade"
          options={UNITS.map((u) => ({ value: u.short, label: `${u.short} · ${u.name}` }))}
          value={v.unit}
          onChange={(x) => set({ unit: x, course: "" })}
          {...field("unit")}
        />
        <SelectField
          label="Curso"
          options={(unit?.courses ?? []).map((c) => ({ value: c, label: c }))}
          value={v.course}
          onChange={(x) => set({ course: x })}
          disabled={!unit}
          hint="Muda conforme o instituto."
          {...field("course")}
        />
      </div>
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

      <div>
        <label className="flex cursor-pointer items-start gap-3 font-sans text-[13px] leading-[1.5] text-navy/80">
          <input
            id={consent.id}
            type="checkbox"
            checked={v.consent}
            onChange={(e) => set({ consent: e.target.checked })}
            className="mt-0.5 size-4 shrink-0 accent-navy"
            aria-invalid={consent.error ? true : undefined}
            aria-describedby={consent.error ? `${consent.id}-error` : undefined}
          />
          Aceito que meu perfil e meus projetos apareçam na vitrine pública.
        </label>
        {consent.error && (
          <p id={`${consent.id}-error`} className="vt-field-error mt-1.5 pl-7 font-sans text-xs text-terracotta">
            {consent.error}
          </p>
        )}
      </div>

      <button type="submit" className="vt-btn vt-btn-primary mt-2 h-11 w-full justify-center">
        Criar conta e montar o perfil <ArrowIcon />
      </button>
    </form>
  );
}
