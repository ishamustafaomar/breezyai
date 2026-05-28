import logoUrl from "@/assets/breezy-logo.png";

export function BreezyLogo({ className = "size-8" }: { className?: string }) {
  return (
    <img
      src={logoUrl}
      alt="Breezy"
      className={`${className} object-contain drop-shadow-sm`}
      draggable={false}
    />
  );
}
