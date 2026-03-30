interface FlagProps { className?: string }

function FlagImg({ code, className }: { code: string; className?: string }) {
  return (
    <img
      src={`/flags/flag-${code}.svg`}
      width={28}
      height={14}
      alt=""
      decoding="async"
      {...(className !== undefined && className !== "" ? { className } : {})}
      style={{ display: "block", objectFit: "cover" }}
      aria-hidden
    />
  );
}

export function FlagGb(props: FlagProps) { return <FlagImg code="gb" {...props} />; }
export function FlagIl(props: FlagProps) { return <FlagImg code="il" {...props} />; }
export function FlagRu(props: FlagProps) { return <FlagImg code="ru" {...props} />; }
export function FlagFr(props: FlagProps) { return <FlagImg code="fr" {...props} />; }
export function FlagEs(props: FlagProps) { return <FlagImg code="es" {...props} />; }
