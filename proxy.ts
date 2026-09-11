import { NextResponse, type NextRequest } from "next/server"

// Proxy (E17): CSP com nonce por requisição e limite de taxa nas server actions.
// Os cabeçalhos de segurança que não mudam por requisição ficam em next.config.ts.

const JANELA_MS = 60_000
// por IP e por minuto; a edição em linha já agrupa as gravações com 300ms de espera
const MAX_ACOES = 90
const acessos = new Map<string, { inicio: number; n: number }>()

/**
 * Janela fixa em memória, por instância. Segura rajadas e scripts ingênuos; a proteção
 * definitiva, compartilhada entre instâncias, é o firewall da Vercel ou um contador no banco.
 */
function excedeuLimite(ip: string, agora: number): boolean {
  const a = acessos.get(ip)
  if (!a || agora - a.inicio > JANELA_MS) {
    acessos.set(ip, { inicio: agora, n: 1 })
    if (acessos.size > 5000) for (const [k, x] of acessos) if (agora - x.inicio > JANELA_MS) acessos.delete(k)
    return false
  }
  a.n++
  return a.n > MAX_ACOES
}

function politica(nonce: string, dev: boolean): string {
  return [
    "default-src 'self'",
    // em desenvolvimento o React usa eval para reconstruir as pilhas de erro do servidor
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // estilos em atributo (larguras das trilhas, posições na grade) não aceitam nonce
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    // o motor e as hipóteses rodam em Web Workers do próprio app
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ")
}

export function proxy(request: NextRequest) {
  // server action: POST para a própria página com o cabeçalho next-action
  if (request.method === "POST" && request.headers.has("next-action")) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local"
    if (excedeuLimite(ip, Date.now())) {
      return new NextResponse("Muitas gravações em pouco tempo. Aguarde um minuto e tente de novo.", {
        status: 429,
        headers: { "Retry-After": "60" },
      })
    }
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
  const csp = politica(nonce, process.env.NODE_ENV === "development")
  const cabecalhos = new Headers(request.headers)
  cabecalhos.set("x-nonce", nonce)
  cabecalhos.set("Content-Security-Policy", csp)
  const resposta = NextResponse.next({ request: { headers: cabecalhos } })
  resposta.headers.set("Content-Security-Policy", csp)
  return resposta
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
}
