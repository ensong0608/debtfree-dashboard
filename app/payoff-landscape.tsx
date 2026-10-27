/** Decorative scenery shared only by Home and the expanded payoff schedule. */
export default function PayoffLandscape() {
  return <svg viewBox="0 0 900 320" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="payoff-sky" x2="0" y2="1"><stop stopColor="var(--theme-art-sky)"/><stop offset="1" stopColor="var(--theme-art-cloud)"/></linearGradient>
      <linearGradient id="payoff-water" x2="0" y2="1"><stop stopColor="var(--theme-art-water)"/><stop offset="1" stopColor="var(--theme-art-sky)"/></linearGradient>
    </defs>
    <path fill="url(#payoff-sky)" d="M0 0h900v320H0z"/>
    <circle cx="727" cy="107" r="57" fill="var(--theme-art-sun)"/>
    <g fill="none" stroke="var(--theme-warning)" strokeWidth="4"><path d="m727 28 1-15m41 26 9-14m20 43 16-5m-123-21-8-15m-21 45-16-5"/></g>
    <g fill="var(--theme-art-cloud)" opacity=".85"><path d="M400 90q8-20 24-12 12-40 39-8 20-8 27 20zM645 136q10-20 24-11 13-30 33-4 20-7 25 15zM130 57q12-19 27-10 16-28 32-2 18-5 25 12z"/></g>
    <path fill="var(--theme-art-mountain-back)" d="m210 231 161-128 61 56 67-94 109 112 53-53 147 122z"/>
    <path fill="var(--theme-art-mountain-front)" d="m329 230 170-165 107 113 48-54 172 124z"/>
    <path fill="var(--theme-art-cloud)" d="m445 120 54-55 47 49-28-11-15 18-15-29-22 29zM346 124l25-21 30 28-28-9-12 11z"/>
    <path fill="var(--theme-art-mountain-front)" d="m499 65-19 119 60 59-151 3zM654 124l-31 103 95 16z"/>
    <path fill="var(--theme-art-mountain-back)" d="M0 257q140-78 252-26t244 2q170-40 404-20v107H0z"/>
    <path fill="url(#payoff-water)" d="M260 257q189-29 440-11l-111 25 147 21 111 28H92l314-37z"/>
    <g fill="none" stroke="var(--theme-art-cloud)" strokeWidth="3" opacity=".7"><path d="M434 261h158m-275 28h178m49 15h102m-161-31h44"/></g>
    <path fill="var(--theme-art-sun)" d="M900 249q-192-13-155 23t-34 48h95q71-38-1-54t95 3z"/>
    <g fill="var(--theme-art-tree)">{[35,75,124,567,603,798,836,880].map((x,i)=><path key={x} d={`M${x} ${300-i%3*10}v-95l-22 61h12l-22 25h22v25h20v-25h21l-23-25h12l-20-61z`}/>)}</g>
    <g fill="var(--theme-art-mountain-front)">{[10,92,850,898].map(x=><path key={x} d={`M${x} 325V183l-23 68h10l-21 34h23v40z`}/>)}</g>
    <g fill="var(--theme-art-tree)"><ellipse cx="25" cy="287" rx="18" ry="54" transform="rotate(-33 25 287)"/><ellipse cx="62" cy="304" rx="16" ry="40" transform="rotate(30 62 304)"/><ellipse cx="869" cy="292" rx="17" ry="48" transform="rotate(30 869 292)"/></g>
    <path d="m649 42 10 6 11-8" fill="none" stroke="var(--theme-art-tree)" strokeWidth="3"/>
  </svg>;
}
