"use client";
import OutlineIcon from "./outline-icon";
export default function FloatingAddButton({label,disabled,onClick,expanded,controls}:{label:string;disabled?:boolean;onClick:()=>void;expanded?:boolean;controls?:string}) {
  return <button type="button" className={"floating-add-button" + (expanded ? " is-open" : "")} aria-label={label} disabled={disabled} aria-expanded={expanded} aria-controls={controls} onClick={onClick}><OutlineIcon name="plus"/></button>;
}
