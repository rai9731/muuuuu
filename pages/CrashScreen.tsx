import { LogoMark } from '@components/layout/Logo';

/** Tela exibida quando um erro inesperado derruba a interface (o erro já foi enviado ao Sentry). */
export function CrashScreen() {
  return (
    <div className="bg-rural flex min-h-screen items-center justify-center p-4">
      <div className="glass max-w-md rounded-3xl p-8 text-center">
        <LogoMark className="mx-auto h-14 w-14" />
        <h1 className="mt-5 text-xl font-semibold text-grafite">Ops! Algo saiu do pasto.</h1>
        <p className="mt-2 text-sm text-grafite/75">
          Tivemos um problema inesperado ao exibir esta tela. Nossa equipe já foi avisada. Recarregue a página para continuar.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 h-11 rounded-xl bg-pasto px-6 text-sm font-semibold text-white transition hover:bg-folha"
        >
          Recarregar página
        </button>
      </div>
    </div>
  );
}
