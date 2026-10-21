import { useEffect, useState } from "react";
import { AuthModal } from "@/components/landing/AuthModal";
import LandingPage from "@/components/landing/LandingPage";
import PublicArea from "@/components/public/PublicArea";
import type { PublicRoute } from "@/components/public/routes";
import CuratorArea from "@/components/curator/CuratorArea";
import { CuratorSignIn } from "@/components/curator/CuratorSignIn";
import RequesterArea from "@/components/requester/RequesterArea";
import StudentArea from "@/components/student/StudentArea";
import { signOut, useSession } from "@/lib/auth";
import { AccountLinkPage, readAccountLink } from "@/components/landing/AccountLinkPage";

/**
 * Raiz da aplicação: landing, páginas públicas e as três áreas logadas.
 *
 * Não há roteador — o destino é estado local e não existe URL por tela. A
 * área logada vem da sessão do servidor (cookie HttpOnly): recarregar com
 * sessão aberta volta direto para ela. Ver docs/analise-frontend.md, seção 2.
 */
type Route =
  | { area: "landing" }
  | { area: "public"; route: PublicRoute }
  | { area: "curator_signin" };

export default function App() {
  const session = useSession();
  const [route, setRoute] = useState<Route>({ area: "landing" });
  const [modalOpen, setModalOpen] = useState(false);
  const [accountLink, setAccountLink] = useState(readAccountLink);
  const role = session?.account.role;

  // Sem roteador, a troca de tela não volta ao topo sozinha.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route, role]);

  const toLanding = () => setRoute({ area: "landing" });
  const openSignIn = () => setModalOpen(true);
  const toCurator = () => setRoute({ area: "curator_signin" });

  const onSignedIn = () => {
    setModalOpen(false);
    setRoute({ area: "landing" });
  };

  const exit = async () => {
    if (await signOut()) toLanding();
  };

  if (accountLink) return <AccountLinkPage link={accountLink} onDone={() => { setAccountLink(null); toLanding(); }} />;
  if (role === "student") return <StudentArea onBack={exit} />;
  if (role === "requester") return <RequesterArea onBack={exit} />;
  if (role === "curator") return <CuratorArea onBack={exit} />;

  if (route.area === "curator_signin") return <CuratorSignIn onSignedIn={toLanding} onBack={toLanding} />;

  return (
    <>
      {route.area === "landing" ? (
        <LandingPage
          onSignIn={openSignIn}
          onAdmin={toCurator}
          onNavigate={(publicRoute) => setRoute({ area: "public", route: publicRoute })}
        />
      ) : (
        <PublicArea
          route={route.route}
          onNavigate={(publicRoute) => setRoute({ area: "public", route: publicRoute })}
          onHome={toLanding}
          onSignIn={openSignIn}
          onAdmin={toCurator}
        />
      )}

      {modalOpen && <AuthModal onClose={() => setModalOpen(false)} onSignedIn={onSignedIn} />}
    </>
  );
}
