interface Props {
  nome: string;
  cor?: string;
}

export function CategoryBadge({ nome, cor = "#6b7280" }: Props) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
      style={{ backgroundColor: cor }}
    >
      {nome}
    </span>
  );
}
