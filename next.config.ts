import type { NextConfig } from "next"

// Cabeçalhos de segurança fixos (E17). A CSP, que leva um nonce por requisição, fica em proxy.ts.
const seguranca = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // raiz fixa: com o pnpm-workspace.yaml, o Turbopack às vezes inferia a pasta errada e o dev caía
  turbopack: { root: __dirname },
  async headers() {
    return [{ source: "/:path*", headers: seguranca }]
  },
}

export default nextConfig
