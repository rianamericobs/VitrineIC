import { useState, type FormEvent } from "react";
import { FormAlert, InputField } from "./ui";
import { ArrowIcon } from "@/components/app/Icons";
import { requestPasswordReset, signIn } from "@/lib/auth";
import { useVitrine } from "@/lib/store";
import { email as emailRule, first, required, useValidation } from "@/lib/validate";
import type { Role } from "@/types";

/**
 * Login por e-mail e senha, usado pelas duas abas do modal e pela página da
 * curadoria. `checkEmail` é a regra do e-mail do papel (UFAL ou qualquer um).
 */
export function SignInForm({
  role,
  emailLabel,
  emailPlaceholder,
  checkEmail = emailRule,
  submitLabel = "Acessar",
  onSignedIn,
  dark = false,
}: {
  role: Role;
  emailLabel: string;
  emailPlaceholder: string;
  checkEmail?: (v: string) => string | null;
  submitLabel?: string;
  onSignedIn: (role: Role) => void;
  dark?: boolean;
}) {
  const [values, setValues] = useState({ email: "", password: "" });
  const [failure, setFailure] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [message, setMessage] = useState("");
  const { auth } = useVitrine();

  const { validate, field } = useValidation<"email" | "password">(() => ({
    email: first(required(values.email, "Digite seu e-mail."), checkEmail(values.email)),
    password: recovering ? null : required(values.password, "Digite sua senha."),
  }));

  const set = (patch: Partial<typeof values>) => {
    setValues({ ...values, ...patch });
    setFailure(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (recovering) {
      const result = await requestPasswordReset(values.email);
      if (result) setMessage(result.message);
      return;
    }
    const result = await signIn(values.email, values.password, role);
    if (result.ok) onSignedIn(result.account.role);
    else setFailure(`${result.error} Confira os dados${role === "curator" ? "." : " ou crie uma conta."}`);
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {failure && <FormAlert>{failure}</FormAlert>}
      {message && <p role="status" className={`text-sm ${dark ? "text-offwhite" : "text-moss"}`}>{message}</p>}
      <InputField
        label={emailLabel}
        type="email"
        autoComplete="email"
        placeholder={emailPlaceholder}
        value={values.email}
        onChange={(v) => set({ email: v })}
        dark={dark}
        {...field("email")}
      />
      {!recovering && <InputField
        label="Senha"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        value={values.password}
        onChange={(v) => set({ password: v })}
        dark={dark}
        {...field("password")}
      />}
      <button
        type="submit"
        className={`vt-btn ${dark ? "vt-btn-cream" : "vt-btn-primary"} mt-2 h-11 w-full justify-center`}
      >
        {recovering ? "Enviar instruções" : submitLabel} <ArrowIcon />
      </button>
      {auth.emailEnabled && <button type="button" onClick={() => { setRecovering(!recovering); setFailure(null); setMessage(""); setValues({ ...values, password: "" }); }} className={`text-center text-sm underline underline-offset-4 ${dark ? "text-offwhite/75" : "text-navy/65"}`}>
        {recovering ? "Voltar para entrar" : "Esqueci minha senha"}
      </button>}
    </form>
  );
}
