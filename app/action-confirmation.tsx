"use client";
import {createPortal} from 'react-dom';
import styles from './action-confirmation.module.css';
export default function ActionConfirmation({title,message,confirmLabel,onConfirm,onCancel}:{title:string;message:string;confirmLabel:string;onConfirm:()=>void;onCancel:()=>void}) {
 return createPortal(<div className={styles.backdrop}><section role="dialog" aria-modal="true" aria-label={title} className={styles.dialog}><header><span aria-hidden="true">!</span><h2>{title}</h2></header><p>{message}</p><footer><button data-dialog-close type="button" className="secondary" onClick={onCancel}>Cancel</button><button type="button" className={styles.confirm} onClick={onConfirm}>{confirmLabel}</button></footer></section></div>,document.body);
}
