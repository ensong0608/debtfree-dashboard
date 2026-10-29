/** Decorative theme art uses live appearance tokens, never financial data. */
export default function BrighterLandscape({className}: {className: string}) {
  return <svg className={className} viewBox="0 0 320 150" fill="none" aria-hidden="true" focusable="false">
    <circle cx="244" cy="60" r="29" fill="var(--theme-scenery-sun)"/>
    <path d="M244 17V8M278 29l7-7M290 60h10M209 28l-6-7" stroke="var(--theme-scenery-sun)" strokeWidth="3" strokeLinecap="round"/>
    <path d="M0 114C57 68 95 77 141 98C192 123 225 69 273 87C296 94 311 105 320 109V150H0Z" fill="var(--theme-scenery-back)"/>
    <path d="M0 135C57 106 111 142 169 123C220 106 271 95 320 119V150H0Z" fill="var(--theme-scenery-front)"/>
    <path d="M160 150C200 133 263 138 257 124C249 114 218 119 244 108C224 116 276 113 276 125C278 138 230 140 220 150Z" fill="var(--theme-scenery-path)"/>
    <g fill="var(--theme-scenery-leaf)"><ellipse cx="35" cy="123" rx="8" ry="23" transform="rotate(-30 35 123)"/><ellipse cx="48" cy="116" rx="8" ry="25" transform="rotate(22 48 116)"/><ellipse cx="58" cy="134" rx="8" ry="20" transform="rotate(55 58 134)"/><ellipse cx="300" cy="111" rx="7" ry="24" transform="rotate(-23 300 111)"/><ellipse cx="311" cy="105" rx="7" ry="26" transform="rotate(20 311 105)"/></g>
  </svg>;
}
