"use client";
import styles from "./floating-add-button.module.css";
import OutlineIcon from "./outline-icon";
export default function FloatingAddButton({label,disabled,onClick,expanded,controls}:{label:string;disabled?:boolean;onClick:()=>void;expanded?:boolean;controls?:string}) {
  return <button type="button" className={styles.button + " floating-add-button" + (expanded ? " is-open" : "")} aria-label={label} disabled={disabled} aria-expanded={expanded} aria-controls={controls} onClick={onClick}><OutlineIcon name="plus"/></button>;
}
