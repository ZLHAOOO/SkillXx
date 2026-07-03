interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="toggle-pill"
      style={{
        "--pill-w": "44px",
        "--pill-h": "26px",
        "--thumb-s": "20px",
        "--thumb-gap": "3px",
        "--thumb-travel": "calc(var(--pill-w) - var(--thumb-s) - var(--thumb-gap) * 2)",
        "--thumb-pos": checked ? "var(--thumb-travel)" : "var(--thumb-gap)",
      } as React.CSSProperties}
      data-checked={checked}
      data-disabled={disabled}
    >
      <span className="toggle-thumb" />
    </button>
  );
}
