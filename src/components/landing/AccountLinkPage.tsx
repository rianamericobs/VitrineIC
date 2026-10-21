import { useEffect, useState, type FormEvent } from "react";
import { FormAlert, InputField } from "./ui";
import { Logo } from "@/components/public/Logo";
import { completeAccountLink } from "@/lib/auth";
import { first, minLength, required, sameAs, useValidation } from "@/lib/validate";

export interface AccountLink { action: "reset-password" | "verify-email"; token: string }

/** Fragmentos não são enviados ao servidor nem registrados nos logs HTTP. */
export function readAccountLink(): AccountLink | null {
  const match = /^#account\/(reset-password|verify-email)\/([^/]+)$/.exec(window.location.hash);
  return match ? { action: match[1] as AccountLink["action"], token: match[2] } : null;
}

export function AccountLinkPage({ link, onDone }: { link: AccountLink; onDone: () => void }) {
  const [values, setValues] = useState({ password: "", confirm: "" });
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  const reset = link.action === "reset-password";
  const { validate, field } = useValidation<"password" | "confirm">(() => reset ? {
    password: first(required(values.password, "Crie uma senha."), minLength(values.password, 8)),
    confirm: sameAs(values.confirm, values.password),
  } : {});
  useEffect(() => {
    // O token permanece somente na memória desta tela.
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    setFailure("");
    const result = await completeAccountLink(link.action, link.token, reset ? values.password : undefined);
    if (result) { setValues({ password: "", confirm: "" }); setMessage(result); }
    else setFailure("Não foi possível concluir. Se o link expirou ou já foi usado, solicite outro na plataforma.");
  };
  return <main className="grid min-h-screen place-content-center gap-8 bg-offwhite p-5 text-navy">
    <Logo />
    <section className="vt-card w-full max-w-[440px] p-6 sm:p-8">
      <h1 className="mb-5 font-display text-2xl font-medium">{reset ? "Redefinir senha" : "Confirmar e-mail"}</h1>
      {message ? <>
        <p role="status" className="mb-5 text-sm text-moss">{message}</p>
        <button onClick={onDone} className="vt-btn vt-btn-primary">Voltar à plataforma</button>
      </> : <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {failure && <FormAlert>{failure}</FormAlert>}
        {reset ? <>
          <InputField {...field("password")} label="Nova senha" type="password" autoComplete="new-password" hint="Mínimo de 8 caracteres." value={values.password} onChange={password => setValues({ ...values, password })} />
          <InputField {...field("confirm")} label="Confirmar nova senha" type="password" autoComplete="new-password" value={values.confirm} onChange={confirm => setValues({ ...values, confirm })} />
        </> : <p className="text-sm text-navy/65">Confirme que você tem acesso ao e-mail desta conta para continuar.</p>}
        <button type="submit" className="vt-btn vt-btn-primary">{reset ? "Salvar nova senha" : "Confirmar meu e-mail"}</button>
        <button type="button" onClick={onDone} className="vt-btn vt-btn-ghost">Voltar à plataforma</button>
      </form>}
    </section>
  </main>;
}
