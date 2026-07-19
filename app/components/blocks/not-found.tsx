// not-found.tsx
//
// The 404 page + the generic <ErrorView /> twin. Rendered by the root
// ErrorBoundary (root.tsx) whenever a route throws / resolves to an
// ErrorResponse:
//   1. an unsupported `:lang?` param (lang_layout loader throws — see there),
//   2. no matching route (React Router's built-in unmatched → 404),
//   3. any other error → <ErrorView /> (same layout, error copy + dev stack).
//
// They live OUTSIDE the localized data chrome (the boundary sits above
// lang_layout, so no loc loader has run), hence the tiny self-contained copy
// dictionaries instead of the usual `t()` loc lookup. Home link is localized
// via the resolved lang param (invalid langs fall back to the default → "/").

import type { ReactNode } from "react";
import { NavLink, useParams } from "react-router";
import { langByParam } from "~/lib/lang";
import { Icon } from "~/components/icons/opd_icons";
import { INTERNAL_LINK_CLASS } from "~/components/opd_views/opd_micros";

type Copy = { title: string; body: string; home: string };

// Keyed by lang_code (langByParam resolves the param → a SITE_LANGS entry, so an
// unsupported param lands on the default). Kept in sync with SITE_LANGS.
const COPY: Record<string, Copy> = {
  en: {
    title: "Page not found",
    body: "The page you're looking for doesn't exist or has moved.",
    home: "Back to home",
  },
  de: {
    title: "Seite nicht gefunden",
    body: "Die gesuchte Seite existiert nicht oder wurde verschoben.",
    home: "Zur Startseite",
  },
  fr: {
    title: "Page introuvable",
    body: "La page que vous recherchez n'existe pas ou a été déplacée.",
    home: "Retour à l'accueil",
  },
  it: {
    title: "Pagina non trovata",
    body: "La pagina che cerchi non esiste o è stata spostata.",
    home: "Torna alla home",
  },
  es: {
    title: "Página no encontrada",
    body: "La página que busca no existe o se ha movido.",
    home: "Volver al inicio",
  },
  pt: {
    title: "Página não encontrada",
    body: "A página que procura não existe ou foi movida.",
    home: "Voltar ao início",
  },
  rm: {
    title: "Pagina betg chattada",
    body: "La pagina che Vus tschertgais n'exista betg u è vegnida spustada.",
    home: "Turnar a la pagina da partenza",
  },
};

// Same layout for the non-404 error page: quiet status figure, heading, body,
// home link — plus the stack trace in dev.
const ERROR_COPY: Record<string, Copy> = {
  en: {
    title: "Something went wrong",
    body: "An unexpected error occurred. Please try again later.",
    home: "Back to home",
  },
  de: {
    title: "Etwas ist schiefgelaufen",
    body: "Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es später erneut.",
    home: "Zur Startseite",
  },
  fr: {
    title: "Une erreur est survenue",
    body: "Une erreur inattendue s'est produite. Veuillez réessayer plus tard.",
    home: "Retour à l'accueil",
  },
  it: {
    title: "Qualcosa è andato storto",
    body: "Si è verificato un errore imprevisto. Riprova più tardi.",
    home: "Torna alla home",
  },
  es: {
    title: "Algo salió mal",
    body: "Se ha producido un error inesperado. Vuelva a intentarlo más tarde.",
    home: "Volver al inicio",
  },
  pt: {
    title: "Algo correu mal",
    body: "Ocorreu um erro inesperado. Tente novamente mais tarde.",
    home: "Voltar ao início",
  },
  rm: {
    title: "Insatge è ì fallà",
    body: "In sbagl nunspetgà è capità. Empruvai pli tard anc ina giada.",
    home: "Turnar a la pagina da partenza",
  },
};

/** Shared frame of the 404 + error pages. `figure` is the big muted status
 *  ("404", "500"); `extra` renders below the home link (dev stack). */
function ErrorFrame({
  figure,
  title,
  body,
  home,
  extra,
}: {
  figure?: string | undefined;
  title: string;
  body: string;
  home: string;
  extra?: ReactNode;
}) {
  const { lang } = useParams();
  const { lang_param } = langByParam(lang);
  const homePath = lang_param ? `/${lang_param}` : "/";

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 p-4 text-center">
      {figure ? (
        <p className="text-2xl font-semibold tracking-tight tabular-nums text-muted-foreground">
          {figure}
        </p>
      ) : null}
      <h1 className="text-2xl font-semibold tracking-tight text-balance">
        {title}
      </h1>
      <p className="max-w-prose text-base text-muted-foreground text-balance">
        {body}
      </p>
      <NavLink to={homePath} end viewTransition className={INTERNAL_LINK_CLASS}>
        {home}
        <Icon name="arrow-right" className="size-3.5 shrink-0" />
      </NavLink>
      {extra}
    </main>
  );
}

export default function NotFound() {
  const { lang } = useParams();
  const { lang_code } = langByParam(lang);
  const t = COPY[lang_code] ?? COPY.en;

  return <ErrorFrame figure="404" title={t.title} body={t.body} home={t.home} />;
}

/** The root ErrorBoundary's non-404 page. `details` (an HTTP statusText or a
 *  dev error message) replaces the generic body copy when present. */
export function ErrorView({
  status,
  details,
  stack,
}: {
  status?: number | undefined;
  details?: string | undefined;
  stack?: string | undefined;
}) {
  const { lang } = useParams();
  const { lang_code } = langByParam(lang);
  const t = ERROR_COPY[lang_code] ?? ERROR_COPY.en;

  return (
    <ErrorFrame
      figure={status != null ? String(status) : undefined}
      title={t.title}
      body={details || t.body}
      home={t.home}
      extra={
        stack ? (
          <pre className="mt-2 max-w-full overflow-x-auto rounded-lg border border-border bg-muted p-4 text-left text-xs leading-relaxed text-muted-foreground">
            <code>{stack}</code>
          </pre>
        ) : null
      }
    />
  );
}
