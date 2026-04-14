interface Props {
  size?: number;
  className?: string;
}

export default function ChatSphereLogo({ size = 40, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="cs-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="cs-dot" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#c4b5fd" />
        </linearGradient>
      </defs>

      {/* Rounded square bg */}
      <rect width="64" height="64" rx="16" fill="url(#cs-bg)" />

      {/* Chat bubble */}
      <path
        d="M10 16C10 12.686 12.686 10 16 10H48C51.314 10 54 12.686 54 16V36C54 39.314 51.314 42 48 42H36L26 54V42H16C12.686 42 10 39.314 10 36V16Z"
        fill="white"
        fillOpacity={0.15}
      />

      {/* Three dots */}
      <circle cx="22" cy="29" r="3.5" fill="url(#cs-dot)" />
      <circle cx="32" cy="29" r="3.5" fill="white" />
      <circle cx="42" cy="29" r="3.5" fill="url(#cs-dot)" fillOpacity={0.7} />
    </svg>
  );
}
