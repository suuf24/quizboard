/**
 * Satu set ikon gambar tangan untuk menggantikan emoji.
 *
 * Kenapa bukan emoji: emoji digambar oleh font sistem, jadi tombol yang sama tampil berbeda
 * di laptop guru dan di PC lab, dan sebagian di antaranya kecil serta pucat saat diproyeksikan.
 * Ikon di sini satu warna (`currentColor`), jadi ia ikut warna teks di sekitarnya.
 *
 * Bahasa gambarnya satu: kotak 24px, garis 1.75px, ujung dan sambungan persegi, tanpa isian
 * kecuali tombol transport (putar, jeda, berikutnya) yang memang lebih terbaca sebagai
 * bentuk penuh dari jauh.
 */

type IconProps = {
  size?: number;
  className?: string;
};

function svgProps(size: number, className?: string) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    className,
    'aria-hidden': true,
    focusable: 'false',
  } as const;
}

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'square',
  strokeLinejoin: 'miter',
} as const;

export function IconPlay({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M8 5.5 18 12 8 18.5Z" fill="currentColor" />
    </svg>
  );
}

export function IconPause({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M8.5 5.5h2.5v13H8.5zM13 5.5h2.5v13H13z" fill="currentColor" />
    </svg>
  );
}

export function IconNext({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M6.5 5.5 15 12l-8.5 6.5Z" fill="currentColor" />
      <path d="M16.5 5.5h2v13h-2z" fill="currentColor" />
    </svg>
  );
}

export function IconEye({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)} {...STROKE}>
      <path d="M2.5 12s3.7-5.8 9.5-5.8S21.5 12 21.5 12s-3.7 5.8-9.5 5.8S2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}

export function IconKey({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)} {...STROKE}>
      <circle cx="8" cy="15.5" r="3.4" />
      <path d="M10.6 13.1 20 3.8M16.4 7.4l2.6 2.6M13.8 10l2.6 2.6" />
    </svg>
  );
}

export function IconSound({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)} {...STROKE}>
      <path d="M4 9.5h3.2L11.5 6v12l-4.3-3.5H4Z" />
      <path d="M15 8.6a4.6 4.6 0 0 1 0 6.8M17.8 6a8 8 0 0 1 0 12" />
    </svg>
  );
}

export function IconMute({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)} {...STROKE}>
      <path d="M4 9.5h3.2L11.5 6v12l-4.3-3.5H4Z" />
      <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" />
    </svg>
  );
}

export function IconExpand({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)} {...STROKE}>
      <path d="M4 9V4h5M20 15v5h-5M15 4h5v5M9 20H4v-5" />
    </svg>
  );
}

export function IconCollapse({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)} {...STROKE}>
      <path d="M9 4v5H4M15 20v-5h5M20 9h-5V4M4 15h5v5" />
    </svg>
  );
}

export function IconClose({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)} {...STROKE}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </svg>
  );
}

export function IconChevronDown({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)} {...STROKE}>
      <path d="M6 9.5l6 6 6-6" />
    </svg>
  );
}

export function IconCheck({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)} {...STROKE}>
      <path d="M4.5 12.5l5 5L19.5 7" />
    </svg>
  );
}

export function IconAlert({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)} {...STROKE}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5.5M12 16.4v.2" />
    </svg>
  );
}

export function IconFolder({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)} {...STROKE}>
      <path d="M3.5 6.5h6l2 2.5h9v9.5h-17z" />
    </svg>
  );
}

export function IconDownload({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)} {...STROKE}>
      <path d="M12 4v10.5M7.5 10.5 12 15l4.5-4.5M4.5 19.5h15" />
    </svg>
  );
}

export function IconPrint({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)} {...STROKE}>
      <path d="M7 9.5V4h10v5.5M7 17H4.5V9.5h15V17H17" />
      <path d="M7 14h10v6H7z" />
    </svg>
  );
}
