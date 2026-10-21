import { SignInForm } from "@/components/landing/SignInForm";
import { Logo } from "@/components/public/Logo";
import { INSTITUTION } from "@/data/institution";
import { signInDemo } from "@/lib/auth";
import { useVitrine } from "@/lib/store";
import { useState } from "react";

/**
 * Login da curadoria, em página própria. Não há cadastro aberto: só entram
 * contas de curador criadas pela coordenação (no protótipo, a de exemplo).
 */
export function CuratorSignIn({ onSignedIn, onBack }: { onSignedIn: () => void; onBack: () => void }) {
  const { demo: demoEnabled } = useVitrine();
  const [error, setError] = useState("");
  const demo = async () => {
    const result = await signInDemo("curator");
    if (result.ok) onSignedIn();
    else setError(result.error);
  };

  return (
    <div className="vt-stone min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-[1200px] items-center gap-12 px-5 py-12 md:grid-cols-2 md:px-10">
        <div className="flex flex-col gap-6">
          <Logo inverted />
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.08em] text-sky">Área restrita</p>
          <h1 className="font-display text-[48px] font-medium leading-none tracking-[-0.035em] text-offwhite md:text-[64px]">
            Curadoria.
          </h1>
          <p className="max-w-[420px] font-sans text-[15px] font-light leading-[1.6] text-offwhite/70">
            Triagem de demandas, sugestões com justificativa e acompanhamento dos contatos. Só responsáveis
            cadastrados pela coordenação entram aqui.
          </p>
          <button
            onClick={onBack}
            className="self-start font-sans text-[13px] text-offwhite/65 transition-colors hover:text-offwhite"
          >
            ← Voltar para o site
          </button>
        </div>

        <section
          aria-labelledby="curator-title"
          className="rounded-3xl border border-offwhite/12 bg-offwhite/5 p-6 backdrop-blur-[2px] sm:p-8"
        >
          <h2 id="curator-title" className="mb-6 font-display text-2xl font-medium tracking-[-0.02em] text-offwhite">
            Entrar como curador.
          </h2>
          <SignInForm
            role="curator"
            emailLabel="E-mail"
            emailPlaceholder={`curadoria@${INSTITUTION.domain}`}
            submitLabel="Acessar curadoria"
            onSignedIn={onSignedIn}
            dark
          />
          <p className="mt-5 font-sans text-[13px] text-offwhite/65">
            Não há cadastro aberto. Para receber acesso, fale com a coordenação.
          </p>
          <div className="my-6 h-px bg-offwhite/12" />
          {demoEnabled && <button onClick={demo} className="vt-btn vt-btn-outline-light h-11 w-full justify-center">
            Entrar como curador de exemplo
          </button>}
          {error && <p role="alert" className="mt-3 text-sm text-offwhite">{error}</p>}
        </section>
      </div>
    </div>
  );
}
