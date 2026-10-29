'use client';
import {useEffect,useRef,type ReactNode} from 'react';
export default function HouseholdMemberMenu({name,children}:{name:string;children:ReactNode}){
 const root=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{const outside=(event:PointerEvent)=>{if(root.current?.open&&!root.current.contains(event.target as Node))root.current.open=false;};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&root.current?.open){root.current.open=false;root.current.querySelector('summary')?.focus();}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};},[]);
 return <details className="member-overflow" ref={root}><summary aria-label={`Actions for ${name}`}><span aria-hidden="true">⋮</span></summary><div className="lifecycle-member-actions">{children}</div></details>;
}
