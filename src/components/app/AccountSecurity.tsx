import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "./Modal";
import { InputField } from "@/components/landing/ui";
import { changePassword, requestVerificationEmail, signOutAll, useSession } from "@/lib/auth";
import { useVitrine } from "@/lib/store";
import { first, minLength, required, sameAs, useValidation } from "@/lib/validate";

export function AccountSecurity() {
  const session = useSession();
  const { auth } = useVitrine();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ current: "", password: "", confirm: "" });
  const [message, setMessage] = useState("");
  const { validate, field, reset } = useValidation<"current" | "password" | "confirm">(() => ({
    current: required(values.current, "Informe sua senha atual."),
    password: first(required(values.password, "Crie uma senha."), minLength(values.password, 8)),
    confirm: sameAs(values.confirm, values.password),
  }));
  useEffect(() => {
    setOpen(false); setValues({ current: "", password: "", confirm: "" }); setMessage(""); reset();
  }, [session?.account.id]);
  if (!session) return null;
  const close = () => { setOpen(false); setValues({ current: "", password: "", confirm: "" }); setMessage(""); reset(); };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    if (await changePassword(values.current, values.password)) {
      setValues({ current: "", password: "", confirm: "" }); reset();
      setMessage("Senha alterada. As outras sessões foram encerradas.");
    }
  };
  return <>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy/8 bg-white px-5 py-2 font-sans text-xs text-navy/65">
      <span>{session.account.emailVerifiedAt ? "E-mail confirmado" : "E-mail ainda não confirmado"}</span>
      <button className="underline underline-offset-4" onClick={() => setOpen(true)}>Conta e segurança</button>
    </div>
    {open && <Modal eyebrow="Configurações" title="Conta e segurança" onClose={close}>
      <p className="mb-4 break-all text-sm text-navy">{session.account.email}</p>
      {message && <p role="status" className="mb-5 text-sm text-moss">{message}</p>}
      {!session.account.emailVerifiedAt && <div className="mb-6 rounded-xl bg-navy/5 p-4 text-sm text-navy/65">
        <p>{auth.verificationRequired ? "Confirme seu e-mail para aparecer na vitrine, publicar e participar das demandas." : "Você pode confirmar que tem acesso ao endereço da sua conta."}</p>
        {auth.emailEnabled ? <button type="button" className="vt-btn vt-btn-secondary mt-3" onClick={async () => { const result = await requestVerificationEmail(); if (result) setMessage(result.message); }}>Enviar link de confirmação</button>
          : <p className="mt-2">O envio de e-mail ainda não foi habilitado pela coordenação.</p>}
      </div>}
      <form onSubmit={save} noValidate className="flex flex-col gap-4">
        <InputField {...field("current")} label="Senha atual" type="password" autoComplete="current-password" value={values.current} onChange={current => setValues({ ...values, current })} />
        <InputField {...field("password")} label="Nova senha" type="password" autoComplete="new-password" value={values.password} onChange={password => setValues({ ...values, password })} />
        <InputField {...field("confirm")} label="Confirmar nova senha" type="password" autoComplete="new-password" value={values.confirm} onChange={confirm => setValues({ ...values, confirm })} />
        <button type="submit" className="vt-btn vt-btn-primary">Alterar senha</button>
      </form>
      <button type="button" onClick={async () => { if (await signOutAll()) close(); }} className="vt-btn vt-btn-secondary mt-6">Sair de todas as sessões</button>
    </Modal>}
  </>;
}
