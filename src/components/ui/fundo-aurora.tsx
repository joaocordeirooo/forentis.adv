// Fundo estático: manchas de cor em gradiente (sem desfoque nem animação, que pesam na placa de vídeo).
export function FundoAurora() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        background:
          'radial-gradient(60% 50% at 10% 0%, rgba(124,58,237,0.16), transparent 70%),' +
          'radial-gradient(50% 45% at 95% 35%, rgba(14,165,233,0.10), transparent 70%),' +
          'radial-gradient(45% 40% at 35% 100%, rgba(16,185,129,0.08), transparent 70%)',
      }}
    />
  );
}
