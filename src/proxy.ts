import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Renova a sessão do Supabase e protege as telas: sem login → /login.
 * (Cada página e Server Action também valida o usuário; isto é só a 1ª barreira.)
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { pathname } = request.nextUrl;
  const emLogin = pathname === "/login";
  const emApi = pathname.startsWith("/api/");

  // Sem variáveis do Supabase: só a tela de login (que explica o que falta) fica acessível.
  if (!url || !anon) {
    if (emLogin) return NextResponse.next();
    if (emApi) return Response.json({ erro: "Supabase não configurado" }, { status: 503 });
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let resposta = NextResponse.next({ request });
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesParaGravar) {
        cookiesParaGravar.forEach(({ name, value }) => request.cookies.set(name, value));
        resposta = NextResponse.next({ request });
        cookiesParaGravar.forEach(({ name, value, options }) =>
          resposta.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !emLogin) {
    if (emApi) return Response.json({ erro: "Não autenticado" }, { status: 401 });
    const destino = NextResponse.redirect(new URL("/login", request.url));
    resposta.cookies.getAll().forEach((c) => destino.cookies.set(c));
    return destino;
  }
  if (user && emLogin) {
    const destino = NextResponse.redirect(new URL("/", request.url));
    resposta.cookies.getAll().forEach((c) => destino.cookies.set(c));
    return destino;
  }
  return resposta;
}

export const config = {
  matcher: [
    // exclui: arquivos estáticos, PWA e a rota do cron (protegida por CRON_SECRET)
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|logo/|icons/|modelo-importacao.csv|api/cron/).*)",
  ],
};
