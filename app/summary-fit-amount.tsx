"use client";
import {useLayoutEffect,useRef,useState} from 'react';
/** Use compact currency only when the full value exceeds its actual available width. */
export default function SummaryFitAmount({full,compact}:{full:string;compact:string}){
 const host=useRef<HTMLSpanElement>(null),measure=useRef<HTMLSpanElement>(null);
 const [short,setShort]=useState(false);
 useLayoutEffect(()=>{const fit=()=>{if(host.current&&measure.current)setShort(measure.current.getBoundingClientRect().width>host.current.clientWidth+.5);};fit();const observer=new ResizeObserver(fit);if(host.current)observer.observe(host.current);if(measure.current)observer.observe(measure.current);document.fonts?.ready.then(fit);return()=>observer.disconnect();},[full,compact]);
 return <span ref={host} className="summary-fit-amount" data-compact={short} title={full} aria-label={full}><span ref={measure} className="summary-amount-measure" aria-hidden="true">{full}</span><span aria-hidden="true" className="money-value">{short?compact:full}</span></span>;
}
