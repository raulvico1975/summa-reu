import { cn } from '@/lib/utils';

type PublicEditorialMarkProps = {
  className?: string;
  align?: 'left' | 'center';
  size?: 'xs' | 'sm' | 'md';
};

export function PublicEditorialMark({
  className,
  align = 'left',
  size = 'md',
}: PublicEditorialMarkProps) {
  const isCenter = align === 'center';
  const isExtraSmall = size === 'xs';
  const isSmall = size === 'sm';

  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none relative block',
        isExtraSmall ? 'h-3.5 w-28' : isSmall ? 'h-4 w-32' : 'h-5 w-44',
        isCenter ? 'mx-auto' : '',
        className
      )}
    >
      <span
        className={cn(
          'absolute top-0 rounded-[999px] bg-sky-100/55 blur-[5px]',
          isExtraSmall
            ? 'left-[4%] h-3 w-[78%] blur-[4px]'
            : isSmall
              ? 'left-[3%] h-3.5 w-[82%]'
              : 'left-[2%] h-4 w-[86%]'
        )}
      />
      <svg viewBox="0 0 240 34" className="absolute inset-0 h-full w-full overflow-visible" fill="none">
        <path
          d="M6 21C44 23 86 23 126 19C164 15 198 12 236 14"
          className="summa-editorial-mark-path"
          pathLength={1}
        />
        <path
          d="M18 24C66 26 122 26 178 21C202 19 220 18 236 18"
          className="summa-editorial-mark-path summa-editorial-mark-path-secondary"
          pathLength={1}
        />
      </svg>
    </span>
  );
}
