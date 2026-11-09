/**
 * Gera, a partir das logos em /public/logo, os arquivos derivados:
 *
 *   MESTRES (você troca estes dois, com os mesmos nomes):
 *     public/logo/logo-claro.png   — fundo transparente, para telas claras
 *     public/logo/logo-escuro.png  — versão para fundo escuro (menu, modo escuro, PDF)
 *
 *   GERADOS (não edite):
 *     public/logo/emblema.png      — só o círculo "LP" (cabeçalho do celular)
 *     public/logo/logo-pdf.png     — versão leve para o cabeçalho do PDF
 *     public/icons/*.png           — ícones do PWA e apple-touch-icon
 *
 * Rode com: npm run assets
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const raiz = process.cwd();
const logoDir = join(raiz, "public", "logo");
const iconDir = join(raiz, "public", "icons");
mkdirSync(iconDir, { recursive: true });

const mestre = join(logoDir, "logo-escuro.png");

/**
 * Recorte quadrado ao redor do círculo da logo (sem o texto "LPweb.dev" embaixo).
 * Coordenadas calculadas para a logo de 768×768 enviada; ajuste se trocar por outra.
 */
async function emblema(): Promise<sharp.Sharp> {
  const m = await sharp(mestre).metadata();
  const w = m.width ?? 768;
  const lado = Math.round(w * 0.677); // ~520px em 768
  return sharp(mestre).extract({
    left: Math.round(w * 0.159),
    top: Math.round(w * 0.091),
    width: lado,
    height: lado,
  });
}

async function main() {
  // emblema (cabeçalho do celular) — 192px nítidos para telas retina
  await (await emblema()).resize(192, 192).png({ compressionLevel: 9 }).toFile(join(logoDir, "emblema.png"));

  // logo do PDF: leve (o PDF é enviado pelo Telegram todo dia)
  await sharp(mestre)
    .resize(320, 320)
    .png({ palette: true, quality: 90, compressionLevel: 9 })
    .toFile(join(logoDir, "logo-pdf.png"));

  // ícones do PWA
  const rec = await (await emblema()).png().toBuffer();
  await sharp(rec).resize(192, 192).png().toFile(join(iconDir, "icon-192.png"));
  await sharp(rec).resize(512, 512).png().toFile(join(iconDir, "icon-512.png"));
  await sharp(rec).resize(180, 180).png().toFile(join(iconDir, "apple-touch-icon.png"));
  // maskable: o sistema recorta o ícone (círculo/arredondado), então o emblema precisa ficar
  // dentro da "zona segura". Reduzimos o recorte e o fundimos (bordas suaves) num fundo da
  // mesma cor da logo.
  const lado = 520;
  const mascara = Buffer.from(
    `<svg width="${lado}" height="${lado}" xmlns="http://www.w3.org/2000/svg">` +
      `<defs><filter id="b"><feGaussianBlur stdDeviation="14"/></filter></defs>` +
      `<rect x="34" y="34" width="${lado - 68}" height="${lado - 68}" rx="40" fill="#fff" filter="url(#b)"/></svg>`,
  );
  const suave = await sharp(rec).ensureAlpha().composite([{ input: mascara, blend: "dest-in" }]).png().toBuffer();
  const canto = await sharp(rec).extract({ left: 0, top: 0, width: 40, height: 40 }).stats();
  const [r, g, b] = canto.channels.map((c) => Math.round(c.mean));
  await sharp({ create: { width: 512, height: 512, channels: 3, background: { r, g, b } } })
    .composite([{ input: await sharp(suave).resize(400, 400).png().toBuffer(), gravity: "center" }])
    .png()
    .toFile(join(iconDir, "icon-maskable-512.png"));

  console.log("Ativos gerados: logo/emblema.png, logo/logo-pdf.png e icons/*.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
