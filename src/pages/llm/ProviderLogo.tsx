import { useMemo } from "react";
import { getProviderInitial } from "@/utils/providerIcon";
import { getProviderSvgContent, isProviderPng, getProviderPngPath } from "@/utils/providerLogoSvg";
import { useColorScheme } from "@/hooks/useColorScheme";

export function ProviderLogo({ name, id, size = 40 }: { name: string; id?: string; size?: number }) {
  const colorScheme = useColorScheme();

  // PNG providers are served as static assets via <img>.
  if (isProviderPng(name, id)) {
    const pngSrc = getProviderPngPath(name, id);
    if (pngSrc) {
      return (
        <img
          src={pngSrc}
          alt={name}
          width={size}
          height={size}
          style={{
            borderRadius: "6px",
            flexShrink: 0,
            objectFit: "contain",
          }}
        />
      );
    }
  }

  const rawSvg = getProviderSvgContent(name, id, colorScheme);

  const styledSvg = useMemo(() => {
    if (!rawSvg) return null;

    // Detect intrinsic dimensions and viewBox presence before transforming.
    const wMatch = rawSvg.match(/\bwidth="(\d+)"|\bwidth='(\d+)'/);
    const hMatch = rawSvg.match(/\bheight="(\d+)"|\bheight='(\d+)'/);
    const hasViewBox = /viewBox=/.test(rawSvg);

    let html = rawSvg
      .replace(/^<\?xml[^>]*>\s*/i, "")
      .replace(/^<!--[\s\S]*?-->\s*/i, "")
      .replace(/^<!DOCTYPE[^>]*>\s*/i, "");

    // Add viewBox from width/height if missing (required for proper scaling),
    // then strip fixed dimensions so the viewBox fills the container.
    if (!hasViewBox && wMatch && hMatch) {
      const w = wMatch[1] || wMatch[2];
      const h = hMatch[1] || hMatch[2];
      html = html.replace(/^<svg\b/, `<svg viewBox="0 0 ${w} ${h}"`);
    }

    html = html
      .replace(/\b(?:width|height)="[^"]*"/g, "")
      .replace(/\b(?:width|height)='[^']*'/g, "");

    return html;
  }, [rawSvg]);

  if (styledSvg) {
    return (
      <div
        dangerouslySetInnerHTML={{ __html: styledSvg }}
        style={{
          width: size,
          height: size,
          borderRadius: "6px",
          flexShrink: 0,
          overflow: "hidden",
        }}
      />
    );
  }

  const initial = getProviderInitial(name);
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "6px",
        backgroundColor: "var(--muted)", color: "var(--muted-foreground)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.4, fontWeight: 700, flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
}
