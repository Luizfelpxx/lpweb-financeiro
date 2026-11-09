import Image from "next/image";

/**
 * Logo completa (emblema + "LPweb.dev"): versão de fundo transparente no modo claro e
 * versão de fundo escuro no modo escuro. Defina o tamanho pela altura (ex.: "h-40").
 */
export default function Logo({ className = "h-40" }: { className?: string }) {
  return (
    <>
      <Image
        src="/logo/logo-claro.png"
        alt="LPweb.dev | Assessoria Financeira"
        width={500}
        height={500}
        priority
        className={`${className} aspect-square w-auto dark:hidden`}
      />
      <Image
        src="/logo/logo-escuro.png"
        alt="LPweb.dev | Assessoria Financeira"
        width={768}
        height={768}
        priority
        className={`${className} hidden aspect-square w-auto rounded-3xl dark:block`}
      />
    </>
  );
}
